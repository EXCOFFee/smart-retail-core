/**
 * Tests para ModoAdapter
 */

import { ConfigService } from '@nestjs/config';

import { PaymentGatewayException } from '@domain/exceptions/payment-gateway.exception';
import { Money } from '@domain/value-objects/money.value-object';
import { ModoAdapter } from '@infrastructure/adapters/payment/modo.adapter';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock crypto.subtle for HMAC signature
const mockCryptoSubtle = {
  importKey: jest.fn().mockResolvedValue('mock-key'),
  sign: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4])),
};
Object.defineProperty(global, 'crypto', {
  value: { subtle: mockCryptoSubtle },
});

describe('ModoAdapter', () => {
  let adapter: ModoAdapter;
  let configService: jest.Mocked<ConfigService>;

  const mockChargeRequest = {
    transactionId: 'tx-modo-12345',
    userId: 'user-001',
    userEmail: 'user@example.com',
    amount: Money.fromCents(15000),
    description: 'Test MODO purchase',
    metadata: { sku: 'PROD-001' },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const values: Record<string, unknown> = {
          MODO_API_URL: 'https://api.modo.com.ar',
          PAYMENT_TIMEOUT_MS: 3000,
        };
        return values[key] ?? defaultValue;
      }),
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, string> = {
          MODO_API_KEY: 'test-api-key',
          MODO_API_SECRET: 'test-api-secret',
          MODO_STORE_ID: 'store-123',
        };
        if (values[key]) return values[key];
        throw new Error(`Missing config: ${key}`);
      }),
    } as unknown as jest.Mocked<ConfigService>;

    adapter = new ModoAdapter(configService);
  });

  describe('constructor', () => {
    it('should create adapter with correct gateway name', () => {
      expect(adapter).toBeDefined();
      expect(adapter.gatewayName).toBe('MODO');
    });

    it('should load required configuration', () => {
      expect(configService.getOrThrow).toHaveBeenCalledWith('MODO_API_KEY');
      expect(configService.getOrThrow).toHaveBeenCalledWith('MODO_API_SECRET');
      expect(configService.getOrThrow).toHaveBeenCalledWith('MODO_STORE_ID');
    });
  });

  describe('charge', () => {
    it('should create payment intent and return pending with QR', async () => {
      const mockIntentResponse = {
        id: 'intent-xyz-789',
        status: 'created',
        qr_code: 'https://modo.ar/qr/xyz',
        qr_code_base64: 'base64-qr-data',
        deep_link: 'modo://pay/xyz',
        expires_at: '2025-01-25T04:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockIntentResponse,
      });

      const result = await adapter.charge(mockChargeRequest);

      expect(result.success).toBe(false); // Not yet approved
      expect(result.externalId).toBe('intent-xyz-789');
      expect(result.status).toBe('pending');
      expect(result.paymentMethod).toBe('modo_qr');
      expect(result.responseCode).toBe('PENDING_QR_SCAN');
      expect(result.rawResponse).toEqual({
        qr_code: 'https://modo.ar/qr/xyz',
        qr_code_base64: 'base64-qr-data',
        deep_link: 'modo://pay/xyz',
        expires_at: '2025-01-25T04:00:00Z',
      });
    });

    it('should confirm payment when paymentToken is provided', async () => {
      const requestWithToken = {
        ...mockChargeRequest,
        paymentToken: 'payment-confirmation-token',
      };

      // First call: create intent
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'intent-abc-123',
          status: 'created',
        }),
      });

      // Second call: confirm payment
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'intent-abc-123',
          status: 'approved',
          payment_method: 'bank_transfer',
          payer_bank: 'Banco Galicia',
        }),
      });

      const result = await adapter.charge(requestWithToken);

      expect(result.success).toBe(true);
      expect(result.status).toBe('approved');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should use idempotency key in headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'intent-123',
          status: 'created',
          expires_at: '2025-01-25T04:00:00Z',
        }),
      });

      await adapter.charge(mockChargeRequest);

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[1].headers['X-Idempotency-Key']).toBe('tx-modo-12345');
    });

    it('should include HMAC signature headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'intent-123',
          status: 'created',
          expires_at: '2025-01-25T04:00:00Z',
        }),
      });

      await adapter.charge(mockChargeRequest);

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[1].headers['X-API-Key']).toBe('test-api-key');
      expect(fetchCall[1].headers['X-Timestamp']).toBeDefined();
      expect(fetchCall[1].headers['X-Signature']).toBeDefined();
    });

    it('should throw PaymentGatewayException on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
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

    it('should wrap unknown errors in PaymentGatewayException', async () => {
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
          id: 'refund-123',
          status: 'approved',
          amount: 15000,
        }),
      });

      const result = await adapter.refund('intent-xyz-789', 'Product defect');

      expect(result.success).toBe(true);
      expect(result.refundId).toBe('refund-123');
      expect(result.status).toBe('approved');
      expect(result.message).toContain('150.00');
    });

    it('should handle pending refund', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'refund-456',
          status: 'pending',
          amount: 5000,
        }),
      });

      const result = await adapter.refund('intent-xyz', 'Reason');

      expect(result.success).toBe(false);
      expect(result.status).toBe('pending');
    });

    it('should handle refund failure gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Refund failed'));

      const result = await adapter.refund('intent-xyz', 'Reason');

      expect(result.success).toBe(false);
      expect(result.status).toBe('rejected');
      expect(result.message).toContain('Refund failed');
    });
  });

  describe('getTransactionStatus', () => {
    it('should return approved status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'intent-123',
          status: 'approved',
          payment_method: 'bank_transfer',
          payer_bank: 'BBVA',
        }),
      });

      const result = await adapter.getTransactionStatus('intent-123');

      expect(result.success).toBe(true);
      expect(result.status).toBe('approved');
      expect(result.paymentMethod).toBe('bank_transfer');
      expect(result.responseMessage).toBe('Pago aprobado exitosamente');
    });

    it('should return pending status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'intent-123',
          status: 'pending',
        }),
      });

      const result = await adapter.getTransactionStatus('intent-123');

      expect(result.success).toBe(false);
      expect(result.status).toBe('pending');
      expect(result.responseMessage).toBe('Pago pendiente de aprobación');
    });

    it('should map expired status to rejected', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'intent-123',
          status: 'expired',
        }),
      });

      const result = await adapter.getTransactionStatus('intent-123');

      expect(result.success).toBe(false);
      expect(result.status).toBe('rejected');
      expect(result.responseMessage).toBe('El tiempo para pagar ha expirado');
    });

    it('should handle status check failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await adapter.getTransactionStatus('intent-123');

      expect(result.success).toBe(false);
      expect(result.responseCode).toBe('STATUS_CHECK_FAILED');
    });
  });

  describe('isAvailable', () => {
    it('should return true when health endpoint responds', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok' }),
      });

      const result = await adapter.isAvailable();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v2/health'),
        expect.any(Object),
      );
    });

    it('should return false when health check fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Service unavailable'));

      const result = await adapter.isAvailable();

      expect(result).toBe(false);
    });
  });

  describe('status messages', () => {
    const statusCases = [
      { status: 'pending', expectedMessage: 'Pago pendiente de aprobación' },
      { status: 'approved', expectedMessage: 'Pago aprobado exitosamente' },
      { status: 'rejected', expectedMessage: 'Pago rechazado' },
      { status: 'expired', expectedMessage: 'El tiempo para pagar ha expirado' },
    ];

    it.each(statusCases)(
      'should map $status to correct message',
      async ({ status, expectedMessage }) => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'intent-123',
            status,
          }),
        });

        const result = await adapter.getTransactionStatus('intent-123');

        expect(result.responseMessage).toBe(expectedMessage);
      },
    );
  });
});
