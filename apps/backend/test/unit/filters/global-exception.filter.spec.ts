/**
 * ============================================================================
 * SMART_RETAIL - GlobalExceptionFilter Tests
 * ============================================================================
 * Tests unitarios para el filtro global de excepciones.
 * ============================================================================
 */

import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { GlobalExceptionFilter } from '../../../src/interfaces/http/filters/global-exception.filter';

// Concrete implementation for testing DomainException
class GenericDomainException extends DomainException {
  readonly code = 'GENERIC_DOMAIN_ERROR';
  readonly httpStatus = 422;
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockRequest: { url: string; method: string; headers: Record<string, string> };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn().mockReturnValue('development'),
    } as unknown as jest.Mocked<ConfigService>;

    filter = new GlobalExceptionFilter(mockConfigService);

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      url: '/api/test',
      method: 'POST',
      headers: { 'x-trace-id': 'trace-123' },
    };

    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // HttpException handling
  // ─────────────────────────────────────────────────────────────────────────

  describe('HttpException handling', () => {
    it('should handle HttpException with string response', () => {
      const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Not Found',
          errorCode: 'NOT_FOUND',
          traceId: 'trace-123',
        }),
      );
    });

    it('should handle HttpException with object response', () => {
      const exception = new HttpException(
        { message: 'Custom message', customField: 'value' },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Custom message',
          errorCode: 'BAD_REQUEST',
        }),
      );
    });

    it('should handle validation errors (array of messages)', () => {
      const exception = new HttpException(
        { message: ['Field email is required', 'Password too short'] },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Error de validación',
          details: {
            validationErrors: ['Field email is required', 'Password too short'],
          },
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Domain Exceptions
  // ─────────────────────────────────────────────────────────────────────────

  describe('Domain Exception handling', () => {
    it('should handle InsufficientBalanceException as 402', () => {
      const exception = new InsufficientBalanceException('user-001', 500, 1000);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.PAYMENT_REQUIRED);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          errorCode: 'INSUFFICIENT_BALANCE',
          details: expect.objectContaining({
            userId: 'user-001',
            currentBalance: 500,
            requiredAmount: 1000,
          }),
        }),
      );
    });

    it('should handle StockInsufficientException as 409', () => {
      const exception = new StockInsufficientException('prod-001', 'SKU-001', 5, 10);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.CONFLICT,
          errorCode: 'STOCK_INSUFFICIENT',
          details: expect.objectContaining({
            productId: 'prod-001',
            productSku: 'SKU-001',
            availableStock: 5,
            requestedQuantity: 10,
          }),
        }),
      );
    });

    it('should handle StockLockConflictException as 409', () => {
      const exception = new StockLockConflictException('prod-001', 'SKU-001');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'STOCK_LOCK_CONFLICT',
          details: expect.objectContaining({
            productId: 'prod-001',
            productSku: 'SKU-001',
          }),
        }),
      );
    });

    it('should handle DeviceNotOperationalException as 503', () => {
      const exception = new DeviceNotOperationalException(
        'dev-001',
        'Molinete',
        'OFFLINE',
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'DEVICE_NOT_OPERATIONAL',
          details: expect.objectContaining({
            deviceId: 'dev-001',
            deviceName: 'Molinete',
            deviceStatus: 'OFFLINE',
          }),
        }),
      );
    });

    it('should handle PaymentGatewayException as 402 for user rejection', () => {
      const exception = new PaymentGatewayException(
        'MERCADOPAGO',
        'cc_rejected_insufficient_amount',
        'Insufficient funds',
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.PAYMENT_REQUIRED);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            gateway: 'MERCADOPAGO',
            isRetryable: false,
          }),
        }),
      );
    });

    it('should handle PaymentGatewayException as 502 for technical error', () => {
      const exception = new PaymentGatewayException(
        'MODO',
        'TIMEOUT',
        'Connection timeout',
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_GATEWAY);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            gateway: 'MODO',
            isRetryable: true,
          }),
        }),
      );
    });

    it('should handle QrExpiredException as 403', () => {
      const exception = new QrExpiredException(
        new Date('2026-01-25T10:00:00Z'),
        new Date('2026-01-25T10:05:00Z'),
        120,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'QR_EXPIRED',
          details: expect.objectContaining({
            maxAgeSeconds: 120,
          }),
        }),
      );
    });

    it('should handle SecurityBreachException as 403 without sensitive details', () => {
      const exception = new SecurityBreachException(
        SecurityBreachType.FORCED_ACCESS,
        'dev-001',
        'device',
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'SECURITY_BREACH',
          details: undefined, // No details for security reasons
        }),
      );
    });

    it('should handle generic DomainException as 422', () => {
      const exception = new GenericDomainException('Some domain error');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'GENERIC_DOMAIN_ERROR',
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Unknown Errors
  // ─────────────────────────────────────────────────────────────────────────

  describe('Unknown error handling', () => {
    it('should handle unknown Error as 500 in development', () => {
      const exception = new Error('Something went wrong');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Something went wrong',
          errorCode: 'INTERNAL_SERVER_ERROR',
        }),
      );
    });

    it('should hide error details in production', () => {
      mockConfigService.get.mockReturnValue('production');
      const productionFilter = new GlobalExceptionFilter(mockConfigService);
      const exception = new Error('Internal database failure');

      productionFilter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Error interno del servidor',
          details: undefined,
        }),
      );
    });

    it('should handle non-Error objects', () => {
      const exception = { weird: 'object' };

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Trace ID handling
  // ─────────────────────────────────────────────────────────────────────────

  describe('Trace ID handling', () => {
    it('should use x-trace-id header', () => {
      mockRequest.headers = { 'x-trace-id': 'custom-trace-id' };

      filter.catch(new Error('Test'), mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId: 'custom-trace-id',
        }),
      );
    });

    it('should use x-request-id as fallback', () => {
      mockRequest.headers = { 'x-request-id': 'request-id-456' };

      filter.catch(new Error('Test'), mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId: 'request-id-456',
        }),
      );
    });

    it('should generate UUID when no trace ID provided', () => {
      mockRequest.headers = {};

      filter.catch(new Error('Test'), mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
          ),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Response structure
  // ─────────────────────────────────────────────────────────────────────────

  describe('Response structure', () => {
    it('should include all required fields', () => {
      filter.catch(new Error('Test'), mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: expect.any(Number),
          message: expect.any(String),
          errorCode: expect.any(String),
          traceId: expect.any(String),
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
          path: '/api/test',
        }),
      );
    });

    it('should handle HttpException with undefined response', () => {
      // Create an exception that would have non-string, non-object response
      // by mocking getResponse to return undefined
      const exception = new HttpException('Test', HttpStatus.BAD_REQUEST);
      jest.spyOn(exception, 'getResponse').mockReturnValue(undefined as unknown as string);

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test', // Falls back to exception.message
        }),
      );
    });
  });
});
