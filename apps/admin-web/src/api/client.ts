/**
 * ============================================================================
 * SMART_RETAIL Admin Web - API Client (Axios)
 * ============================================================================
 * Cliente HTTP configurado para comunicarse con el backend.
 */

import { useAuthStore } from '@/stores/authStore';
import axios from 'axios';

// Base URL - en desarrollo usa proxy de Vite, en producción usa env var
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token JWT
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar errores de auth
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado o inválido
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// AUTH API
// ─────────────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/auth/login', data);
    return response.data;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DEVICES API
// ─────────────────────────────────────────────────────────────────────────────

export interface Device {
  id: string;
  serialNumber: string;
  name: string;
  type: string;
  status: string;
  locationId: string;
  lastHeartbeat: string | null;
  createdAt: string;
}

export interface DeviceProvisionRequest {
  serialNumber: string;
  name: string;
  type: 'TURNSTILE' | 'LOCKER' | 'DOOR' | 'KIOSK';
  locationId: string;
  config?: Record<string, unknown>;
}

export interface DeviceProvisionResponse {
  deviceId: string;
  serialNumber: string;
  name: string;
  status: string;
  locationId: string;
  apiKey: string;
  secret: string;
  provisionedAt: string;
  warning: string;
}

export const devicesApi = {
  list: async (): Promise<{ devices: Device[]; total: number }> => {
    const response = await apiClient.get('/devices');
    return response.data;
  },

  provision: async (data: DeviceProvisionRequest): Promise<DeviceProvisionResponse> => {
    const response = await apiClient.post('/devices/provision', data);
    return response.data;
  },

  updateStatus: async (id: string, status: string): Promise<void> => {
    await apiClient.patch(`/devices/${id}/status?status=${status}`);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTS API
// ─────────────────────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  sku: string;
  name: string;
  priceCents: number;
  stockQuantity: number;
  locationId: string;
  status: string;
  createdAt: string;
}

export interface ProductCreateRequest {
  sku: string;
  name: string;
  priceCents: number;
  stockQuantity: number;
  locationId: string;
}

export interface ProductUpdateRequest {
  name?: string;
  priceCents?: number;
  stockQuantity?: number;
  status?: string;
}

export const productsApi = {
  list: async (): Promise<{ products: Product[]; total: number }> => {
    const response = await apiClient.get('/products');
    return response.data;
  },

  create: async (data: ProductCreateRequest): Promise<Product> => {
    const response = await apiClient.post('/products', data);
    return response.data;
  },

  update: async (id: string, data: ProductUpdateRequest): Promise<Product> => {
    const response = await apiClient.patch(`/products/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/products/${id}`);
  },

  adjustStock: async (id: string, newQuantity: number, reason: string): Promise<void> => {
    await apiClient.post(`/products/${id}/adjust-stock`, { newQuantity, reason });
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TRANSACTIONS API
// ─────────────────────────────────────────────────────────────────────────────

export interface Transaction {
  id: string;
  userId: string;
  deviceId: string;
  amountCents: number;
  status: string;
  externalPaymentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionSearchParams {
  status?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
}

export const transactionsApi = {
  list: async (params?: TransactionSearchParams): Promise<{ transactions: Transaction[]; total: number }> => {
    const response = await apiClient.get('/transactions', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Transaction> => {
    const response = await apiClient.get(`/transactions/${id}`);
    return response.data;
  },
};
