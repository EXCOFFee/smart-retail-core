/**
 * ============================================================================
 * SMART_RETAIL Mobile - Offline Queue Tests
 * ============================================================================
 * Tests para el servicio de cola offline.
 * ============================================================================
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Mocks - deben estar antes de importar el módulo
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

// Importar después de los mocks
import { offlineQueue } from '@/services/offline/offlineQueue';

describe('OfflineQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();
    mockAsyncStorage.removeItem.mockResolvedValue();
  });

  describe('enqueue', () => {
    it('should add item to empty queue', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(null);

      const id = await offlineQueue.enqueue('access_attempt', {
        qrPayload: 'test-qr',
        timestamp: Date.now(),
      });

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(mockAsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should add item to existing queue', async () => {
      const existingQueue = [
        {
          id: 'existing-1',
          type: 'log_event',
          payload: { event: 'test' },
          timestamp: Date.now() - 1000,
          retryCount: 0,
          maxRetries: 3,
        },
      ];
      mockAsyncStorage.getItem.mockResolvedValueOnce(
        JSON.stringify(existingQueue),
      );

      const id = await offlineQueue.enqueue('access_attempt', {
        qrPayload: 'test-qr-2',
      });

      expect(id).toBeDefined();
      
      // Check that setItem was called with array containing both items
      const setItemCall = mockAsyncStorage.setItem.mock.calls[0];
      const savedQueue = JSON.parse(setItemCall[1] as string);
      expect(savedQueue.length).toBe(2);
    });
  });

  describe('getPendingCount', () => {
    it('should return 0 for empty queue', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(null);

      const size = await offlineQueue.getPendingCount();

      expect(size).toBe(0);
    });

    it('should return correct count for non-empty queue', async () => {
      const queue = [
        { id: '1', type: 'log_event', payload: {}, timestamp: 0, retryCount: 0, maxRetries: 3 },
        { id: '2', type: 'log_event', payload: {}, timestamp: 0, retryCount: 0, maxRetries: 3 },
        { id: '3', type: 'access_attempt', payload: {}, timestamp: 0, retryCount: 0, maxRetries: 3 },
      ];
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(queue));

      const size = await offlineQueue.getPendingCount();

      expect(size).toBe(3);
    });
  });

  describe('clear', () => {
    it('should remove queue from storage', async () => {
      await offlineQueue.clear();

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(
        expect.stringContaining('offline_queue'),
      );
    });
  });
});
