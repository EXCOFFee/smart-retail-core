/**
 * ============================================================================
 * SMART_RETAIL - Redis Stock Cache Adapter
 * ============================================================================
 * Implementación del puerto IStockCachePort usando Redis.
 * 
 * ARQUITECTURA: Capa de INFRAESTRUCTURA 🔵 (adapters/cache)
 * 
 * RESPONSABILIDADES:
 * 1. Cachear stock para lecturas ultra-rápidas (<5ms)
 * 2. Implementar distributed locks con SETNX (TTL 30s)
 * 3. Manejar counter atómicos (INCR/DECR)
 * 
 * ⚠️ NOTA: Los locks usan el patrón Redlock simplificado.
 *    Para producción con múltiples nodos Redis, usar redis-semaphore.
 * ============================================================================
 */

import {
    IStockCachePort,
    StockLockResult
} from '@application/ports/output/stock-cache.port';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

/**
 * Prefijos para claves Redis.
 * 
 * Por qué prefijos: Evita colisiones y facilita operaciones SCAN
 * para depuración o limpieza selectiva.
 */
const REDIS_KEYS = {
  /** Stock de producto por ubicación: stock:{productId}:{locationId} */
  STOCK: 'stock',
  /** Lock de reserva: lock:stock:{productId}:{locationId} */
  STOCK_LOCK: 'lock:stock',
  /** Nonces de QR usados (anti-replay): nonce:{nonce} */
  NONCE: 'nonce',
} as const;

