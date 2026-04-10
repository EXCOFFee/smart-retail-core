/**
 * ============================================================================
 * SMART_RETAIL - IStockCachePort (Output Port)
 * ============================================================================
 * Puerto de salida para operaciones de stock en caché (Redis).
 * 
 * ARQUITECTURA: Capa de APLICACIÓN 🟠 (ports/output)
 * 
 * Por qué separar de IProductRepository: El caché es para operaciones
 * de alta velocidad (<200ms). La persistencia es para durabilidad.
 * Separar los puertos respeta Interface Segregation Principle.
 * ============================================================================
 */

/**
 * Resultado de una operación de bloqueo de stock.
 */
export interface StockLockResult {
  /** Si el lock fue exitoso */
  success: boolean;

  /** Cantidad de stock disponible (antes del lock) */
  availableStock: number;

  /** Clave del lock (para liberar después) */
  lockKey: string | null;

  /** Tiempo de expiración del lock en segundos */
  ttlSeconds: number;
}

/**
 * Puerto de salida para operaciones de stock en caché.
 * 
 * Implementado por RedisStockCacheAdapter.
 */
export interface IStockCachePort {
  /**
   * Obtiene el stock disponible de un producto en una ubicación.
   * 
   * Por qué cache: Esta operación debe ser ultra-rápida (<10ms).
   * El stock en Redis se sincroniza con Postgres pero se lee del cache.
   * 
   * @param productId - ID del producto
   * @param locationId - ID de la ubicación
   * @returns Cantidad disponible (null si no está en cache)
   */
  getStock(productId: string, locationId: string): Promise<number | null>;

  /**
   * Actualiza el stock en caché.
   * 
   * Por qué: Después de una transacción exitosa, se actualiza el cache.
   * También se usa para warm-up inicial desde Postgres.
   * 
   * @param productId - ID del producto
   * @param locationId - ID de la ubicación
   * @param quantity - Nueva cantidad
   */
  setStock(
    productId: string,
    locationId: string,
    quantity: number,
  ): Promise<void>;

  /**
   * Decrementa el stock atómicamente.
   * 
   * Por qué atómico: Evita race conditions. Redis DECRBY es atómico.
   * 
   * @param productId - ID del producto
   * @param locationId - ID de la ubicación
   * @param amount - Cantidad a decrementar (default 1)
   * @returns Nuevo valor después del decremento
   */
  decrementStock(
    productId: string,
    locationId: string,
    amount?: number,
  ): Promise<number>;

  /**
   * Incrementa el stock atómicamente (liberación o ajuste).
   * 
   * @param productId - ID del producto
   * @param locationId - ID de la ubicación
   * @param amount - Cantidad a incrementar
   * @returns Nuevo valor después del incremento
   */
  incrementStock(
    productId: string,
    locationId: string,
    amount: number,
  ): Promise<number>;

  /**
   * Intenta obtener un lock exclusivo sobre el stock de un producto.
   * 
   * CRÍTICO para CU-05 (Race Condition):
   * Solo un usuario puede tener el lock a la vez.
   * Si otro usuario intenta lockear, recibe success: false.
   * 
   * @param productId - ID del producto
   * @param locationId - ID de la ubicación
   * @param userId - ID del usuario que solicita el lock
   * @param quantity - Cantidad a reservar
   * @returns Resultado del intento de lock
   */
  acquireLock(
    productId: string,
    locationId: string,
    userId: string,
    quantity: number,
  ): Promise<StockLockResult>;

  /**
   * Libera un lock de stock previamente adquirido.
   * 
   * Por qué ownerId: Usa Lua script para verificar atómicamente que
   * el proceso que libera es el mismo que adquirió el lock. Evita
   * que un proceso libere el lock de otro (race condition crítica).
   * 
   * @param lockKey - Clave del lock (obtenida de acquireLock)
   * @param ownerId - ID del dueño que intenta liberar (recomendado)
   * @returns true si el lock existía y fue liberado por el dueño correcto
   */
  releaseLock(lockKey: string, ownerId?: string): Promise<boolean>;

  /**
   * Extiende el TTL de un lock (para operaciones largas).
   * 
   * Por qué: Si 3DSecure tarda más de lo esperado, extendemos el lock
   * para no perder la reserva.
   * 
   * @param lockKey - Clave del lock
   * @param additionalSeconds - Segundos adicionales
   * @returns true si el lock existe y fue extendido
   */
  extendLock(lockKey: string, additionalSeconds: number): Promise<boolean>;

  /**
   * Invalida el cache de stock para un producto.
   * 
   * Por qué: Después de un ajuste manual de inventario (CU-13),
   * hay que invalidar el cache para forzar recarga desde Postgres.
   * 
   * @param productId - ID del producto
   * @param locationId - ID de la ubicación
   */
  invalidateStock(productId: string, locationId: string): Promise<void>;
}

/**
 * Token de inyección para NestJS DI.
 */
export const STOCK_CACHE_PORT = 'IStockCachePort';
