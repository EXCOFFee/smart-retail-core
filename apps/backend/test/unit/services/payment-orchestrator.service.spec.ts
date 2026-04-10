/**
 * ============================================================================
 * SMART_RETAIL - PaymentOrchestrator Tests
 * ============================================================================
 * Tests unitarios para el orquestador de pagos.
 * ============================================================================
 */

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
    ChargeRequest,
    ChargeResult,
    IPaymentGatewayPort,
    MERCADOPAGO_ADAPTER,
    MODO_ADAPTER,
} from '../../../src/application/ports/output/payment-gateway.port';
import {
    PaymentOrchestrator
} from '../../../src/application/services/payment-orchestrator.service';
import { PaymentGatewayException } from '../../../src/domain/exceptions/payment-gateway.exception';
import { Money } from '../../../src/domain/value-objects/money.value-object';

describe('PaymentOrchestrator', () => {
  let orchestrator: PaymentOrchestrator;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockMercadopagoAdapter: jest.Mocked<IPaymentGatewayPort>;
  let mockModoAdapter: jest.Mocked<IPaymentGatewayPort>;

  const defaultChargeRequest: ChargeRequest = {
    amount: Money.fromCents(15000),
    description: 'Test payment',
    transactionId: 'txn-001',
    userId: 'user-001',
    userEmail: 'test@example.com',
  };

  const successfulChargeResult: ChargeResult = {
    success: true,
    externalId: 'ext-001',
    status: 'approved',
    paymentMethod: 'credit_card',
    responseCode: '200',
    responseMessage: 'Approved',
  };

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          PAYMENT_PRIMARY_GATEWAY: 'MERCADOPAGO',
          PAYMENT_FALLBACK_GATEWAY: 'MODO',
          PAYMENT_ENABLE_FALLBACK: true,
          PAYMENT_MAX_RETRIES: 2,
          PAYMENT_RETRY_DELAY_MS: 10, // Low for tests
        };
        return config[key] ?? defaultValue;
      }),
      getOrThrow: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    mockMercadopagoAdapter = {
      gatewayName: 'MERCADOPAGO',
      charge: jest.fn(),
      refund: jest.fn(),
      getTransactionStatus: jest.fn(),
      isAvailable: jest.fn(),
    } as unknown as jest.Mocked<IPaymentGatewayPort>;

    mockModoAdapter = {
      gatewayName: 'MODO',
      charge: jest.fn(),
      refund: jest.fn(),
      getTransactionStatus: jest.fn(),
      isAvailable: jest.fn(),
    } as unknown as jest.Mocked<IPaymentGatewayPort>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentOrchestrator,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MERCADOPAGO_ADAPTER, useValue: mockMercadopagoAdapter },
        { provide: MODO_ADAPTER, useValue: mockModoAdapter },
      ],
    }).compile();

    orchestrator = module.get<PaymentOrchestrator>(PaymentOrchestrator);

    // Silence logger
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should be defined', () => {
      expect(orchestrator).toBeDefined();
    });

    it('should load configuration from ConfigService', () => {
      expect(mockConfigService.get).toHaveBeenCalledWith('PAYMENT_PRIMARY_GATEWAY');
      expect(mockConfigService.get).toHaveBeenCalledWith('PAYMENT_FALLBACK_GATEWAY');
      expect(mockConfigService.get).toHaveBeenCalledWith('PAYMENT_ENABLE_FALLBACK');
      expect(mockConfigService.get).toHaveBeenCalledWith('PAYMENT_MAX_RETRIES');
      expect(mockConfigService.get).toHaveBeenCalledWith('PAYMENT_RETRY_DELAY_MS');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // charge - Success scenarios
  // ─────────────────────────────────────────────────────────────────────────

  describe('charge - success scenarios', () => {
    it('should charge successfully with primary gateway', async () => {
      mockMercadopagoAdapter.charge.mockResolvedValue(successfulChargeResult);

      const result = await orchestrator.charge(defaultChargeRequest);

      expect(mockMercadopagoAdapter.charge).toHaveBeenCalledWith(defaultChargeRequest);
      expect(result.gateway).toBe('MERCADOPAGO');
      expect(result.usedFallback).toBe(false);
      expect(result.status).toBe('approved');
    });

    it('should include metrics in result', async () => {
      mockMercadopagoAdapter.charge.mockResolvedValue(successfulChargeResult);

      const result = await orchestrator.charge(defaultChargeRequest);

      expect(result).toEqual(
        expect.objectContaining({
          gateway: 'MERCADOPAGO',
          operation: 'charge',
          latencyMs: expect.any(Number),
          retries: expect.any(Number),
          usedFallback: false,
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // charge - Fallback scenarios
  // ─────────────────────────────────────────────────────────────────────────

  describe('charge - fallback scenarios', () => {
    it('should fallback to secondary gateway when primary fails', async () => {
      mockMercadopagoAdapter.charge.mockRejectedValue(
        new PaymentGatewayException('MERCADOPAGO', 'TIMEOUT', 'Connection timeout'),
      );
      mockModoAdapter.charge.mockResolvedValue(successfulChargeResult);

      const result = await orchestrator.charge(defaultChargeRequest);

      expect(result.gateway).toBe('MODO');
      expect(result.usedFallback).toBe(true);
    });

    it('should throw when both gateways fail', async () => {
      mockMercadopagoAdapter.charge.mockRejectedValue(
        new PaymentGatewayException('MERCADOPAGO', 'TIMEOUT', 'Timeout'),
      );
      mockModoAdapter.charge.mockRejectedValue(
        new PaymentGatewayException('MODO', 'TIMEOUT', 'Timeout'),
      );

      await expect(orchestrator.charge(defaultChargeRequest)).rejects.toThrow(
        PaymentGatewayException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // charge - Rejected payments (no retry)
  // ─────────────────────────────────────────────────────────────────────────

  describe('charge - rejected payments', () => {
    it('should not retry on rejected payment', async () => {
      const rejectedResult: ChargeResult = {
        success: false,
        externalId: 'ext-002',
        status: 'rejected',
        paymentMethod: null,
        responseCode: 'cc_rejected',
        responseMessage: 'Insufficient funds',
      };
      mockMercadopagoAdapter.charge.mockResolvedValue(rejectedResult);

      const result = await orchestrator.charge(defaultChargeRequest);

      expect(mockMercadopagoAdapter.charge).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('rejected');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // charge - Pending/In-process handling
  // ─────────────────────────────────────────────────────────────────────────

  describe('charge - pending status', () => {
    it('should return pending result directly', async () => {
      const pendingResult: ChargeResult = {
        success: true,
        externalId: 'ext-003',
        status: 'pending',
        paymentMethod: null,
        responseCode: 'pending',
        responseMessage: 'Waiting for gateway',
      };
      mockMercadopagoAdapter.charge.mockResolvedValue(pendingResult);

      const result = await orchestrator.charge(defaultChargeRequest);

      expect(result.status).toBe('pending');
    });

    it('should poll status for in_process transactions', async () => {
      const inProcessResult: ChargeResult = {
        success: true,
        externalId: 'ext-004',
        status: 'in_process',
        paymentMethod: null,
        responseCode: 'processing',
        responseMessage: 'Processing',
      };
      mockMercadopagoAdapter.charge.mockResolvedValue(inProcessResult);
      mockMercadopagoAdapter.getTransactionStatus.mockResolvedValue(successfulChargeResult);

      const result = await orchestrator.charge(defaultChargeRequest);

      expect(mockMercadopagoAdapter.getTransactionStatus).toHaveBeenCalledWith('ext-004');
      expect(result.status).toBe('approved');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // refund
  // ─────────────────────────────────────────────────────────────────────────

  describe('refund', () => {
    it('should refund via correct gateway', async () => {
      const refundResult = {
        success: true,
        refundId: 'ref-001',
        status: 'approved' as const,
        message: 'Refund processed',
      };
      mockMercadopagoAdapter.refund.mockResolvedValue(refundResult);

      const result = await orchestrator.refund('ext-001', 'Customer request', 'MERCADOPAGO');

      expect(mockMercadopagoAdapter.refund).toHaveBeenCalledWith('ext-001', 'Customer request');
      expect(result.status).toBe('approved');
    });

    it('should throw if gateway not configured', async () => {
      // Test with unknown gateway to verify error handling
      await expect(
        orchestrator.refund('ext-001', 'Test', 'UNKNOWN' as 'MERCADOPAGO'),
      ).rejects.toThrow(PaymentGatewayException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getTransactionStatus
  // ─────────────────────────────────────────────────────────────────────────

  describe('getTransactionStatus', () => {
    it('should get status from correct gateway', async () => {
      mockModoAdapter.getTransactionStatus.mockResolvedValue(successfulChargeResult);

      const result = await orchestrator.getTransactionStatus('ext-001', 'MODO');

      expect(mockModoAdapter.getTransactionStatus).toHaveBeenCalledWith('ext-001');
      expect(result.status).toBe('approved');
    });

    it('should throw if gateway not configured', async () => {
      // Test with unknown gateway to verify error handling
      await expect(
        orchestrator.getTransactionStatus('ext-001', 'UNKNOWN' as 'MODO'),
      ).rejects.toThrow(PaymentGatewayException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getGatewaysHealth
  // ─────────────────────────────────────────────────────────────────────────

  describe('getGatewaysHealth', () => {
    it('should return health status for all gateways', async () => {
      mockMercadopagoAdapter.isAvailable.mockResolvedValue(true);
      mockModoAdapter.isAvailable.mockResolvedValue(false);

      const health = await orchestrator.getGatewaysHealth();

      expect(health.MERCADOPAGO).toBe(true);
      expect(health.MODO).toBe(false);
    });

    it('should handle gateway errors as unhealthy', async () => {
      mockMercadopagoAdapter.isAvailable.mockRejectedValue(new Error('Connection failed'));
      mockModoAdapter.isAvailable.mockResolvedValue(true);

      const health = await orchestrator.getGatewaysHealth();

      expect(health.MERCADOPAGO).toBe(false);
      expect(health.MODO).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Retry Logic - Edge Cases
  // ─────────────────────────────────────────────────────────────────────────

  describe('retry logic edge cases', () => {
    it('should NOT retry on non-retriable error codes', async () => {
      // INVALID_CARD is not in the retriable codes list
      mockMercadopagoAdapter.charge.mockRejectedValue(
        new PaymentGatewayException('MERCADOPAGO', 'INVALID_CARD', 'Card is invalid'),
      );

      await expect(orchestrator.charge(defaultChargeRequest)).rejects.toThrow(
        PaymentGatewayException,
      );

      // Should only attempt once (no retries for non-retriable codes)
      expect(mockMercadopagoAdapter.charge).toHaveBeenCalledTimes(1);
    });

    it('should handle non-Error exceptions gracefully', async () => {
      // Simulate a non-Error throw (like a string)
      mockMercadopagoAdapter.charge.mockRejectedValue('String error');
      mockModoAdapter.charge.mockRejectedValue('Another string');

      await expect(orchestrator.charge(defaultChargeRequest)).rejects.toThrow();
    });
  });
});
