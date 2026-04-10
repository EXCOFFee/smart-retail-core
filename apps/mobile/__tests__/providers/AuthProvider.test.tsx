/**
 * ============================================================================
 * SMART_RETAIL Mobile - AuthProvider Tests
 * ============================================================================
 * Tests unitarios para el proveedor de autenticación.
 * 
 * Patrón: AAA (Arrange, Act, Assert) según 04_qa_test_architect.md
 * Cobertura: Login, logout, refresh, persistencia SecureStore
 * ============================================================================
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import React, { ReactNode } from 'react';

import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { apiClient } from '@/services/api/client';

// ─────────────────────────────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('expo-secure-store');
jest.mock('@/services/api/client', () => ({
  apiClient: {
    setAuthToken: jest.fn(),
    clearAuthToken: jest.fn(),
    post: jest.fn(),
    get: jest.fn(),
  },
}));

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockApiClient = apiClient as unknown as {
  setAuthToken: jest.Mock;
  clearAuthToken: jest.Mock;
  post: jest.Mock;
  get: jest.Mock;
};

// Helper to create mock AxiosResponse
const mockAxiosResponse = <T,>(data: T) => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: { headers: {} },
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST DATA
// ─────────────────────────────────────────────────────────────────────────────

const mockUser = {
  id: 'user-123',
  email: 'test@smartretail.com',
  fullName: 'Test User',
  role: 'consumer' as const,
  locationId: 'loc-123',
};

const mockTokens = {
  accessToken: 'access-token-123',
  refreshToken: 'refresh-token-456',
};

// ─────────────────────────────────────────────────────────────────────────────
// WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no stored auth
    mockSecureStore.getItemAsync.mockResolvedValue(null);
  });

  describe('Initial State', () => {
    it('should start with loading state', async () => {
      // Arrange & Act
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Assert - initially loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should load stored auth on mount', async () => {
      // Arrange - stored auth exists
      mockSecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'smart_retail_access_token') return Promise.resolve(mockTokens.accessToken);
        if (key === 'smart_retail_user') return Promise.resolve(JSON.stringify(mockUser));
        return Promise.resolve(null);
      });

      // Act
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Assert - auth is restored
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.user).toEqual(mockUser);
      });

      expect(mockApiClient.setAuthToken).toHaveBeenCalledWith(mockTokens.accessToken);
    });

    it('should handle storage errors gracefully', async () => {
      // Arrange - storage throws error
      mockSecureStore.getItemAsync.mockRejectedValue(new Error('Storage error'));

      // Act
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Assert - fallback to unauthenticated
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.isAuthenticated).toBe(false);
      });
    });
  });

  describe('Login', () => {
    it('should login successfully and store tokens', async () => {
      // Arrange
      mockApiClient.post.mockResolvedValueOnce(
        mockAxiosResponse({
          ...mockTokens,
          user: mockUser,
        }),
      );
      mockSecureStore.setItemAsync.mockResolvedValue();

      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Act
      await act(async () => {
        await result.current.login('test@smartretail.com', 'password123');
      });

      // Assert
      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@smartretail.com',
        password: 'password123',
      });
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'smart_retail_access_token',
        mockTokens.accessToken,
      );
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'smart_retail_refresh_token',
        mockTokens.refreshToken,
      );
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'smart_retail_user',
        JSON.stringify(mockUser),
      );
      expect(mockApiClient.setAuthToken).toHaveBeenCalledWith(mockTokens.accessToken);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
    });

    it('should handle login failure', async () => {
      // Arrange
      const loginError = new Error('Invalid credentials');
      mockApiClient.post.mockRejectedValueOnce(loginError);

      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Act & Assert
      await expect(
        act(async () => {
          await result.current.login('wrong@email.com', 'wrongpassword');
        }),
      ).rejects.toThrow('Invalid credentials');

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });
  });

  describe('Logout', () => {
    it('should logout and clear storage', async () => {
      // Arrange - start authenticated
      mockSecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'smart_retail_access_token') return Promise.resolve(mockTokens.accessToken);
        if (key === 'smart_retail_user') return Promise.resolve(JSON.stringify(mockUser));
        return Promise.resolve(null);
      });
      mockSecureStore.deleteItemAsync.mockResolvedValue();
      mockApiClient.post.mockResolvedValueOnce(mockAxiosResponse({})); // logout call

      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

      // Act
      await act(async () => {
        await result.current.logout();
      });

      // Assert
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('smart_retail_access_token');
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('smart_retail_refresh_token');
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('smart_retail_user');
      expect(mockApiClient.clearAuthToken).toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('should logout even if server call fails', async () => {
      // Arrange - start authenticated
      mockSecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'smart_retail_access_token') return Promise.resolve(mockTokens.accessToken);
        if (key === 'smart_retail_user') return Promise.resolve(JSON.stringify(mockUser));
        return Promise.resolve(null);
      });
      mockSecureStore.deleteItemAsync.mockResolvedValue();
      mockApiClient.post.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

      // Act
      await act(async () => {
        await result.current.logout();
      });

      // Assert - still logged out locally
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('Refresh Auth', () => {
    it('should refresh tokens successfully', async () => {
      // Arrange - start authenticated
      mockSecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'smart_retail_access_token') return Promise.resolve(mockTokens.accessToken);
        if (key === 'smart_retail_refresh_token') return Promise.resolve(mockTokens.refreshToken);
        if (key === 'smart_retail_user') return Promise.resolve(JSON.stringify(mockUser));
        return Promise.resolve(null);
      });
      mockSecureStore.setItemAsync.mockResolvedValue();
      
      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };
      mockApiClient.post.mockResolvedValueOnce(mockAxiosResponse(newTokens));

      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

      // Act
      await act(async () => {
        await result.current.refreshAuth();
      });

      // Assert
      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/refresh', {
        refreshToken: mockTokens.refreshToken,
      });
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'smart_retail_access_token',
        newTokens.accessToken,
      );
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'smart_retail_refresh_token',
        newTokens.refreshToken,
      );
      expect(mockApiClient.setAuthToken).toHaveBeenCalledWith(newTokens.accessToken);
    });

    it('should logout if refresh fails', async () => {
      // Arrange - start authenticated
      mockSecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'smart_retail_access_token') return Promise.resolve(mockTokens.accessToken);
        if (key === 'smart_retail_refresh_token') return Promise.resolve(mockTokens.refreshToken);
        if (key === 'smart_retail_user') return Promise.resolve(JSON.stringify(mockUser));
        return Promise.resolve(null);
      });
      mockSecureStore.deleteItemAsync.mockResolvedValue();
      mockApiClient.post.mockRejectedValueOnce(new Error('Token expired'));

      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

      // Act & Assert
      await expect(
        act(async () => {
          await result.current.refreshAuth();
        }),
      ).rejects.toThrow('Token expired');

      // Should be logged out
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should fail if no refresh token available', async () => {
      // Arrange - authenticated but no refresh token
      mockSecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'smart_retail_access_token') return Promise.resolve(mockTokens.accessToken);
        if (key === 'smart_retail_user') return Promise.resolve(JSON.stringify(mockUser));
        return Promise.resolve(null); // No refresh token
      });
      mockSecureStore.deleteItemAsync.mockResolvedValue();

      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

      // Act & Assert
      await expect(
        act(async () => {
          await result.current.refreshAuth();
        }),
      ).rejects.toThrow('No refresh token available');
    });
  });
});

describe('useAuth hook', () => {
  it('should throw error when used outside provider', () => {
    // Arrange & Act & Assert
    const { result } = renderHook(() => {
      try {
        return useAuth();
      } catch (error) {
        return { error };
      }
    });

    expect((result.current as { error: Error }).error.message).toBe(
      'useAuth must be used within an AuthProvider',
    );
  });
});
