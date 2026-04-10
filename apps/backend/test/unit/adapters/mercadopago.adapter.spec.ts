/**
 * Tests para MercadoPagoAdapter
 */

import { ConfigService } from '@nestjs/config';

import { PaymentGatewayException } from '@domain/exceptions/payment-gateway.exception';
import { Money } from '@domain/value-objects/money.value-object';
import { MercadoPagoAdapter } from '@infrastructure/adapters/payment/mercadopago.adapter';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('MercadoPagoAdapter', () => {
  let adapter: MercadoPagoAdapter;
  let configService: jest.Mocked<ConfigService>;

  const mockChargeRequest = {
    transactionId: 'tx-12345',
    userId: 'user-001',
    userEmail: 'user@example.com',
    amount: Money.fromDecimal(150.0),
    description: 'Test purchase',
    metadata: { sku: 'PROD-001' },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const values: Record<string, unknown> = {
          MERCADOPAGO_API_URL: 'https://api.mercadopago.com',
          PAYMENT_TIMEOUT_MS: 3000,
        };
        return values[key] ?? defaultValue;
      }),
      getOrThrow: jest.fn((key: string) => {
        if (key === 'MERCADOPAGO_ACCESS_TOKEN') return 'test-access-token';
        throw new Error(`Missing config: ${key}`);
      }),
    } as unknown as jest.Mocked<ConfigService>;

    adapter = new MercadoPagoAdapter(configService);
  });

  describe('constructor', () => {
    it('should create adapter with correct gateway name', () => {
      expect(adapter).toBeDefined();
      expect(adapter.gatewayName).toBe('MERCADOPAGO');
    });

    it('should load configuration from ConfigService', () => {
      expect(configService.getOrThrow).toHaveBeenCalledWith('MERCADOPAGO_ACCESS_TOKEN');
    });
  });

  describe('charge', () => {
    it('should process charge successfully when approved', async () => {
      const mockResponse = {
        id: 123456789,
        status: 'approved',
        status_detail: 'accredited',
        payment_method_id: 'account_money',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.charge(mockChargeRequest);

      expect(result.success).toBe(true);
      expect(result.externalId).toBe('123456789');
      expect(result.status).toBe('approved');
      expect(result.paymentMethod).toBe('account_money');
      expect(result.responseCode).toBe('accredited');
      expect(result.responseMessage).toBe('Pago acreditado exitosamente');
    });

    it('should return rejected status on payment rejection', async () => {
      const mockResponse = {
        id: 987654321,
        status: 'rejected',
        status_detail: 'cc_rejected_insufficient_amount',
        payment_method_id: 'visa',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.charge(mockChargeRequest);

      expect(result.success).toBe(false);
      expect(result.status).toBe('rejected');
      expect(result.responseMessage).toBe('Saldo insuficiente');
    });

    it('should handle pending status', async () => {
      const mockResponse = {
        id: 111222333,
        status: 'pending',
        status_detail: 'pending_contingency',
        payment_method_id: 'debit_card',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.charge(mockChargeRequest);

      expect(result.success).toBe(false);
      expect(result.status).toBe('pending');
    });

    it('should include payment token when provided', async () => {
      const requestWithToken = {
        ...mockChargeRequest,
        paymentToken: 'card-token-xyz',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 555666,
          status: 'approved',
          status_detail: 'accredited',
          payment_method_id: 'visa',
        }),
      });

      await adapter.charge(requestWithToken);

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.token).toBe('card-token-xyz');
    });

    it('should use idempotency key header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 123,
          status: 'approved',
          status_detail: 'accredited',
          payment_method_id: 'account_money',
        }),
      });

      await adapter.charge(mockChargeRequest);

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[1].headers['X-Idempotency-Key']).toBe('tx-12345');
    });

    it('should throw PaymentGatewayException on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      });

      await expect(adapter.charge(mockChargeRequest)).rejects.toThrow(
        PaymentGatewayException,
      );
    });

    it('should throw PaymentGatewayException on timeout', async () => {
      mockFetch.mockImplementationOnce(() => {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      await expect(adapter.charge(mockChargeRequest)).rejects.toThrow(
        PaymentGatewayException,
      );
    });

    it('should throw PaymentGatewayException on unknown error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(adapter.charge(mockChargeRequest)).rejects.toThrow(
        PaymentGatewayException,
      );
    });
  });

  describe('refund', () => {
    it('should process refund successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 999888,
          status: 'approved',
          amount: 15000,
        }),
      });

      const result = await adapter.refund('123456789', 'Customer request');

      expect(result.success).toBe(true);
      expect(result.refundId).toBe('999888');
      expect(result.status).toBe('approved');
    });

    it('should handle pending refund', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 777666,
          status: 'pending',
          amount: 5000,
        }),
      });

      const result = await adapter.refund('123456789', 'Pending refund');

      expect(result.success).toBe(false);
      expect(result.status).toBe('pending');
    });

    it('should handle refund failure gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Refund failed'));

      const result = await adapter.refund('123456789', 'Failed refund');

      expect(result.success).toBe(false);
      expect(result.status).toBe('rejected');
      expect(result.message).toContain('Refund failed');
    });
  });

  describe('getTransactionStatus', () => {
    it('should return transaction status successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 123456789,
          status: 'approved',
          status_detail: 'accredited',
          payment_method_id: 'account_money',
        }),
      });

      const result = await adapter.getTransactionStatus('123456789');

      expect(result.success).toBe(true);
      expect(result.externalId).toBe('123456789');
      expect(result.status).toBe('approved');
    });

    it('should handle status check failure gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Status check failed'));

      const result = await adapter.getTransactionStatus('123456789');

      expect(result.success).toBe(false);
      expect(result.responseCode).toBe('STATUS_CHECK_FAILED');
    });
  });

  describe('isAvailable', () => {
    it('should return true when API is available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await adapter.isAvailable();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/me'),
        expect.any(Object),
      );
    });

    it('should return false when API is unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Service unavailable'));

      const result = await adapter.isAvailable();

      expect(result).toBe(false);
    });
  });

  describe('status detail messages', () => {
    const testCases = [
      { detail: 'cc_rejected_bad_filled_card_number', expected: 'Número de tarjeta incorrecto' },
      { detail: 'cc_rejected_bad_filled_date', expected: 'Fecha de vencimiento incorrecta' },
      { detail: 'cc_rejected_card_disabled', expected: 'Tarjeta deshabilitada' },
      { detail: 'cc_rejected_high_risk', expected: 'Pago rechazado por seguridad' },
      { detail: 'unknown_detail', expected: 'unknown_detail' }, // fallback
    ];

    it.each(testCases)(
      'should map $detail to correct message',
      async ({ detail, expected }) => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 123,
            status: 'rejected',
            status_detail: detail,
            payment_method_id: 'visa',
          }),
        });

        const result = await adapter.charge(mockChargeRequest);

        expect(result.responseMessage).toBe(expected);
      },
    );
  });
});
