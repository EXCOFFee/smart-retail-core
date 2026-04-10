/**
 * ============================================================================
 * SMART_RETAIL - Auth Provider
 * ============================================================================
 * Proveedor de contexto para autenticación.
 * 
 * FEATURES:
 * - Persistencia de tokens con expo-secure-store
 * - Refresh automático de tokens
 * - Estado de autenticación global
 * ============================================================================
 */

import * as SecureStore from 'expo-secure-store';
import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';

import { apiClient } from '@/services/api/client';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'consumer' | 'merchant' | 'operator' | 'admin';
  locationId: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

// Claves para SecureStore
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'smart_retail_access_token',
  REFRESH_TOKEN: 'smart_retail_refresh_token',
  USER: 'smart_retail_user',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Hook para acceder al contexto de autenticación.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  /**
   * Carga el estado de autenticación guardado al iniciar.
   */
  useEffect(() => {
    const loadStoredAuth = async () => {
      try {
        const [accessToken, userJson] = await Promise.all([
          SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN),
          SecureStore.getItemAsync(STORAGE_KEYS.USER),
        ]);

        if (accessToken && userJson) {
          const user = JSON.parse(userJson) as User;
          
          // Configurar token en el cliente API
          apiClient.setAuthToken(accessToken);

          setState({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          setState((s: AuthState) => ({ ...s, isLoading: false }));
        }
      } catch {
        // Silently handle storage errors - user will need to re-authenticate
        setState((s: AuthState) => ({ ...s, isLoading: false }));
      }
    };

    loadStoredAuth();
  }, []);

  /**
   * Inicia sesión con email y contraseña.
   */
  const login = useCallback(async (email: string, password: string) => {
    setState((s: AuthState) => ({ ...s, isLoading: true }));

    try {
      const response = await apiClient.post<{
        accessToken: string;
        refreshToken: string;
        user: User;
      }>('/auth/login', { email, password });

      const { accessToken, refreshToken, user } = response.data;

      // Guardar tokens y usuario
      await Promise.all([
        SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken),
        SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken),
        SecureStore.setItemAsync(STORAGE_KEYS.USER, JSON.stringify(user)),
      ]);

      // Configurar token en el cliente API
      apiClient.setAuthToken(accessToken);

      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      setState((s: AuthState) => ({ ...s, isLoading: false }));
      throw error;
    }
  }, []);

  /**
   * Cierra la sesión y limpia el almacenamiento.
   */
  const logout = useCallback(async () => {
    try {
      // Intentar revocar el token en el servidor
      await apiClient.post('/auth/logout').catch(() => {
        // Ignorar errores de red al hacer logout
      });
    } finally {
      // Limpiar almacenamiento local
      await Promise.all([
        SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN),
        SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
        SecureStore.deleteItemAsync(STORAGE_KEYS.USER),
      ]);

      // Limpiar token del cliente API
      apiClient.clearAuthToken();

      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  }, []);

  /**
   * Refresca el token de acceso usando el refresh token.
   */
  const refreshAuth = useCallback(async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync(
        STORAGE_KEYS.REFRESH_TOKEN,
      );

      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await apiClient.post<{
        accessToken: string;
        refreshToken: string;
      }>('/auth/refresh', { refreshToken });

      const { accessToken, refreshToken: newRefreshToken } = response.data;

      // Actualizar tokens almacenados
      await Promise.all([
        SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken),
        SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken),
      ]);

      // Actualizar token en el cliente API
      apiClient.setAuthToken(accessToken);
    } catch (error) {
      // Si falla el refresh, hacer logout
      await logout();
      throw error;
    }
  }, [logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      logout,
      refreshAuth,
    }),
    [state, login, logout, refreshAuth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