@Injectable()
export class RedisStockCacheAdapter
  implements IStockCachePort, OnModuleDestroy
{
  private readonly logger = new Logger(RedisStockCacheAdapter.name);
  private readonly redis: Redis;

  /**
   * TTL del lock en segundos (30s por defecto).
   * 
   * Por qué 30s: Suficiente para el flujo completo (pago ~3s, HW ACK ~5s)
   * pero no tanto que bloquee si el proceso muere.
   */
  private readonly lockTtlSeconds: number;

  /**
   * TTL del caché de stock en segundos.
   * 
   * Por qué 300s (5min): Balance entre frescura y rendimiento.
   * El write-through actualiza al decrementar.
   */
  private readonly stockCacheTtlSeconds: number;

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.getOrThrow<string>('REDIS_HOST'),
      port: this.configService.getOrThrow<number>('REDIS_PORT'),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      db: this.configService.get<number>('REDIS_DB', 0),
      // Timeouts agresivos para mantener <200ms
      connectTimeout: 5000, // Aumentado para Railway internal network
      commandTimeout: 2000,
      retryStrategy: (times: number): number | null => {
        if (times > 5) {
          this.logger.error('Redis connection failed after 5 retries');
          return null; // Stop retrying
        }
        // Backoff exponencial con jitter
        const delay = Math.min(times * 200, 2000);
        this.logger.warn(`Redis retry attempt ${times}, waiting ${delay}ms`);
        return delay;
      },
      // LazyConnect true para no bloquear el inicio de la app
      lazyConnect: true,
      // Reconexión automática
      maxRetriesPerRequest: 3,
    });

    this.lockTtlSeconds = this.configService.get<number>('REDIS_LOCK_TTL', 30);
    this.stockCacheTtlSeconds = this.configService.get<number>(
      'REDIS_STOCK_CACHE_TTL',
      300,
    );

    this.redis.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    this.redis.on('error', (err: Error) => {
      this.logger.error('Redis error', err.message);
    });
  }

  /**
   * Cleanup al cerrar el módulo.
   */
  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
    this.logger.log('Redis connection closed');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STOCK CACHE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Obtiene el stock cacheado de un producto en una ubicación.
   * 
   * @param productId - ID del producto
   * @param locationId - ID de la ubicación
   * @returns Stock actual o null si no está en caché
   */
  async getStock(productId: string, locationId: string): Promise<number | null> {
    const key = this.buildKey(REDIS_KEYS.STOCK, productId, locationId);
    const value = await this.redis.get(key);

    if (value === null) {
      this.logger.debug('Stock cache miss', { productId, locationId });
      return null;
    }

    return parseInt(value, 10);
  }

  /**
   * Establece el stock de un producto en caché.
   * 
   * @param productId - ID del producto
   * @param locationId - ID de la ubicación
   * @param quantity - Cantidad a cachear
   */
  async setStock(
    productId: string,
    locationId: string,
    quantity: number,
  ): Promise<void> {
    const key = this.buildKey(REDIS_KEYS.STOCK, productId, locationId);
    await this.redis.setex(key, this.stockCacheTtlSeconds, quantity.toString());
    this.logger.debug('Stock cached', { productId, locationId, quantity });
  }

  /**
   * Lua script para decremento atómico con TTL refresh.
   * 
   * ATOMICIDAD COMPLETA: Una sola operación Redis.
   * - DECRBY + EXPIRE en un solo round-trip
   * - Sin race conditions entre operaciones
   * 
   * Returns: { newValue, success }
   * - success=false si el stock resultante sería negativo
   */
  private static readonly DECREMENT_STOCK_SCRIPT = `
    local key = KEYS[1]
    local quantity = tonumber(ARGV[1])
    local ttl = tonumber(ARGV[2])
    
    -- Verificar stock actual
    local current = tonumber(redis.call('GET', key) or '0')
    
    -- Validar que no quede negativo
    if current < quantity then
      return { -1, 0 }  -- Insufficient stock
    end
    
    -- Decrementar atómicamente
    local newValue = redis.call('DECRBY', key, quantity)
    
    -- Refrescar TTL en la misma operación
    redis.call('EXPIRE', key, ttl)
    
    return { newValue, 1 }  -- Success
  `;

  /**
   * Decrementa atómicamente el stock en caché.
   * 
   * Por qué Lua Script: Garantiza atomicidad completa.
   * - Verifica stock suficiente
   * - Decrementa 
   * - Actualiza TTL
   * Todo en una sola operación atómica.
   * 
   * @param productId - ID del producto
   * @param locationId - ID de la ubicación
   * @param quantity - Cantidad a decrementar
   * @returns Nuevo valor del stock (-1 si insuficiente)
   */
  async decrementStock(
    productId: string,
    locationId: string,
    quantity: number,
  ): Promise<number> {
    const key = this.buildKey(REDIS_KEYS.STOCK, productId, locationId);
    
    const result = await this.redis.eval(
      RedisStockCacheAdapter.DECREMENT_STOCK_SCRIPT,
      1, // Number of keys
      key,
      quantity.toString(),
      this.stockCacheTtlSeconds.toString(),
    ) as [number, number];

    const [newValue, success] = result;

    if (!success) {
      this.logger.warn('Insufficient stock for decrement', {
        productId,
        locationId,
        requested: quantity,
      });
      return -1;
    }

    this.logger.debug('Stock decremented (atomic Lua)', {
      productId,
      locationId,
      decremented: quantity,
      newValue,
    });

    return newValue;
  }

  /**
   * Lua script para incremento atómico con TTL refresh.
   * 
   * ATOMICIDAD COMPLETA: Una sola operación Redis.
   */
  private static readonly INCREMENT_STOCK_SCRIPT = `
    local key = KEYS[1]
    local quantity = tonumber(ARGV[1])
    local ttl = tonumber(ARGV[2])
    
    -- Incrementar atómicamente
    local newValue = redis.call('INCRBY', key, quantity)
    
    -- Refrescar TTL en la misma operación
    redis.call('EXPIRE', key, ttl)
    
    return newValue
  `;

  /**
   * Incrementa atómicamente el stock en caché (para rollback).
   * 
   * Por qué Lua Script: Garantiza atomicidad completa.
   * - INCRBY + EXPIRE en una sola operación.
   * 
   * @param productId - ID del producto
   * @param locationId - ID de la ubicación
   * @param quantity - Cantidad a incrementar
   * @returns Nuevo valor del stock
   */
  async incrementStock(
    productId: string,
    locationId: string,
    quantity: number,
  ): Promise<number> {
    const key = this.buildKey(REDIS_KEYS.STOCK, productId, locationId);
    
    const newValue = await this.redis.eval(
      RedisStockCacheAdapter.INCREMENT_STOCK_SCRIPT,
      1, // Number of keys
      key,
      quantity.toString(),
      this.stockCacheTtlSeconds.toString(),
    ) as number;

    this.logger.debug('Stock incremented (atomic Lua rollback)', {
      productId,
      locationId,
      incremented: quantity,
      newValue,
    });

    return newValue;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DISTRIBUTED LOCKING (Soft Lock - CU-05)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Intenta adquirir un lock distribuido para el stock de un producto.
   * 
   * IMPLEMENTACIÓN: SET NX EX (atómico)
   * - NX: Solo si no existe
   * - EX: Con TTL automático
   * 
   * @param productId - ID del producto
   * @param locationId - ID de la ubicación
   * @param ownerId - ID del dueño del lock (userId)
   * @param quantity - Cantidad a reservar (guardada en el valor)
   * @returns Resultado del intento de lock
   */
  async acquireLock(
    productId: string,
    locationId: string,
    ownerId: string,
    quantity: number,
  ): Promise<StockLockResult> {
    const lockKey = this.buildKey(REDIS_KEYS.STOCK_LOCK, productId, locationId);
    const lockValue = JSON.stringify({ ownerId, quantity, lockedAt: Date.now() });

    // Obtener stock actual antes del lock
    const stockKey = this.buildKey(REDIS_KEYS.STOCK, productId, locationId);
    const currentStock = await this.redis.get(stockKey);
    const availableStock = currentStock !== null ? parseInt(currentStock, 10) : 0;

    // SET key value NX EX seconds
    const result = await this.redis.set(
      lockKey,
      lockValue,
      'EX',
      this.lockTtlSeconds,
      'NX',
    );

    if (result === 'OK') {
      this.logger.log('Lock acquired', { lockKey, ownerId });
      return {
        success: true,
        availableStock,
        lockKey,
        ttlSeconds: this.lockTtlSeconds,
      };
    }

    // Lock ya existe - alguien más lo tiene
    const existingLock = await this.redis.get(lockKey);
    let currentOwner = 'unknown';

    if (existingLock) {
      try {
        const parsed = JSON.parse(existingLock);
        currentOwner = parsed.ownerId ?? 'unknown';
      } catch {
        // Lock corrupto, ignorar
      }
    }

    this.logger.warn('Lock denied - already held', {
      lockKey,
      requestedBy: ownerId,
      heldBy: currentOwner,
    });

    return {
      success: false,
      availableStock,
      lockKey: null,
      ttlSeconds: 0,
    };
  }

  /**
   * Libera un lock distribuido de forma segura usando Lua script.
   * 
   * Por qué Lua Script: Garantiza atomicidad al verificar que el dueño
   * sea el mismo antes de borrar. Evita que un proceso libere el lock
   * de otro proceso (race condition crítica en sistemas distribuidos).
   * 
   * @param lockKey - Clave del lock a liberar
   * @param ownerId - ID del dueño que intenta liberar
   * @returns true si el lock fue eliminado por el dueño correcto
   */
  async releaseLock(lockKey: string, ownerId?: string): Promise<boolean> {
    if (!ownerId) {
      // Fallback legacy: liberar sin verificar dueño (deprecado)
      const deleted = await this.redis.del(lockKey);
      this.logger.debug('Lock released (legacy mode)', { lockKey });
      return deleted > 0;
    }

    // Lua script atómico: solo libera si el ownerId coincide
    // KEYS[1] = lockKey, ARGV[1] = ownerId
    const luaScript = `
      local lockData = redis.call('GET', KEYS[1])
      if not lockData then
        return 0
      end
      local parsed = cjson.decode(lockData)
      if parsed.ownerId == ARGV[1] then
        return redis.call('DEL', KEYS[1])
      end
      return -1
    `;

    const result = await this.redis.eval(
      luaScript,
      1,
      lockKey,
      ownerId,
    ) as number;

    if (result === 1) {
      this.logger.debug('Lock released (verified owner)', { lockKey, ownerId });
      return true;
    } else if (result === -1) {
      this.logger.warn('Lock release denied - wrong owner', { lockKey, ownerId });
      return false;
    }
    
    // Lock ya no existe
    this.logger.debug('Lock not found', { lockKey });
    return false;
  }

  /**
   * Extiende la expiración de un lock (para operaciones largas).
   * 
   * @param lockKey - Clave del lock
   * @param additionalSeconds - Segundos adicionales
   * @returns true si se extendió, false si el lock no existe
   */
  async extendLock(lockKey: string, additionalSeconds: number): Promise<boolean> {
    const result = await this.redis.expire(lockKey, additionalSeconds);
    return result === 1;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CACHE INVALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Invalida el cache de stock para un producto.
   * 
   * Por qué: Después de un ajuste manual de inventario (CU-13),
   * hay que invalidar el cache para forzar recarga desde Postgres.
   * 
   * @param productId - ID del producto
   * @param locationId - ID de la ubicación
   */
  async invalidateStock(productId: string, locationId: string): Promise<void> {
    const key = this.buildKey(REDIS_KEYS.STOCK, productId, locationId);
    await this.redis.del(key);
    this.logger.debug('Stock cache invalidated', { productId, locationId });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QR NONCE ANTI-REPLAY (CU-08)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Verifica y registra un nonce de QR para prevenir replay.
   * 
   * @param nonce - Nonce único del QR
   * @param ttlSeconds - TTL del nonce (default: 120s)
   * @returns true si el nonce es nuevo, false si ya fue usado
   */
  async checkAndSetNonce(nonce: string, ttlSeconds = 120): Promise<boolean> {
    const key = `${REDIS_KEYS.NONCE}:${nonce}`;
    const result = await this.redis.set(key, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Construye una clave Redis con el patrón prefix:segments.
   * 
   * @param prefix - Prefijo de la clave
   * @param segments - Segmentos adicionales
   * @returns Clave completa
   */
  private buildKey(prefix: string, ...segments: string[]): string {
    return [prefix, ...segments].join(':');
  }

  /**
   * Verifica si Redis está conectado (para health checks).
   * 
   * @returns true si conectado
   */
  async isHealthy(): Promise<boolean> {
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }
}
