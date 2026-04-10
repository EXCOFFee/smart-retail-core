/**
 * ============================================================================
 * SMART_RETAIL - ProcessAccessService Unit Tests
 * ============================================================================
 * Tests unitarios para el caso de uso principal: procesar acceso QR.
 * 
 * ESTRATEGIA DE TESTING:
 * - Mocks para todos los puertos (DI)
 * - Casos de éxito y error
 * - Cobertura de edge cases
 * - Verificación de rollback en fallos
 * 
 * NOTA: Los mocks usan `as unknown as` para flexibilidad en testing.
 * En tests reales, solo mockear los métodos necesarios para cada test.
 * ============================================================================
 */

import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { ProcessAccessInput } from '@application/ports/input/process-access.use-case';
import { DEVICE_GATEWAY_PORT } from '@application/ports/output/device-gateway.port';
import { PAYMENT_GATEWAY_PORT } from '@application/ports/output/payment-gateway.port';
import { DEVICE_REPOSITORY, PRODUCT_REPOSITORY, TRANSACTION_REPOSITORY, USER_REPOSITORY } from '@application/ports/output/repositories.port';
import { STOCK_CACHE_PORT } from '@application/ports/output/stock-cache.port';
import { ProcessAccessService } from '@application/use-cases/process-access.service';

import { Device, DeviceStatus, DeviceType } from '@domain/entities/device.entity';
import { Product } from '@domain/entities/product.entity';
import { User } from '@domain/entities/user.entity';
import { Money } from '@domain/value-objects/money.value-object';

import {
    MockConfigService,
    MockDeviceGateway,
    MockPaymentGateway,
    MockStockCache,
    createMockConfigService,
    createMockDeviceGateway,
    createMockPaymentGateway,
    createMockStockCache
} from '../../utils';

