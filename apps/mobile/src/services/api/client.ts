/**
 * ============================================================================
 * SMART_RETAIL - API Client
 * ============================================================================
 * Cliente HTTP configurado para comunicación con el backend.
 * 
 * FEATURES:
 * - Axios con interceptors
 * - Refresh automático de tokens
 * - Retry con backoff exponencial
 * - Timeout configurable
 * ============================================================================
 */

import axios, {
    AxiosError,
    AxiosInstance,
    AxiosRequestConfig,
    AxiosResponse,
    InternalAxiosRequestConfig,
} from 'axios';
import Constants from 'expo-constants';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE_URL =
  Constants.expoConfig?.extra?.apiUrl ?? 'https://api.smartretail.com/v1';

const DEFAULT_TIMEOUT = 10000; // 10 segundos
const CRITICAL_PATH_TIMEOUT = 5000; // 5 segundos para el critical path

// ─────────────────────────────────────────────────────────────────────────────
// API CLIENT CLASS
// ─────────────────────────────────────────────────────────────────────────────

class ApiClient {
  private instance: AxiosInstance;
  private authToken: string | null = null;
  private refreshTokenCallback: (() => Promise<void>) | null = null;

  constructor() {
    this.instance = axios.create({
      baseURL: API_BASE_URL,
      timeout: DEFAULT_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    this.setupInterceptors();
  }

  /**
   * Configura interceptors para requests y responses.
   */
  private setupInterceptors(): void {
    // Request interceptor - añade token de auth
    this.instance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        }

        // Añadir trace ID para correlación
        config.headers['X-Trace-Id'] = this.generateTraceId();

        return config;
      },
      (error: unknown) => Promise.reject(error),
    );

    // Response interceptor - manejo de errores y refresh
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & {
          _retry?: boolean;
        };

        // Si es 401 y no es un retry, intentar refresh
        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          this.refreshTokenCallback
        ) {
          originalRequest._retry = true;

          try {
            await this.refreshTokenCallback();
            // Reintentar request original con nuevo token
            return this.instance(originalRequest);
          } catch (refreshError) {
            // Refresh falló, propagar error original
            return Promise.reject(error);
          }
        }

        // Transformar error a formato estándar
        return Promise.reject(this.transformError(error));
      },
    );
  }

  /**
   * Genera un trace ID único para correlación de logs.
   */
  private generateTraceId(): string {
    return `mob_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Transforma errores de Axios a formato estándar.
   */
  private transformError(error: AxiosError): Error {
    if (error.response) {
      // Error del servidor
      const data = error.response.data as {
        message?: string;
        errorCode?: string;
      };
      const message = data?.message ?? 'Error del servidor';
      return new Error(message);
    }

    if (error.request) {
      // No hubo respuesta (network error)
      return new Error('Error de conexión. Verifica tu internet.');
    }

    // Error de configuración
    return new Error(error.message);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC METHODS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Configura el token de autenticación.
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Limpia el token de autenticación.
   */
  clearAuthToken(): void {
    this.authToken = null;
  }

  /**
   * Configura el callback para refresh de tokens.
   */
  setRefreshTokenCallback(callback: () => Promise<void>): void {
    this.refreshTokenCallback = callback;
  }

  /**
   * GET request.
   */
  async get<T>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.instance.get<T>(url, config);
  }

  /**
   * POST request.
   */
  async post<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.instance.post<T>(url, data, config);
  }

  /**
   * PUT request.
   */
  async put<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.instance.put<T>(url, data, config);
  }

  /**
   * DELETE request.
   */
  async delete<T>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.instance.delete<T>(url, config);
  }

  /**
   * Request con timeout reducido para el critical path.
   */
  async criticalPathRequest<T>(
    method: 'get' | 'post' | 'put' | 'delete',
    url: string,
    data?: unknown,
  ): Promise<AxiosResponse<T>> {
    const config: AxiosRequestConfig = {
      timeout: CRITICAL_PATH_TIMEOUT,
    };

    switch (method) {
      case 'get':
        return this.get<T>(url, config);
      case 'post':
        return this.post<T>(url, data, config);
      case 'put':
        return this.put<T>(url, data, config);
      case 'delete':
        return this.delete<T>(url, config);
    }
  }
}

// Exportar instancia singleton
export const apiClient = new ApiClient();
