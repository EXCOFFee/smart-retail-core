/**
 * ============================================================================
 * SMART_RETAIL - Domain Exceptions Tests
 * ============================================================================
 * Tests unitarios para todas las excepciones del dominio.
 * ============================================================================
 */

import {
    DeviceNotOperationalException,
    DomainException,
    InsufficientBalanceException,
    PaymentGatewayException,
    QrExpiredException,
    SecurityBreachException,
    SecurityBreachType,
    StockInsufficientException,
    StockLockConflictException,
} from '../../../src/domain/exceptions';
import { DeviceAlreadyExistsException } from '../../../src/domain/exceptions/device-already-exists.exception';

// ─────────────────────────────────────────────────────────────────────────────
// Concrete implementation for testing DomainException (abstract class)
// ─────────────────────────────────────────────────────────────────────────────

class TestDomainException extends DomainException {
  readonly code = 'TEST_ERROR';
  readonly httpStatus = 400;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
  }
}

describe('Domain Exceptions', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // DomainException (Base)
  // ─────────────────────────────────────────────────────────────────────────

  describe('DomainException', () => {
    it('should create with message and code', () => {
      const exception = new TestDomainException('Test error');

      expect(exception.message).toBe('Test error');
      expect(exception.code).toBe('TEST_ERROR');
      expect(exception.httpStatus).toBe(400);
      expect(exception.name).toBe('TestDomainException');
    });

    it('should include details', () => {
      const exception = new TestDomainException('Test', { userId: '123', action: 'buy' });

      expect(exception.details).toEqual({ userId: '123', action: 'buy' });
    });

    it('should default details to empty object', () => {
      const exception = new TestDomainException('Test');

      expect(exception.details).toEqual({});
    });

    it('should serialize to JSON correctly', () => {
      const exception = new TestDomainException('Test error', { foo: 'bar' });
      const json = exception.toJSON();

      expect(json).toEqual({
        name: 'TestDomainException',
        code: 'TEST_ERROR',
        message: 'Test error',
        details: { foo: 'bar' },
      });
    });

    it('should be instanceof Error', () => {
      const exception = new TestDomainException('Test');

      expect(exception).toBeInstanceOf(Error);
      expect(exception).toBeInstanceOf(DomainException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DeviceAlreadyExistsException
  // ─────────────────────────────────────────────────────────────────────────

  describe('DeviceAlreadyExistsException', () => {
    it('should create with serial number', () => {
      const exception = new DeviceAlreadyExistsException('SN-001');

      expect(exception.code).toBe('DEVICE_ALREADY_EXISTS');
      expect(exception.httpStatus).toBe(409);
      expect(exception.serialNumber).toBe('SN-001');
      expect(exception.message).toContain('SN-001');
    });

    it('should include serialNumber in details', () => {
      const exception = new DeviceAlreadyExistsException('SN-002');

      expect(exception.details.serialNumber).toBe('SN-002');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DeviceNotOperationalException
  // ─────────────────────────────────────────────────────────────────────────

  describe('DeviceNotOperationalException', () => {
    it('should create with device info', () => {
      const exception = new DeviceNotOperationalException(
        'device-001',
        'Molinete Principal',
        'OFFLINE',
      );

      expect(exception.code).toBe('DEVICE_NOT_OPERATIONAL');
      expect(exception.httpStatus).toBe(503);
      expect(exception.deviceId).toBe('device-001');
      expect(exception.deviceName).toBe('Molinete Principal');
      expect(exception.deviceStatus).toBe('OFFLINE');
    });

    it('should include custom reason', () => {
      const exception = new DeviceNotOperationalException(
        'device-001',
        'Molinete',
        'MAINTENANCE',
        'Scheduled maintenance',
      );

      expect(exception.details.reason).toBe('Scheduled maintenance');
    });

    it('should have default reason when not provided', () => {
      const exception = new DeviceNotOperationalException(
        'device-001',
        'Molinete',
        'OFFLINE',
      );

      expect(exception.details.reason).toBe('Device is offline or under maintenance');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // InsufficientBalanceException
  // ─────────────────────────────────────────────────────────────────────────

  describe('InsufficientBalanceException', () => {
    it('should create with balance info', () => {
      const exception = new InsufficientBalanceException('user-001', 500, 1000);

      expect(exception.code).toBe('INSUFFICIENT_BALANCE');
      expect(exception.httpStatus).toBe(402);
      expect(exception.userId).toBe('user-001');
      expect(exception.currentBalance).toBe(500);
      expect(exception.requiredAmount).toBe(1000);
    });

    it('should calculate deficit in details', () => {
      const exception = new InsufficientBalanceException('user-001', 300, 1000);

      expect(exception.details.deficit).toBe(700);
    });

    it('should include all data in message', () => {
      const exception = new InsufficientBalanceException('user-001', 500, 1000);

      expect(exception.message).toContain('user-001');
      expect(exception.message).toContain('500');
      expect(exception.message).toContain('1000');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PaymentGatewayException
  // ─────────────────────────────────────────────────────────────────────────

  describe('PaymentGatewayException', () => {
    it('should create with gateway info', () => {
      const exception = new PaymentGatewayException(
        'MERCADOPAGO',
        'TIMEOUT',
        'Connection timeout',
      );

      expect(exception.code).toBe('PAYMENT_TIMEOUT');
      expect(exception.gatewayName).toBe('MERCADOPAGO');
      expect(exception.responseCode).toBe('TIMEOUT');
    });

    it('should set httpStatus 502 for technical errors', () => {
      const exception = new PaymentGatewayException(
        'MODO',
        'NETWORK_ERROR',
        'Network failure',
      );

      expect(exception.httpStatus).toBe(502);
      expect(exception.isUserDeclined).toBe(false);
    });

    it('should set httpStatus 402 for user rejections (cc_rejected)', () => {
      const exception = new PaymentGatewayException(
        'MERCADOPAGO',
        'cc_rejected_insufficient_amount',
        'Insufficient funds',
      );

      expect(exception.httpStatus).toBe(402);
      expect(exception.isUserDeclined).toBe(true);
    });

    it('should set httpStatus 402 for REJECTED code', () => {
      const exception = new PaymentGatewayException(
        'MODO',
        'REJECTED',
        'Card declined',
      );

      expect(exception.httpStatus).toBe(402);
      expect(exception.isUserDeclined).toBe(true);
    });

    it('should set httpStatus 402 for insufficient code', () => {
      const exception = new PaymentGatewayException(
        'MERCADOPAGO',
        'insufficient_funds',
        'Not enough money',
      );

      expect(exception.httpStatus).toBe(402);
      expect(exception.isUserDeclined).toBe(true);
    });

    it('should include extra details', () => {
      const exception = new PaymentGatewayException(
        'MERCADOPAGO',
        'ERROR',
        'Generic error',
        { transactionId: 'tx-123', attempt: 2 },
      );

      expect(exception.details.transactionId).toBe('tx-123');
      expect(exception.details.attempt).toBe(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // QrExpiredException
  // ─────────────────────────────────────────────────────────────────────────

  describe('QrExpiredException', () => {
    it('should create with QR timing info', () => {
      const generatedAt = new Date('2026-01-25T10:00:00Z');
      const validatedAt = new Date('2026-01-25T10:05:00Z'); // 5 minutes later
      const maxAge = 120; // 2 minutes

      const exception = new QrExpiredException(generatedAt, validatedAt, maxAge);

      expect(exception.code).toBe('QR_EXPIRED');
      expect(exception.httpStatus).toBe(403);
      expect(exception.generatedAt).toEqual(generatedAt);
      expect(exception.validatedAt).toEqual(validatedAt);
      expect(exception.maxAgeSeconds).toBe(maxAge);
    });

    it('should calculate age in seconds', () => {
      const generatedAt = new Date('2026-01-25T10:00:00Z');
      const validatedAt = new Date('2026-01-25T10:02:30Z'); // 150 seconds later

      const exception = new QrExpiredException(generatedAt, validatedAt, 120);

      expect(exception.details.ageSeconds).toBe(150);
    });

    it('should include timestamps in ISO format', () => {
      const generatedAt = new Date('2026-01-25T10:00:00Z');
      const validatedAt = new Date('2026-01-25T10:05:00Z');

      const exception = new QrExpiredException(generatedAt, validatedAt, 120);

      expect(exception.details.qrTimestamp).toBe('2026-01-25T10:00:00.000Z');
      expect(exception.details.currentTime).toBe('2026-01-25T10:05:00.000Z');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SecurityBreachException
  // ─────────────────────────────────────────────────────────────────────────

  describe('SecurityBreachException', () => {
    it('should create with breach type and entity info', () => {
      const exception = new SecurityBreachException(
        SecurityBreachType.FORCED_ACCESS,
        'device-001',
        'device',
      );

      expect(exception.code).toBe('SECURITY_BREACH');
      expect(exception.httpStatus).toBe(403);
      expect(exception.details.breachType).toBe('FORCED_ACCESS');
      expect(exception.details.entityId).toBe('device-001');
      expect(exception.details.entityType).toBe('device');
    });

    it('should handle COMPROMISED_DEVICE breach', () => {
      const exception = new SecurityBreachException(
        SecurityBreachType.COMPROMISED_DEVICE,
        'device-002',
        'device',
      );

      expect(exception.message).toContain('COMPROMISED_DEVICE');
    });

    it('should handle RATE_LIMIT_EXCEEDED for users', () => {
      const exception = new SecurityBreachException(
        SecurityBreachType.RATE_LIMIT_EXCEEDED,
        'user-001',
        'user',
        { attempts: 10, windowSeconds: 60 },
      );

      expect(exception.details.attempts).toBe(10);
      expect(exception.details.windowSeconds).toBe(60);
    });

    it('should handle REVOKED_TOKEN for tokens', () => {
      const exception = new SecurityBreachException(
        SecurityBreachType.REVOKED_TOKEN,
        'token-hash',
        'token',
      );

      expect(exception.details.entityType).toBe('token');
    });

    it('should include detectedAt timestamp', () => {
      const before = new Date();
      const exception = new SecurityBreachException(
        SecurityBreachType.FORCED_ACCESS,
        'device-001',
        'device',
      );
      const after = new Date();

      const detectedAt = new Date(exception.details.detectedAt as string);
      expect(detectedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(detectedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // StockInsufficientException
  // ─────────────────────────────────────────────────────────────────────────

  describe('StockInsufficientException', () => {
    it('should create with stock info', () => {
      const exception = new StockInsufficientException(
        'product-001',
        'SKU-AGUA-500',
        5,
        10,
      );

      expect(exception.code).toBe('STOCK_INSUFFICIENT');
      expect(exception.httpStatus).toBe(409);
      expect(exception.productId).toBe('product-001');
      expect(exception.productSku).toBe('SKU-AGUA-500');
      expect(exception.availableStock).toBe(5);
      expect(exception.requestedQuantity).toBe(10);
    });

    it('should include SKU in message', () => {
      const exception = new StockInsufficientException(
        'product-001',
        'SKU-COCA-350',
        0,
        1,
      );

      expect(exception.message).toContain('SKU-COCA-350');
    });

    it('should include all data in details', () => {
      const exception = new StockInsufficientException(
        'product-001',
        'SKU-001',
        3,
        5,
      );

      expect(exception.details).toEqual({
        productId: 'product-001',
        sku: 'SKU-001',
        currentStock: 3,
        requestedQuantity: 5,
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // StockLockConflictException
  // ─────────────────────────────────────────────────────────────────────────

  describe('StockLockConflictException', () => {
    it('should create with product info', () => {
      const exception = new StockLockConflictException(
        'product-001',
        'SKU-AGUA-500',
      );

      expect(exception.code).toBe('STOCK_LOCK_CONFLICT');
      expect(exception.httpStatus).toBe(409);
      expect(exception.productId).toBe('product-001');
      expect(exception.productSku).toBe('SKU-AGUA-500');
    });

    it('should include retry hint', () => {
      const exception = new StockLockConflictException('product-001', 'SKU-001');

      expect(exception.details.retryAfterSeconds).toBe(5);
    });

    it('should suggest user action in message', () => {
      const exception = new StockLockConflictException('product-001', 'SKU-001');

      expect(exception.message).toContain('try again');
    });
  });
});