describe('ProcessAccessService', () => {
  let service: ProcessAccessService;
  
  // Mocks tipados correctamente
  let stockCacheMock: MockStockCache;
  let paymentGatewayMock: MockPaymentGateway;
  let deviceGatewayMock: MockDeviceGateway;
  let userRepositoryMock: {
    findById: jest.Mock;
    findByEmail: jest.Mock;
    save: jest.Mock;
    updateBalance: jest.Mock;
  };
  let productRepositoryMock: {
    findById: jest.Mock;
    findBySkuAndLocation: jest.Mock;
    findMany: jest.Mock;
    save: jest.Mock;
    updateStockWithVersion: jest.Mock;
  };
  let deviceRepositoryMock: {
    findById: jest.Mock;
    findBySerialNumber: jest.Mock;
    findByLocationId: jest.Mock;
    findActive: jest.Mock;
    save: jest.Mock;
    updateStatus: jest.Mock;
    updateHeartbeat: jest.Mock;
    findStaleDevices: jest.Mock;
  };
  let transactionRepositoryMock: {
    findById: jest.Mock;
    findByExternalPaymentId: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    save: jest.Mock;
    findExpiredPending: jest.Mock;
    getDailySummary: jest.Mock;
  };
  let configServiceMock: MockConfigService;

  // ─────────────────────────────────────────────────────────────────────────
  // TEST DATA FACTORIES
  // ─────────────────────────────────────────────────────────────────────────

  const createTestUser = (overrides: { walletBalance?: Money } = {}): User => {
    return new User({
      id: 'user-123',
      email: 'test@example.com',
      fullName: 'Test User',
      passwordHash: 'hashed-password',
      role: 'consumer',
      walletBalance: overrides.walletBalance ?? Money.fromCents(10000), // $100.00
      locationId: 'location-1',
      isActive: true,
    });
  };

  const createTestProduct = (overrides: { 
    stockQuantity?: number; 
    price?: Money 
  } = {}): Product => {
    return new Product({
      id: 'product-123',
      sku: 'PROD-001',
      name: 'Test Product',
      price: overrides.price ?? Money.fromCents(1500), // $15.00
      stockQuantity: overrides.stockQuantity ?? 100,
      locationId: 'location-1',
    });
  };

  const createTestDevice = (overrides: { status?: DeviceStatus } = {}): Device => {
    return new Device({
      id: 'device-123',
      serialNumber: 'DEV-001',
      name: 'Test Turnstile',
      type: DeviceType.TURNSTILE,
      status: overrides.status ?? DeviceStatus.ONLINE,
      locationId: 'location-1',
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SETUP
  // ─────────────────────────────────────────────────────────────────────────

  beforeEach(async () => {
    // Create mocks using factory functions
    stockCacheMock = createMockStockCache();
    paymentGatewayMock = createMockPaymentGateway();
    deviceGatewayMock = createMockDeviceGateway();

    userRepositoryMock = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      save: jest.fn(),
      updateBalance: jest.fn(),
    };

    productRepositoryMock = {
      findById: jest.fn(),
      findBySkuAndLocation: jest.fn(),
      findMany: jest.fn(),
      save: jest.fn(),
      updateStockWithVersion: jest.fn(),
    };

    deviceRepositoryMock = {
      findById: jest.fn(),
      findBySerialNumber: jest.fn(),
      findByLocationId: jest.fn(),
      findActive: jest.fn(),
      save: jest.fn(),
      updateStatus: jest.fn(),
      updateHeartbeat: jest.fn(),
      findStaleDevices: jest.fn(),
    };

    transactionRepositoryMock = {
      findById: jest.fn(),
      findByExternalPaymentId: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      save: jest.fn(),
      findExpiredPending: jest.fn(),
      getDailySummary: jest.fn(),
    };

    configServiceMock = createMockConfigService({
      HARDWARE_ACK_TIMEOUT_MS: 5000,
      PAYMENT_TIMEOUT_MS: 3000,
      MAX_RETRY_ATTEMPTS: 3,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessAccessService,
        { provide: STOCK_CACHE_PORT, useValue: stockCacheMock },
        { provide: PAYMENT_GATEWAY_PORT, useValue: paymentGatewayMock },
        { provide: DEVICE_GATEWAY_PORT, useValue: deviceGatewayMock },
        { provide: USER_REPOSITORY, useValue: userRepositoryMock },
        { provide: PRODUCT_REPOSITORY, useValue: productRepositoryMock },
        { provide: DEVICE_REPOSITORY, useValue: deviceRepositoryMock },
        { provide: TRANSACTION_REPOSITORY, useValue: transactionRepositoryMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<ProcessAccessService>(ProcessAccessService);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // HAPPY PATH TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe('Happy Path - CU-01', () => {
    it('should complete access successfully with payment', async () => {
      // Arrange
      const user = createTestUser();
      const product = createTestProduct();
      const device = createTestDevice();

      userRepositoryMock.findById.mockResolvedValue(user);
      productRepositoryMock.findById.mockResolvedValue(product);
      deviceRepositoryMock.findById.mockResolvedValue(device);
      deviceGatewayMock.isDeviceConnected.mockResolvedValue(true);
      stockCacheMock.acquireLock.mockResolvedValue({
        success: true,
        availableStock: 100,
        lockKey: 'lock-123',
        ttlSeconds: 30,
      });
      paymentGatewayMock.charge.mockResolvedValue({
        success: true,
        externalId: 'mp-123456',
        status: 'approved',
        paymentMethod: 'account_money',
        responseCode: 'accredited',
        responseMessage: 'Pago acreditado',
      });
      deviceGatewayMock.openAndWaitConfirmation.mockResolvedValue(true);
      transactionRepositoryMock.save.mockImplementation((t: unknown) => Promise.resolve(t));
      stockCacheMock.releaseLock.mockResolvedValue(true);

      const input: ProcessAccessInput = {
        userId: 'user-123',
        deviceId: 'device-123',
        productId: 'product-123',
        quantity: 1,
        traceId: 'trace-001',
      };

      // Act
      const result = await service.execute(input);

      // Assert
      expect(result.status).toBe('COMPLETED');
      expect(result.transactionId).toBeDefined();
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should complete access-only without product', async () => {
      // Arrange
      const user = createTestUser();
      const device = createTestDevice();

      userRepositoryMock.findById.mockResolvedValue(user);
      deviceRepositoryMock.findById.mockResolvedValue(device);
      deviceGatewayMock.isDeviceConnected.mockResolvedValue(true);
      deviceGatewayMock.openAndWaitConfirmation.mockResolvedValue(true);
      transactionRepositoryMock.save.mockImplementation((t: unknown) => Promise.resolve(t));

      const input: ProcessAccessInput = {
        userId: 'user-123',
        deviceId: 'device-123',
        traceId: 'trace-002',
        // No productId - access only
      };

      // Act
      const result = await service.execute(input);

      // Assert
      expect(result.status).toBe('COMPLETED');
      expect(result.amountCharged).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ERROR CASES
  // ─────────────────────────────────────────────────────────────────────────

  describe('Error Cases', () => {
    it('should fail when device is offline - CU-07', async () => {
      // Arrange
      const user = createTestUser();
      const device = createTestDevice({ status: DeviceStatus.OFFLINE });

      userRepositoryMock.findById.mockResolvedValue(user);
      deviceRepositoryMock.findById.mockResolvedValue(device);
      deviceGatewayMock.isDeviceConnected.mockResolvedValue(false);

      const input: ProcessAccessInput = {
        userId: 'user-123',
        deviceId: 'device-123',
        productId: 'product-123',
        traceId: 'trace-003',
      };

      // Act & Assert
      await expect(service.execute(input)).rejects.toThrow();
    });

    it('should fail when device is online in DB but not connected via WebSocket', async () => {
      // Arrange - device is ONLINE in DB but WebSocket reports disconnected
      const device = createTestDevice({ status: DeviceStatus.ONLINE });

      deviceRepositoryMock.findById.mockResolvedValue(device);
      deviceGatewayMock.isDeviceConnected.mockResolvedValue(false); // Not responding to WebSocket

      const input: ProcessAccessInput = {
        userId: 'user-123',
        deviceId: 'device-123',
        productId: 'product-123',
        traceId: 'trace-ws-disconnected',
      };

      // Act & Assert - Should throw DeviceNotOperationalException with DISCONNECTED
      await expect(service.execute(input)).rejects.toThrow();
    });

    it('should fail when stock lock cannot be acquired - CU-05', async () => {
      // Arrange
      const user = createTestUser();
      const product = createTestProduct();
      const device = createTestDevice();

      userRepositoryMock.findById.mockResolvedValue(user);
      productRepositoryMock.findById.mockResolvedValue(product);
      deviceRepositoryMock.findById.mockResolvedValue(device);
      deviceGatewayMock.isDeviceConnected.mockResolvedValue(true);
      stockCacheMock.acquireLock.mockResolvedValue({
        success: false,
        availableStock: 0,
        lockKey: null,
        ttlSeconds: 0,
      });

      const input: ProcessAccessInput = {
        userId: 'user-123',
        deviceId: 'device-123',
        productId: 'product-123',
        traceId: 'trace-004',
      };

      // Act & Assert
      await expect(service.execute(input)).rejects.toThrow();
    });

    it('should fail when user has insufficient balance - CU-02', async () => {
      // Arrange
      const user = createTestUser({ walletBalance: Money.fromCents(100) }); // Only $1.00
      const product = createTestProduct({ price: Money.fromCents(5000) }); // $50.00
      const device = createTestDevice();

      userRepositoryMock.findById.mockResolvedValue(user);
      productRepositoryMock.findById.mockResolvedValue(product);
      deviceRepositoryMock.findById.mockResolvedValue(device);
      deviceGatewayMock.isDeviceConnected.mockResolvedValue(true);
      // Note: acquireLock is not called because balance check happens BEFORE lock acquisition
      stockCacheMock.getStock.mockResolvedValue(100); // Sufficient stock

      const input: ProcessAccessInput = {
        userId: 'user-123',
        deviceId: 'device-123',
        productId: 'product-123',
        traceId: 'trace-005',
      };

      // Act & Assert
      await expect(service.execute(input)).rejects.toThrow();
      
      // Verify lock was NOT acquired (fail-fast before lock acquisition)
      expect(stockCacheMock.acquireLock).not.toHaveBeenCalled();
    });

    it('should fail and release lock when payment is rejected - CU-02', async () => {
      // Arrange
      const user = createTestUser();
      const product = createTestProduct();
      const device = createTestDevice();

      userRepositoryMock.findById.mockResolvedValue(user);
      productRepositoryMock.findById.mockResolvedValue(product);
      deviceRepositoryMock.findById.mockResolvedValue(device);
      deviceGatewayMock.isDeviceConnected.mockResolvedValue(true);
      stockCacheMock.acquireLock.mockResolvedValue({
        success: true,
        availableStock: 100,
        lockKey: 'lock-123',
        ttlSeconds: 30,
      });
      paymentGatewayMock.charge.mockResolvedValue({
        success: false,
        externalId: null,
        status: 'rejected',
        paymentMethod: null,
        responseCode: 'cc_rejected_insufficient_amount',
        responseMessage: 'Fondos insuficientes',
      });
      stockCacheMock.releaseLock.mockResolvedValue(true);

      const input: ProcessAccessInput = {
        userId: 'user-123',
        deviceId: 'device-123',
        productId: 'product-123',
        traceId: 'trace-006',
      };

      // Act & Assert
      await expect(service.execute(input)).rejects.toThrow();
      
      // Verify lock was released
      expect(stockCacheMock.releaseLock).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ROLLBACK TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe('Rollback Scenarios', () => {
    it('should refund and release lock when device fails to open - CU-04', async () => {
      // Arrange
      const user = createTestUser();
      const product = createTestProduct();
      const device = createTestDevice();

      userRepositoryMock.findById.mockResolvedValue(user);
      productRepositoryMock.findById.mockResolvedValue(product);
      deviceRepositoryMock.findById.mockResolvedValue(device);
      deviceGatewayMock.isDeviceConnected.mockResolvedValue(true);
      stockCacheMock.acquireLock.mockResolvedValue({
        success: true,
        availableStock: 100,
        lockKey: 'lock-123',
        ttlSeconds: 30,
      });
      paymentGatewayMock.charge.mockResolvedValue({
        success: true,
        externalId: 'mp-123456',
        status: 'approved',
        paymentMethod: 'account_money',
        responseCode: 'accredited',
        responseMessage: 'Pago acreditado',
      });
      
      // Device fails to open/ACK
      deviceGatewayMock.openAndWaitConfirmation.mockResolvedValue(false);
      
      // Refund should succeed
      paymentGatewayMock.refund.mockResolvedValue({
        success: true,
        refundId: 'refund-123',
        status: 'approved',
        message: 'Refund successful',
      });
      
      transactionRepositoryMock.save.mockImplementation((t: unknown) => Promise.resolve(t));
      stockCacheMock.releaseLock.mockResolvedValue(true);

      const input: ProcessAccessInput = {
        userId: 'user-123',
        deviceId: 'device-123',
        productId: 'product-123',
        traceId: 'trace-007',
      };

      // Act
      const result = await service.execute(input);

      // Assert - Transaction should be marked as failed/refunded
      expect(result.status).toBe('FAILED');
      
      // Verify rollback happened
      expect(paymentGatewayMock.refund).toHaveBeenCalled();
      expect(stockCacheMock.releaseLock).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // QR VALIDATION TESTS - CU-08
  // ─────────────────────────────────────────────────────────────────────────

  describe('QR Validation - CU-08', () => {
    it('should accept valid QR payload', async () => {
      // Arrange
      const user = createTestUser();
      const device = createTestDevice();

      userRepositoryMock.findById.mockResolvedValue(user);
      deviceRepositoryMock.findById.mockResolvedValue(device);
      deviceGatewayMock.isDeviceConnected.mockResolvedValue(true);
      deviceGatewayMock.openAndWaitConfirmation.mockResolvedValue(true);
      transactionRepositoryMock.save.mockImplementation((t: unknown) => Promise.resolve(t));

      const input: ProcessAccessInput = {
        userId: 'user-123',
        deviceId: 'device-123',
        traceId: 'trace-qr-valid',
        qrPayload: {
          timestamp: new Date(), // Fresh QR
          nonce: 'unique-nonce-123',
        },
      };

      // Act
      const result = await service.execute(input);

      // Assert
      expect(result.status).toBe('COMPLETED');
    });

    it('should reject expired QR payload', async () => {
      // Arrange
      const user = createTestUser();
      const device = createTestDevice();

      userRepositoryMock.findById.mockResolvedValue(user);
      deviceRepositoryMock.findById.mockResolvedValue(device);

      const expiredTime = new Date();
      expiredTime.setSeconds(expiredTime.getSeconds() - 120); // 2 minutes ago

      const input: ProcessAccessInput = {
        userId: 'user-123',
        deviceId: 'device-123',
        traceId: 'trace-qr-expired',
        qrPayload: {
          timestamp: expiredTime,
          nonce: 'expired-nonce',
        },
      };

      // Act & Assert
      await expect(service.execute(input)).rejects.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // EDGE CASES
  // ─────────────────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('should fail when user not found', async () => {
      const device = createTestDevice();
      deviceRepositoryMock.findById.mockResolvedValue(device);
      deviceGatewayMock.isDeviceConnected.mockResolvedValue(true);
      userRepositoryMock.findById.mockResolvedValue(null);

      const input: ProcessAccessInput = {
        userId: 'non-existent-user',
        deviceId: 'device-123',
        traceId: 'trace-no-user',
      };

      await expect(service.execute(input)).rejects.toThrow();
    });

    it('should fail when device not found', async () => {
      const user = createTestUser();
      userRepositoryMock.findById.mockResolvedValue(user);
      deviceRepositoryMock.findById.mockResolvedValue(null);

      const input: ProcessAccessInput = {
        userId: 'user-123',
        deviceId: 'non-existent-device',
        traceId: 'trace-no-device',
      };

      await expect(service.execute(input)).rejects.toThrow();
    });

    it('should fail when product not found', async () => {
      const user = createTestUser();
      const device = createTestDevice();

      userRepositoryMock.findById.mockResolvedValue(user);
      deviceRepositoryMock.findById.mockResolvedValue(device);
      deviceGatewayMock.isDeviceConnected.mockResolvedValue(true);
      productRepositoryMock.findById.mockResolvedValue(null);

      const input: ProcessAccessInput = {
        userId: 'user-123',
        deviceId: 'device-123',
        productId: 'non-existent-product',
        traceId: 'trace-no-product',
      };

      await expect(service.execute(input)).rejects.toThrow();
    });

    it('should fail when user has insufficient balance', async () => {
      const poorUser = createTestUser({ walletBalance: Money.fromCents(100) }); // Only $1
      const expensiveProduct = createTestProduct({ price: Money.fromCents(10000) }); // $100
      const device = createTestDevice();

      userRepositoryMock.findById.mockResolvedValue(poorUser);
      productRepositoryMock.findById.mockResolvedValue(expensiveProduct);
      deviceRepositoryMock.findById.mockResolvedValue(device);
      deviceGatewayMock.isDeviceConnected.mockResolvedValue(true);

      const input: ProcessAccessInput = {
        userId: 'user-123',
        deviceId: 'device-123',
        productId: 'product-123',
        traceId: 'trace-poor-user',
      };

      await expect(service.execute(input)).rejects.toThrow();
    });

    it('should fail when cached stock is insufficient', async () => {
      const user = createTestUser();
      const product = createTestProduct();
      const device = createTestDevice();

      userRepositoryMock.findById.mockResolvedValue(user);
      productRepositoryMock.findById.mockResolvedValue(product);
      deviceRepositoryMock.findById.mockResolvedValue(device);
      deviceGatewayMock.isDeviceConnected.mockResolvedValue(true);
      stockCacheMock.getStock.mockResolvedValue(0); // No stock in cache

      const input: ProcessAccessInput = {
        userId: 'user-123',
        deviceId: 'device-123',
        productId: 'product-123',
        quantity: 5,
        traceId: 'trace-no-stock',
      };

      await expect(service.execute(input)).rejects.toThrow();
    });

    it('should handle lock release error gracefully on rollback', async () => {
      const user = createTestUser();
      const product = createTestProduct();
      const device = createTestDevice();

      userRepositoryMock.findById.mockResolvedValue(user);
      productRepositoryMock.findById.mockResolvedValue(product);
      deviceRepositoryMock.findById.mockResolvedValue(device);
      deviceGatewayMock.isDeviceConnected.mockResolvedValue(true);
      stockCacheMock.acquireLock.mockResolvedValue({
        success: true,
        availableStock: 100,
        lockKey: 'lock-123',
        ttlSeconds: 30,
      });
      // Payment fails
      paymentGatewayMock.charge.mockRejectedValue(new Error('Payment gateway timeout'));
      // Lock release also fails
      stockCacheMock.releaseLock.mockRejectedValue(new Error('Redis connection lost'));

      const input: ProcessAccessInput = {
        userId: 'user-123',
        deviceId: 'device-123',
        productId: 'product-123',
        traceId: 'trace-lock-release-fail',
      };

      // Should still throw the original error, not the lock release error
      await expect(service.execute(input)).rejects.toThrow('Payment gateway timeout');
    });

    it('should handle refund error during hardware failure rollback', async () => {
      const user = createTestUser();
      const product = createTestProduct();
      const device = createTestDevice();

      userRepositoryMock.findById.mockResolvedValue(user);
      productRepositoryMock.findById.mockResolvedValue(product);
      deviceRepositoryMock.findById.mockResolvedValue(device);
      deviceGatewayMock.isDeviceConnected.mockResolvedValue(true);
      stockCacheMock.acquireLock.mockResolvedValue({
        success: true,
        availableStock: 100,
        lockKey: 'lock-123',
        ttlSeconds: 30,
      });
      paymentGatewayMock.charge.mockResolvedValue({
        success: true,
        externalId: 'mp-123456',
        status: 'approved',
        paymentMethod: 'account_money',
        responseCode: 'accredited',
        responseMessage: 'Pago acreditado',
      });
      // Hardware fails
      deviceGatewayMock.openAndWaitConfirmation.mockResolvedValue(false);
      // Refund also fails
      paymentGatewayMock.refund.mockRejectedValue(new Error('Refund service unavailable'));
      stockCacheMock.releaseLock.mockResolvedValue(true);
      transactionRepositoryMock.save.mockImplementation((t: unknown) => Promise.resolve(t));

      const input: ProcessAccessInput = {
        userId: 'user-123',
        deviceId: 'device-123',
        productId: 'product-123',
        traceId: 'trace-refund-fail',
      };

      // Should complete but with FAILED status
      const result = await service.execute(input);
      expect(result.status).toBe('FAILED');
    });
  });
});
