/**
 * ============================================================================
 * SMART_RETAIL Backend - Test Factories
 * ============================================================================
 * Fábricas tipadas para crear entidades en tests. Eliminan la necesidad
 * de `as any` y garantizan datos consistentes entre tests.
 * 
 * Por qué factories: DRY - Los tests comparten la misma lógica de creación,
 * y al cambiar la entidad solo se actualiza la factory, no 100 tests.
 * ============================================================================
 */

import { Device, DeviceStatus, DeviceType } from '@domain/entities/device.entity';
import { Product, ProductStatus } from '@domain/entities/product.entity';
import { Transaction, TransactionStatus } from '@domain/entities/transaction.entity';
import { User, UserRole } from '@domain/entities/user.entity';
import { Money } from '@domain/value-objects/money.value-object';

// ─────────────────────────────────────────────────────────────────────────────
// USER FACTORY
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateUserInput {
  id?: string;
  email?: string;
  fullName?: string;
  passwordHash?: string;
  role?: UserRole;
  walletBalanceCents?: number;
  locationId?: string;
  isActive?: boolean;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

let userCounter = 0;

/**
 * Crea una instancia de User con valores por defecto sensibles.
 * Usa patrón Builder simplificado para sobrescribir solo lo necesario.
 */
export function createTestUser(input: CreateUserInput = {}): User {
  userCounter++;
  const id = input.id ?? `user-${userCounter}-${Date.now()}`;
  
  return new User({
    id,
    email: input.email ?? `user${userCounter}@test.com`,
    fullName: input.fullName ?? `Test User ${userCounter}`,
    passwordHash: input.passwordHash ?? '$2b$10$hashedpassword',
    role: input.role ?? 'consumer',
    walletBalance: Money.fromCents(input.walletBalanceCents ?? 10000), // $100.00 por defecto
    locationId: input.locationId ?? 'location-default',
    isActive: input.isActive ?? true,
    lastLoginAt: input.lastLoginAt,
    createdAt: input.createdAt ?? new Date(),
    updatedAt: input.updatedAt ?? new Date(),
  });
}

/**
 * Crea un admin user para tests de permisos.
 */
export function createTestAdmin(input: Partial<CreateUserInput> = {}): User {
  return createTestUser({ ...input, role: 'admin' });
}

/**
 * Crea un merchant user.
 */
export function createTestMerchant(input: Partial<CreateUserInput> = {}): User {
  return createTestUser({ ...input, role: 'merchant' });
}

/**
 * Crea un operator user.
 */
export function createTestOperator(input: Partial<CreateUserInput> = {}): User {
  return createTestUser({ ...input, role: 'operator' });
}

// ─────────────────────────────────────────────────────────────────────────────
// DEVICE FACTORY
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateDeviceInput {
  id?: string;
  serialNumber?: string;
  name?: string;
  type?: DeviceType;
  status?: DeviceStatus;
  locationId?: string;
  config?: Record<string, unknown>;
  lastHeartbeat?: Date | null;
  deviceTokenHash?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

let deviceCounter = 0;

/**
 * Crea una instancia de Device para tests.
 */
export function createTestDevice(input: CreateDeviceInput = {}): Device {
  deviceCounter++;
  const id = input.id ?? `device-${deviceCounter}-${Date.now()}`;
  
  return new Device({
    id,
    serialNumber: input.serialNumber ?? `SN-${deviceCounter.toString().padStart(8, '0')}`,
    name: input.name ?? `Test Device ${deviceCounter}`,
    type: input.type ?? DeviceType.TURNSTILE,
    status: input.status ?? DeviceStatus.ONLINE,
    locationId: input.locationId ?? 'location-default',
    config: input.config ?? {},
    lastHeartbeat: input.lastHeartbeat ?? new Date(),
    deviceTokenHash: input.deviceTokenHash ?? null,
    createdAt: input.createdAt ?? new Date(),
    updatedAt: input.updatedAt ?? new Date(),
  });
}

/**
 * Crea un dispositivo OFFLINE.
 */
export function createOfflineDevice(input: Partial<CreateDeviceInput> = {}): Device {
  return createTestDevice({ ...input, status: DeviceStatus.OFFLINE });
}

/**
 * Crea un dispositivo en MAINTENANCE.
 */
export function createMaintenanceDevice(input: Partial<CreateDeviceInput> = {}): Device {
  return createTestDevice({ ...input, status: DeviceStatus.MAINTENANCE });
}

/**
 * Crea un dispositivo COMPROMISED.
 */
export function createCompromisedDevice(input: Partial<CreateDeviceInput> = {}): Device {
  return createTestDevice({ ...input, status: DeviceStatus.COMPROMISED });
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT FACTORY
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateProductInput {
  id?: string;
  sku?: string;
  name?: string;
  description?: string;
  priceCents?: number;
  stockQuantity?: number;
  lowStockThreshold?: number;
  locationId?: string;
  status?: ProductStatus;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

let productCounter = 0;

/**
 * Crea una instancia de Product para tests.
 */
export function createTestProduct(input: CreateProductInput = {}): Product {
  productCounter++;
  const id = input.id ?? `product-${productCounter}-${Date.now()}`;
  
  return new Product({
    id,
    sku: input.sku ?? `SKU-${productCounter.toString().padStart(6, '0')}`,
    name: input.name ?? `Test Product ${productCounter}`,
    description: input.description ?? 'A test product for unit tests',
    price: Money.fromCents(input.priceCents ?? 1000),
    stockQuantity: input.stockQuantity ?? 100,
    lowStockThreshold: input.lowStockThreshold ?? 10,
    locationId: input.locationId ?? 'location-default',
    status: input.status ?? ProductStatus.ACTIVE,
    isActive: input.isActive ?? true,
    createdAt: input.createdAt ?? new Date(),
    updatedAt: input.updatedAt ?? new Date(),
  });
}

/**
 * Crea un producto con stock bajo.
 */
export function createLowStockProduct(input: Partial<CreateProductInput> = {}): Product {
  return createTestProduct({
    ...input,
    stockQuantity: input.lowStockThreshold ?? 5,
  });
}

/**
 * Crea un producto sin stock.
 */
export function createOutOfStockProduct(input: Partial<CreateProductInput> = {}): Product {
  return createTestProduct({ ...input, stockQuantity: 0 });
}

/**
 * Crea un producto pausado.
 */
export function createPausedProduct(input: Partial<CreateProductInput> = {}): Product {
  return createTestProduct({ ...input, status: ProductStatus.PAUSED });
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSACTION FACTORY
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateTransactionInput {
  id?: string;
  userId?: string;
  deviceId?: string;
  productId?: string | null;
  locationId?: string;
  amountCents?: number;
  quantity?: number;
  status?: TransactionStatus;
  paymentInfo?: {
    externalId?: string | null;
    gateway?: 'MERCADOPAGO' | 'MODO' | null;
    method?: string | null;
    responseCode?: string | null;
    responseMessage?: string | null;
  };
  traceId?: string;
  createdAt?: Date;
  updatedAt?: Date;
  completedAt?: Date | null;
}

let transactionCounter = 0;

/**
 * Crea una instancia de Transaction para tests.
 */
export function createTestTransaction(input: CreateTransactionInput = {}): Transaction {
  transactionCounter++;
  const id = input.id ?? `tx-${transactionCounter}-${Date.now()}`;
  
  return new Transaction({
    id,
    userId: input.userId ?? 'user-test-default',
    deviceId: input.deviceId ?? 'device-test-default',
    productId: input.productId ?? null,
    locationId: input.locationId ?? 'location-default',
    amount: Money.fromCents(input.amountCents ?? 1000),
    quantity: input.quantity ?? 1,
    status: input.status ?? TransactionStatus.PENDING,
    paymentInfo: input.paymentInfo,
    traceId: input.traceId ?? `trace-${id}`,
    createdAt: input.createdAt ?? new Date(),
    updatedAt: input.updatedAt ?? new Date(),
    completedAt: input.completedAt ?? null,
  });
}

/**
 * Crea una transacción PAID (pago confirmado, esperando apertura).
 */
export function createPaidTransaction(input: Partial<CreateTransactionInput> = {}): Transaction {
  return createTestTransaction({
    ...input,
    status: TransactionStatus.PAID,
    paymentInfo: {
      externalId: 'mp-payment-123',
      gateway: 'MERCADOPAGO',
      method: 'credit_card',
      ...input.paymentInfo,
    },
  });
}

/**
 * Crea una transacción COMPLETED.
 */
export function createCompletedTransaction(input: Partial<CreateTransactionInput> = {}): Transaction {
  return createTestTransaction({
    ...input,
    status: TransactionStatus.COMPLETED,
    paymentInfo: {
      externalId: 'mp-payment-123',
      gateway: 'MERCADOPAGO',
      method: 'credit_card',
      ...input.paymentInfo,
    },
    completedAt: input.completedAt ?? new Date(),
  });
}

/**
 * Crea una transacción FAILED.
 */
export function createFailedTransaction(input: Partial<CreateTransactionInput> = {}): Transaction {
  return createTestTransaction({
    ...input,
    status: TransactionStatus.FAILED,
  });
}

/**
 * Crea una transacción reembolsada por fallo de hardware.
 */
export function createRefundedHwTransaction(input: Partial<CreateTransactionInput> = {}): Transaction {
  return createTestTransaction({
    ...input,
    status: TransactionStatus.REFUNDED_HW_FAILURE,
    paymentInfo: {
      externalId: 'mp-payment-123',
      gateway: 'MERCADOPAGO',
      ...input.paymentInfo,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK REPOSITORY FACTORIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tipo para mocks de repositorios con métodos básicos.
 */
export interface MockRepository<T> {
  findById: jest.Mock<Promise<T | null>>;
  findAll: jest.Mock<Promise<T[]>>;
  save: jest.Mock<Promise<T>>;
  update: jest.Mock<Promise<T>>;
  delete: jest.Mock<Promise<void>>;
}

/**
 * Crea un mock de repositorio genérico.
 */
export function createMockRepository<T>(): MockRepository<T> {
  return {
    findById: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

/**
 * Tipo para mocks de UserRepository con métodos específicos.
 */
export interface MockUserRepository extends MockRepository<User> {
  findByEmail: jest.Mock<Promise<User | null>>;
  updateBalance: jest.Mock<Promise<void>>;
}

/**
 * Crea un mock de UserRepository.
 */
export function createMockUserRepository(): MockUserRepository {
  return {
    ...createMockRepository<User>(),
    findByEmail: jest.fn(),
    updateBalance: jest.fn().mockResolvedValue(undefined),
  };
}

/**
 * Tipo para mocks de DeviceRepository con métodos específicos.
 */
export interface MockDeviceRepository extends MockRepository<Device> {
  findBySerialNumber: jest.Mock<Promise<Device | null>>;
  findByLocationId: jest.Mock<Promise<Device[]>>;
  updateStatus: jest.Mock<Promise<void>>;
  updateHeartbeat: jest.Mock<Promise<void>>;
}

/**
 * Crea un mock de DeviceRepository.
 */
export function createMockDeviceRepository(): MockDeviceRepository {
  return {
    ...createMockRepository<Device>(),
    findBySerialNumber: jest.fn(),
    findByLocationId: jest.fn().mockResolvedValue([]),
    updateStatus: jest.fn().mockResolvedValue(undefined),
    updateHeartbeat: jest.fn().mockResolvedValue(undefined),
  };
}

/**
 * Tipo para mocks de ProductRepository con métodos específicos.
 */
export interface MockProductRepository extends MockRepository<Product> {
  findBySku: jest.Mock<Promise<Product | null>>;
  findByLocationId: jest.Mock<Promise<Product[]>>;
  updateStock: jest.Mock<Promise<void>>;
  decrementStock: jest.Mock<Promise<boolean>>;
  incrementStock: jest.Mock<Promise<void>>;
}

/**
 * Crea un mock de ProductRepository.
 */
export function createMockProductRepository(): MockProductRepository {
  return {
    ...createMockRepository<Product>(),
    findBySku: jest.fn(),
    findByLocationId: jest.fn().mockResolvedValue([]),
    updateStock: jest.fn().mockResolvedValue(undefined),
    decrementStock: jest.fn().mockResolvedValue(true),
    incrementStock: jest.fn().mockResolvedValue(undefined),
  };
}

/**
 * Tipo para mocks de TransactionRepository con métodos específicos.
 */
export interface MockTransactionRepository extends MockRepository<Transaction> {
  findByUserId: jest.Mock<Promise<Transaction[]>>;
  findByDeviceId: jest.Mock<Promise<Transaction[]>>;
  findByIdempotencyKey: jest.Mock<Promise<Transaction | null>>;
  updateStatus: jest.Mock<Promise<void>>;
}

/**
 * Crea un mock de TransactionRepository.
 */
export function createMockTransactionRepository(): MockTransactionRepository {
  return {
    ...createMockRepository<Transaction>(),
    findByUserId: jest.fn().mockResolvedValue([]),
    findByDeviceId: jest.fn().mockResolvedValue([]),
    findByIdempotencyKey: jest.fn(),
    updateStatus: jest.fn().mockResolvedValue(undefined),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RESET COUNTERS (para beforeEach)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reinicia los contadores de factories.
 * Usar en beforeEach() para IDs predecibles.
 */
export function resetFactoryCounters(): void {
  userCounter = 0;
  deviceCounter = 0;
  productCounter = 0;
  transactionCounter = 0;
}
