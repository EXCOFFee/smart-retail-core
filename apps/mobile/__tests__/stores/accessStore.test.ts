/**
 * ============================================================================
 * SMART_RETAIL Mobile - Access Store Tests
 * ============================================================================
 * Tests para el store de accesos QR.
 * ============================================================================
 */

import { apiClient } from '@/services/api/client';
import { useAccessStore } from '@/stores/accessStore';

// Mock del API client
jest.mock('@/services/api/client', () => ({
  apiClient: {
    post: jest.fn(),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPost = apiClient.post as jest.Mock<any>;

describe('useAccessStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAccessStore.getState().reset();
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      const state = useAccessStore.getState();

      expect(state.isProcessing).toBe(false);
      expect(state.lastResult).toBeNull();
      expect(state.lastScanTimestamp).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  describe('processAccess', () => {
    it('should process QR code successfully', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          success: true,
          transactionId: 'txn-123',
          message: 'Acceso autorizado',
        },
      });

      const accessResult = await useAccessStore.getState().processAccess('qr-payload-123');

      const state = useAccessStore.getState();
      expect(state.isProcessing).toBe(false);
      expect(state.lastResult).toEqual({
        success: true,
        transactionId: 'txn-123',
        message: 'Acceso autorizado',
        errorCode: undefined,
        latencyMs: expect.any(Number),
      });
      expect(accessResult).toEqual(state.lastResult);
    });

    it('should handle API errors gracefully', async () => {
      mockPost.mockRejectedValueOnce({
        response: {
          data: {
            message: 'Stock insuficiente',
            errorCode: 'INSUFFICIENT_STOCK',
          },
        },
      });

      await useAccessStore.getState().processAccess('qr-payload-fail');

      const state = useAccessStore.getState();
      expect(state.isProcessing).toBe(false);
      expect(state.lastResult?.success).toBe(false);
      expect(state.lastResult?.message).toBe('Stock insuficiente');
      expect(state.lastResult?.errorCode).toBe('INSUFFICIENT_STOCK');
      expect(state.error).toBe('Stock insuficiente');
    });

    it('should handle network errors', async () => {
      mockPost.mockRejectedValueOnce(new Error('Network Error'));

      await useAccessStore.getState().processAccess('qr-payload');

      const state = useAccessStore.getState();
      expect(state.lastResult?.success).toBe(false);
      expect(state.lastResult?.message).toBe('Network Error');
      expect(state.error).toBe('Network Error');
    });
  });

  describe('clearResult', () => {
    it('should clear last result and error', async () => {
      mockPost.mockResolvedValueOnce({
        data: { success: true, message: 'OK' },
      });

      // First, set a result
      await useAccessStore.getState().processAccess('qr-payload');
      expect(useAccessStore.getState().lastResult).not.toBeNull();

      // Now clear it
      useAccessStore.getState().clearResult();

      expect(useAccessStore.getState().lastResult).toBeNull();
      expect(useAccessStore.getState().error).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset to initial state', async () => {
      mockPost.mockResolvedValueOnce({
        data: { success: true, message: 'OK' },
      });

      // Set some state
      await useAccessStore.getState().processAccess('qr-payload');

      // Reset
      useAccessStore.getState().reset();

      const state = useAccessStore.getState();
      expect(state.isProcessing).toBe(false);
      expect(state.lastResult).toBeNull();
      expect(state.lastScanTimestamp).toBeNull();
      expect(state.error).toBeNull();
    });
  });
});
