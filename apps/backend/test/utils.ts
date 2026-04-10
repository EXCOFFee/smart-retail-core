/**
 * ============================================================================
 * SMART_RETAIL Backend - Test Utilities
 * ============================================================================
 * Tipos y funciones helper para tests que eliminan la necesidad de `as any`.
 * ============================================================================
 */

import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Socket } from 'socket.io';
import { UpdateResult } from 'typeorm';

/**
 * Tipo para mocks parciales que mantiene type safety.
 * Uso: createMock<MyService>({ method: jest.fn() })
 */
export type MockType<T> = {
  [P in keyof T]?: jest.Mock;
};

/**
 * Tipo para mocks parciales profundos.
 */
export type DeepMockType<T> = {
  [P in keyof T]?: T[P] extends (...args: unknown[]) => unknown
    ? jest.Mock
    : DeepMockType<T[P]>;
};

/**
 * Crea un mock parcial con type safety.
 */
export function createMock<T>(partial: Partial<MockType<T>> = {}): MockType<T> {
  return partial as MockType<T>;
}

/**
 * Crea un UpdateResult tipado para TypeORM.
 */
export function createUpdateResult(affected: number): UpdateResult {
  return {
    raw: [],
    affected,
    generatedMaps: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK INTERFACE TYPES (para evitar `any`)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mock de StockCachePort para tests.
 */
export interface MockStockCache {
  getStock: jest.Mock;
  setStock: jest.Mock;
  decrementStock: jest.Mock;
  incrementStock: jest.Mock;
  acquireLock: jest.Mock;
  releaseLock: jest.Mock;
  extendLock: jest.Mock;
  invalidateStock: jest.Mock;
}

export function createMockStockCache(): MockStockCache {
  return {
    getStock: jest.fn(),
    setStock: jest.fn(),
    decrementStock: jest.fn(),
    incrementStock: jest.fn(),
    acquireLock: jest.fn(),
    releaseLock: jest.fn(),
    extendLock: jest.fn(),
    invalidateStock: jest.fn(),
  };
}

/**
 * Mock de PaymentGatewayPort para tests.
 */
export interface MockPaymentGateway {
  gatewayName: string;
  charge: jest.Mock;
  refund: jest.Mock;
  getTransactionStatus: jest.Mock;
  isAvailable: jest.Mock;
}

export function createMockPaymentGateway(name = 'MERCADOPAGO'): MockPaymentGateway {
  return {
    gatewayName: name,
    charge: jest.fn(),
    refund: jest.fn(),
    getTransactionStatus: jest.fn(),
    isAvailable: jest.fn(),
  };
}

/**
 * Mock de DeviceGatewayPort para tests.
 */
export interface MockDeviceGateway {
  sendCommand: jest.Mock;
  isDeviceConnected: jest.Mock;
  onDeviceEvent: jest.Mock;
  openAndWaitConfirmation: jest.Mock;
  forceDisconnect: jest.Mock;
}

export function createMockDeviceGateway(): MockDeviceGateway {
  return {
    sendCommand: jest.fn(),
    isDeviceConnected: jest.fn(),
    onDeviceEvent: jest.fn(),
    openAndWaitConfirmation: jest.fn(),
    forceDisconnect: jest.fn(),
  };
}

/**
 * Mock de ConfigService para tests.
 */
export interface MockConfigService {
  get: jest.Mock;
  getOrThrow: jest.Mock;
}

export function createMockConfigService(
  config: Record<string, unknown> = {}
): MockConfigService {
  return {
    get: jest.fn((key: string, defaultValue?: unknown) => config[key] ?? defaultValue),
    getOrThrow: jest.fn((key: string) => {
      if (key in config) return config[key];
      throw new Error(`Config key not found: ${key}`);
    }),
  };
}

/**
 * Crea un mock de Socket.io Socket tipado.
 */
export function createMockSocket(overrides: Partial<Socket> = {}): Partial<Socket> {
  return {
    id: 'socket-test-id',
    handshake: {
      headers: {},
      query: {},
      auth: {},
      time: new Date().toISOString(),
      address: '127.0.0.1',
      xdomain: false,
      secure: false,
      issued: Date.now(),
      url: '/',
    },
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
    disconnect: jest.fn(),
    ...overrides,
  } as Partial<Socket>;
}

/**
 * Crea un mock de ExecutionContext de NestJS.
 */
export function createMockExecutionContext(
  overrides: {
    type?: 'http' | 'ws';
    request?: Partial<Request>;
    socket?: Partial<{ remoteAddress: string }>;
    handler?: { name: string };
    class?: { name: string };
  } = {}
): ExecutionContext {
  const request = {
    headers: {},
    ip: '127.0.0.1',
    ...overrides.request,
  };

  const socket = {
    remoteAddress: '127.0.0.1',
    ...overrides.socket,
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => jest.fn(),
    }),
    switchToWs: () => ({
      getClient: () => ({ conn: { remoteAddress: socket.remoteAddress } }),
      getData: () => ({}),
    }),
    getType: () => overrides.type ?? 'http',
    getClass: () => ({ name: overrides.class?.name ?? 'TestController' }),
    getHandler: () => ({ name: overrides.handler?.name ?? 'testMethod' }),
    getArgs: () => [],
    getArgByIndex: () => null,
    switchToRpc: () => ({
      getContext: () => ({}),
      getData: () => ({}),
    }),
  } as unknown as ExecutionContext;
}

/**
 * Crea un mock de CallHandler de NestJS para interceptores.
 */
export function createMockCallHandler(returnValue?: unknown): CallHandler {
  return {
    handle: jest.fn().mockReturnValue({
      pipe: jest.fn().mockReturnThis(),
      subscribe: jest.fn((callbacks) => {
        if (callbacks?.next) {
          callbacks.next(returnValue);
        }
        if (callbacks?.complete) {
          callbacks.complete();
        }
        return { unsubscribe: jest.fn() };
      }),
    }),
  };
}

/**
 * Tipo para payloads de JWT en tests.
 */
export interface TestJwtPayload {
  sub: string;
  email: string;
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  iat?: number;
  exp?: number;
}

/**
 * Crea un payload JWT válido para tests.
 */
export function createTestJwtPayload(
  overrides: Partial<TestJwtPayload> = {}
): TestJwtPayload {
  return {
    sub: 'test-user-id',
    email: 'test@example.com',
    role: 'ADMIN',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
}

/**
 * Tipo para estados de transacción en tests.
 */
export type TestTransactionStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED';

/**
 * Tipo para resumen de estadísticas en tests.
 */
export interface TestStatsSummary {
  total: number;
  byStatus: Partial<Record<TestTransactionStatus, number>>;
  revenue?: number;
}

/**
 * Crea un mock de resumen de estadísticas para tests.
 */
export function createTestStatsSummary(
  overrides: Partial<TestStatsSummary> = {}
): TestStatsSummary {
  return {
    total: 10,
    byStatus: { COMPLETED: 8, PENDING: 2 },
    revenue: 1000,
    ...overrides,
  };
}
