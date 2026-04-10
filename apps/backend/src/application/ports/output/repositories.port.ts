/**
 * ============================================================================
 * SMART_RETAIL - Repository Ports (Output Ports)
 * ============================================================================
 * Puertos de salida para persistencia de entidades en base de datos.
 * 
 * ARQUITECTURA: Capa de APLICACIÓN 🟠 (ports/output)
 * 
 * Por qué Repository Pattern: Abstrae el acceso a datos. Los Use Cases
 * no saben si los datos vienen de Postgres, MongoDB, o un API externo.
 * ============================================================================
 */

import { Device } from '@domain/entities/device.entity';
import { Product } from '@domain/entities/product.entity';
import { Transaction, TransactionStatus } from '@domain/entities/transaction.entity';
import { User } from '@domain/entities/user.entity';

// ─────────────────────────────────────────────────────────────────────────────
// USER REPOSITORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Puerto de salida para persistencia de usuarios.
 */
export interface IUserRepository {
  /**
   * Busca un usuario por su ID.
   */
  findById(id: string): Promise<User | null>;

  /**
   * Busca un usuario por su email.
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Guarda un usuario (insert o update).
   * 
   * Por qué save y no create/update separados: TypeORM soporta upsert.
   * Simplifica la lógica del Use Case.
   */
  save(user: User): Promise<User>;

  /**
   * Actualiza solo el saldo del usuario (operación atómica).
   * 
   * Por qué método separado: Optimización para operaciones frecuentes.
   * Usa UPDATE directo en vez de SELECT + UPDATE.
   */
  updateBalance(userId: string, newBalanceCents: number): Promise<void>;
}

export const USER_REPOSITORY = 'IUserRepository';

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT REPOSITORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Criterios de búsqueda para productos.
 */
export interface ProductSearchCriteria {
  locationId?: string;
  sku?: string;
  status?: string;
  minStock?: number;
}

/**
 * Puerto de salida para persistencia de productos.
 */
export interface IProductRepository {
  /**
   * Busca un producto por su ID.
   */
  findById(id: string): Promise<Product | null>;

  /**
   * Busca un producto por SKU y ubicación.
   * 
   * Por qué locationId: El mismo SKU puede existir en múltiples sucursales.
   */
  findBySkuAndLocation(sku: string, locationId: string): Promise<Product | null>;

  /**
   * Busca productos por criterios.
   */
  findMany(criteria: ProductSearchCriteria): Promise<Product[]>;

  /**
   * Guarda un producto (insert o update).
   */
  save(product: Product): Promise<Product>;

  /**
   * Actualiza el stock con Optimistic Locking.
   * 
   * CRÍTICO: Usa la versión para detectar conflictos de concurrencia.
   * Si la versión cambió desde que leímos, lanza error.
   * 
   * @param productId - ID del producto
   * @param newQuantity - Nueva cantidad
   * @param expectedVersion - Versión esperada (la que leímos)
   * @returns true si se actualizó, false si hubo conflicto
   */
  updateStockWithVersion(
    productId: string,
    newQuantity: number,
    expectedVersion: number,
  ): Promise<boolean>;
}

export const PRODUCT_REPOSITORY = 'IProductRepository';

// ─────────────────────────────────────────────────────────────────────────────
// DEVICE REPOSITORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Puerto de salida para persistencia de dispositivos.
 */
export interface IDeviceRepository {
  /**
   * Busca un dispositivo por su ID.
   */
  findById(id: string): Promise<Device | null>;

  /**
   * Busca un dispositivo por su número de serie.
   */
  findBySerialNumber(serialNumber: string): Promise<Device | null>;

  /**
   * Busca dispositivos por ubicación.
   */
  findByLocationId(locationId: string): Promise<Device[]>;

  /**
   * Busca dispositivos activos (online u offline recientemente).
   */
  findActive(): Promise<Device[]>;

  /**
   * Guarda un dispositivo.
   */
  save(device: Device): Promise<Device>;

  /**
   * Actualiza el estado de un dispositivo.
   */
  updateStatus(deviceId: string, status: string): Promise<void>;

  /**
   * Registra el último heartbeat de un dispositivo.
   */
  updateHeartbeat(deviceId: string, timestamp: Date): Promise<void>;

  /**
   * Busca dispositivos sin heartbeat reciente (para marcar offline).
   * 
   * @param thresholdMinutes - Minutos sin heartbeat para considerar offline
   */
  findStaleDevices(thresholdMinutes: number): Promise<Device[]>;
}

export const DEVICE_REPOSITORY = 'IDeviceRepository';

// ─────────────────────────────────────────────────────────────────────────────
// TRANSACTION REPOSITORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Criterios de búsqueda para transacciones.
 */
export interface TransactionSearchCriteria {
  userId?: string;
  deviceId?: string;
  locationId?: string;
  status?: TransactionStatus;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Puerto de salida para persistencia de transacciones.
 */
export interface ITransactionRepository {
  /**
   * Busca una transacción por su ID.
   */
  findById(id: string): Promise<Transaction | null>;

  /**
   * Busca una transacción por ID externo de la pasarela.
   * 
   * Por qué: Para reconciliación cuando recibimos webhooks.
   */
  findByExternalPaymentId(externalId: string): Promise<Transaction | null>;

  /**
   * Busca transacciones por criterios.
   */
  findMany(criteria: TransactionSearchCriteria): Promise<Transaction[]>;

  /**
   * Cuenta transacciones por criterios (para paginación).
   */
  count(criteria: TransactionSearchCriteria): Promise<number>;

  /**
   * Guarda una transacción.
   */
  save(transaction: Transaction): Promise<Transaction>;

  /**
   * Busca transacciones pendientes que expiraron.
   * 
   * Por qué CU-06: Para limpiar locks abandonados.
   * 
   * @param olderThanMinutes - Transacciones pendientes más viejas que esto
   */
  findExpiredPending(olderThanMinutes: number): Promise<Transaction[]>;

  /**
   * Obtiene resumen de transacciones por período (para Cierre de Caja).
   * 
   * Por qué CU-14: Reporte Z diario.
   */
  getDailySummary(
    locationId: string,
    date: Date,
  ): Promise<{
    totalTransactions: number;
    totalAmountCents: number;
    byStatus: Record<TransactionStatus, number>;
  }>;
}

export const TRANSACTION_REPOSITORY = 'ITransactionRepository';
