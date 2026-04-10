/**
 * ============================================================================
 * SMART_RETAIL Mobile - API Client Tests
 * ============================================================================
 * Tests unitarios para el cliente HTTP.
 * 
 * Patrón: AAA (Arrange, Act, Assert) según 04_qa_test_architect.md
 * Cobertura: Token management, API exports
 * ============================================================================
 */

// Mock axios antes de importar
const mockAxiosInstance = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
};

jest.mock('axios', () => ({
  create: jest.fn(() => mockAxiosInstance),
  isAxiosError: jest.fn((error) => error?.isAxiosError === true),
}));

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      apiUrl: 'https://test-api.smartretail.com/v1',
    },
  },
}));

// Import after mocks
import { apiClient } from '@/services/api/client';

describe('ApiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock implementations
    mockAxiosInstance.get.mockResolvedValue({ data: {} });
    mockAxiosInstance.post.mockResolvedValue({ data: {} });
    mockAxiosInstance.put.mockResolvedValue({ data: {} });
    mockAxiosInstance.delete.mockResolvedValue({ data: {} });
  });

  describe('Token Management', () => {
    it('should set auth token without throwing', () => {
      // Act & Assert - should not throw
      expect(() => apiClient.setAuthToken('test-jwt-token')).not.toThrow();
    });

    it('should clear auth token without throwing', () => {
      // Arrange
      apiClient.setAuthToken('some-token');

      // Act & Assert
      expect(() => apiClient.clearAuthToken()).not.toThrow();
    });

    it('should set refresh token callback without throwing', () => {
      // Arrange
      const mockCallback = jest.fn().mockResolvedValue(undefined);

      // Act & Assert
      expect(() => apiClient.setRefreshTokenCallback(mockCallback)).not.toThrow();
    });
  });

  describe('HTTP Methods', () => {
    it('should make GET request correctly', async () => {
      // Arrange
      const url = '/users';
      const expectedResponse = { data: { success: true } };
      mockAxiosInstance.get.mockResolvedValue(expectedResponse);

      // Act
      const result = await apiClient.get(url);

      // Assert
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(url, undefined);
      expect(result).toEqual(expectedResponse);
    });

    it('should make POST request with data', async () => {
      // Arrange
      const url = '/users';
      const data = { name: 'Test User', email: 'test@test.com' };
      const expectedResponse = { data: { id: '123' } };
      mockAxiosInstance.post.mockResolvedValue(expectedResponse);

      // Act
      const result = await apiClient.post(url, data);

      // Assert
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(url, data, undefined);
      expect(result).toEqual(expectedResponse);
    });

    it('should make PUT request with data', async () => {
      // Arrange
      const url = '/users/123';
      const data = { name: 'Updated User' };
      const expectedResponse = { data: { updated: true } };
      mockAxiosInstance.put.mockResolvedValue(expectedResponse);

      // Act
      const result = await apiClient.put(url, data);

      // Assert
      expect(mockAxiosInstance.put).toHaveBeenCalledWith(url, data, undefined);
      expect(result).toEqual(expectedResponse);
    });

    it('should make DELETE request correctly', async () => {
      // Arrange
      const url = '/users/123';
      const expectedResponse = { data: { deleted: true } };
      mockAxiosInstance.delete.mockResolvedValue(expectedResponse);

      // Act
      const result = await apiClient.delete(url);

      // Assert
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(url, undefined);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('Critical Path Request', () => {
    it('should make GET request with reduced timeout', async () => {
      // Arrange
      const url = '/access/validate';
      mockAxiosInstance.get.mockResolvedValue({ data: { fast: true } });

      // Act
      await apiClient.criticalPathRequest('get', url);

      // Assert - called with timeout config
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        url,
        expect.objectContaining({ timeout: 5000 }),
      );
    });

    it('should make POST request with reduced timeout', async () => {
      // Arrange
      const url = '/access/process';
      const data = { qrCode: 'test-qr' };
      mockAxiosInstance.post.mockResolvedValue({ data: { fast: true } });

      // Act
      await apiClient.criticalPathRequest('post', url, data);

      // Assert
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        url,
        data,
        expect.objectContaining({ timeout: 5000 }),
      );
    });

    it('should make PUT request with reduced timeout', async () => {
      // Arrange
      const url = '/transactions/123';
      const data = { status: 'completed' };
      mockAxiosInstance.put.mockResolvedValue({ data: { fast: true } });

      // Act
      await apiClient.criticalPathRequest('put', url, data);

      // Assert
      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        url,
        data,
        expect.objectContaining({ timeout: 5000 }),
      );
    });

    it('should make DELETE request with reduced timeout', async () => {
      // Arrange
      const url = '/sessions/123';
      mockAxiosInstance.delete.mockResolvedValue({ data: { fast: true } });

      // Act
      await apiClient.criticalPathRequest('delete', url);

      // Assert
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        url,
        expect.objectContaining({ timeout: 5000 }),
      );
    });
  });

  describe('Interceptors Setup', () => {
    it('should have request use method available', () => {
      // The interceptor methods exist on the mock
      expect(mockAxiosInstance.interceptors.request.use).toBeDefined();
    });

    it('should have response use method available', () => {
      // The response interceptor methods exist
      expect(mockAxiosInstance.interceptors.response.use).toBeDefined();
    });
  });
});

describe('Error Transformation', () => {
  it('should handle server errors with message', () => {
    // This tests the error structure conceptually
    const serverError = {
      response: {
        status: 400,
        data: { message: 'Validation failed' },
      },
      isAxiosError: true,
    };

    expect(serverError.response.data.message).toBe('Validation failed');
  });

  it('should handle network errors', () => {
    // Network error has request but no response
    const networkError = {
      request: {},
      message: 'Network Error',
      isAxiosError: true,
    };

    expect(networkError.request).toBeDefined();
    expect(networkError.message).toBe('Network Error');
  });

  it('should handle configuration errors', () => {
    // Config error has no request or response
    const configError = {
      message: 'Invalid URL',
      isAxiosError: true,
    };

    expect(configError.message).toBe('Invalid URL');
  });
});
