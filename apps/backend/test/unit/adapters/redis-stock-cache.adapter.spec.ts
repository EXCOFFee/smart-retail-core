/**
 * Tests para RedisStockCacheAdapter
 */

import { ConfigService } from '@nestjs/config';

// Mock de ioredis ANTES de cualquier import
const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  decrby: jest.fn(),
  incrby: jest.fn(),
  expire: jest.fn(),
  ping: jest.fn(),
  quit: jest.fn(),
  on: jest.fn(),
  eval: jest.fn(), // Para Lua scripts atómicos
};

jest.mock('ioredis', () => ({
  Redis: jest.fn(() => mockRedis),
}));

import { RedisStockCacheAdapter } from '@infrastructure/adapters/cache/redis-stock-cache.adapter';

describe('RedisStockCacheAdapter', () => {
  let adapter: RedisStockCacheAdapter;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();

    configService = {
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, string | number> = {
          REDIS_HOST: 'localhost',
          REDIS_PORT: 6379,
        };
        return values[key];
      }),
      get: jest.fn((key: string, defaultValue?: number) => {
        const values: Record<string, string | number> = {
          REDIS_PASSWORD: '',
          REDIS_DB: 0,
          REDIS_LOCK_TTL: 30,
          REDIS_STOCK_CACHE_TTL: 300,
        };
        return values[key] ?? defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    adapter = new RedisStockCacheAdapter(configService);
  });

  describe('constructor', () => {
    it('should create adapter with config', () => {
      expect(adapter).toBeDefined();
      expect(configService.getOrThrow).toHaveBeenCalledWith('REDIS_HOST');
      expect(configService.getOrThrow).toHaveBeenCalledWith('REDIS_PORT');
    });

    it('should setup Redis event handlers', () => {
      expect(mockRedis.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('onModuleDestroy', () => {
    it('should close Redis connection', async () => {
      mockRedis.quit.mockResolvedValue('OK');
      await adapter.onModuleDestroy();
      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });

  describe('getStock', () => {
    it('should return cached stock value', async () => {
      mockRedis.get.mockResolvedValue('42');

      const result = await adapter.getStock('product-1', 'location-1');

      expect(result).toBe(42);
      expect(mockRedis.get).toHaveBeenCalledWith('stock:product-1:location-1');
    });

    it('should return null on cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await adapter.getStock('product-1', 'location-1');

      expect(result).toBeNull();
    });
  });

  describe('setStock', () => {
    it('should cache stock with TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await adapter.setStock('product-1', 'location-1', 100);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'stock:product-1:location-1',
        300, // default TTL
        '100',
      );
    });
  });

  describe('decrementStock', () => {
    it('should decrement atomically with Lua script and refresh TTL', async () => {
      // Lua script returns [newValue, success]
      mockRedis.eval.mockResolvedValue([95, 1]);

      const result = await adapter.decrementStock('product-1', 'location-1', 5);

      expect(result).toBe(95);
      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('DECRBY'),
        1,
        'stock:product-1:location-1',
        '5',
        '300',
      );
    });

    it('should return -1 when insufficient stock', async () => {
      // Lua script returns [-1, 0] for insufficient stock
      mockRedis.eval.mockResolvedValue([-1, 0]);

      const result = await adapter.decrementStock('product-1', 'location-1', 100);

      expect(result).toBe(-1);
    });
  });

  describe('incrementStock', () => {
    it('should increment atomically with Lua script (for rollback)', async () => {
      // Lua script returns just newValue for increment
      mockRedis.eval.mockResolvedValue(105);

      const result = await adapter.incrementStock('product-1', 'location-1', 5);

      expect(result).toBe(105);
      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('INCRBY'),
        1,
        'stock:product-1:location-1',
        '5',
        '300',
      );
    });
  });

  describe('acquireLock', () => {
    const productId = 'product-1';
    const locationId = 'location-1';
    const ownerId = 'user-123';

    it('should acquire lock successfully when not held', async () => {
      mockRedis.get.mockResolvedValue('50'); // current stock
      mockRedis.set.mockResolvedValue('OK');

      const result = await adapter.acquireLock(productId, locationId, ownerId, 5);

      expect(result.success).toBe(true);
      expect(result.availableStock).toBe(50);
      expect(result.lockKey).toBe('lock:stock:product-1:location-1');
      expect(result.ttlSeconds).toBe(30);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'lock:stock:product-1:location-1',
        expect.stringContaining(ownerId),
        'EX',
        30,
        'NX',
      );
    });

    it('should fail when lock already held', async () => {
      mockRedis.get
        .mockResolvedValueOnce('50') // current stock
        .mockResolvedValueOnce(JSON.stringify({ ownerId: 'other-user', quantity: 3 })); // existing lock
      mockRedis.set.mockResolvedValue(null); // Lock not acquired

      const result = await adapter.acquireLock(productId, locationId, ownerId, 5);

      expect(result.success).toBe(false);
      expect(result.availableStock).toBe(50);
      expect(result.lockKey).toBeNull();
    });

    it('should handle corrupted lock data gracefully', async () => {
      mockRedis.get
        .mockResolvedValueOnce('50')
        .mockResolvedValueOnce('invalid-json');
      mockRedis.set.mockResolvedValue(null);

      const result = await adapter.acquireLock(productId, locationId, ownerId, 5);

      expect(result.success).toBe(false);
    });
  });

  describe('releaseLock', () => {
    it('should release lock by deleting key (legacy mode without ownerId)', async () => {
      mockRedis.del.mockResolvedValue(1);

      const result = await adapter.releaseLock('lock:stock:product-1:location-1');

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('lock:stock:product-1:location-1');
    });

    it('should return false when lock does not exist (legacy mode)', async () => {
      mockRedis.del.mockResolvedValue(0);

      const result = await adapter.releaseLock('lock:stock:non-existent');

      expect(result).toBe(false);
    });

    it('should release lock with Lua script when ownerId provided', async () => {
      // Lua script returns 1 when lock deleted successfully
      mockRedis.eval.mockResolvedValue(1);

      const result = await adapter.releaseLock(
        'lock:stock:product-1:location-1',
        'owner-123',
      );

      expect(result).toBe(true);
      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('cjson.decode'),
        1,
        'lock:stock:product-1:location-1',
        'owner-123',
      );
    });

    it('should return false when ownerId does not match', async () => {
      // Lua script returns -1 when ownerId doesn't match
      mockRedis.eval.mockResolvedValue(-1);

      const result = await adapter.releaseLock(
        'lock:stock:product-1:location-1',
        'wrong-owner',
      );

      expect(result).toBe(false);
    });

    it('should return false when lock not found (Lua mode)', async () => {
      // Lua script returns 0 when lock doesn't exist
      mockRedis.eval.mockResolvedValue(0);

      const result = await adapter.releaseLock(
        'lock:stock:non-existent',
        'owner-123',
      );

      expect(result).toBe(false);
    });
  });

  describe('extendLock', () => {
    it('should extend lock TTL', async () => {
      mockRedis.expire.mockResolvedValue(1);

      const result = await adapter.extendLock('lock:stock:product-1:location-1', 60);

      expect(result).toBe(true);
      expect(mockRedis.expire).toHaveBeenCalledWith('lock:stock:product-1:location-1', 60);
    });

    it('should return false when lock not found', async () => {
      mockRedis.expire.mockResolvedValue(0);

      const result = await adapter.extendLock('lock:stock:non-existent', 60);

      expect(result).toBe(false);
    });
  });

  describe('invalidateStock', () => {
    it('should delete stock cache key', async () => {
      mockRedis.del.mockResolvedValue(1);

      await adapter.invalidateStock('product-1', 'location-1');

      expect(mockRedis.del).toHaveBeenCalledWith('stock:product-1:location-1');
    });
  });

  describe('checkAndSetNonce', () => {
    it('should return true for new nonce', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await adapter.checkAndSetNonce('unique-nonce-123');

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'nonce:unique-nonce-123',
        '1',
        'EX',
        120,
        'NX',
      );
    });

    it('should return false for already used nonce', async () => {
      mockRedis.set.mockResolvedValue(null);

      const result = await adapter.checkAndSetNonce('used-nonce-456');

      expect(result).toBe(false);
    });

    it('should accept custom TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await adapter.checkAndSetNonce('nonce-789', 60);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'nonce:nonce-789',
        '1',
        'EX',
        60,
        'NX',
      );
    });
  });

  describe('isHealthy', () => {
    it('should return true when Redis responds PONG', async () => {
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await adapter.isHealthy();

      expect(result).toBe(true);
    });

    it('should return false when ping fails', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection lost'));

      const result = await adapter.isHealthy();

      expect(result).toBe(false);
    });
  });

  describe('Redis event handlers', () => {
    it('should call connect handler without error', () => {
      // Get the connect handler that was registered
      const connectCall = (mockRedis.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'connect',
      );
      expect(connectCall).toBeDefined();

      const connectHandler = connectCall[1];

      // Should not throw
      expect(() => connectHandler()).not.toThrow();
    });

    it('should call error handler without crashing', () => {
      // Get the error handler that was registered
      const errorCall = (mockRedis.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'error',
      );
      expect(errorCall).toBeDefined();

      const errorHandler = errorCall[1];

      // Should not throw when handling an error
      expect(() => errorHandler(new Error('Test error'))).not.toThrow();
    });
  });
});
