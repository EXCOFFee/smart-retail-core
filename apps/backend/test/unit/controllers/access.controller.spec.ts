/**
 * ============================================================================
 * SMART_RETAIL - AccessController Tests
 * ============================================================================
 * Tests unitarios para el controlador de acceso/compra.
 * ============================================================================
 */

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
    IProcessAccessUseCase,
    PROCESS_ACCESS_USE_CASE,
    ProcessAccessOutput,
} from '../../../src/application/ports/input/process-access.use-case';
import { AccessController } from '../../../src/interfaces/http/controllers/access.controller';
import { AccessRequestDto } from '../../../src/interfaces/http/dto/access-request.dto';

describe('AccessController', () => {
  let controller: AccessController;
  let mockProcessAccessUseCase: jest.Mocked<IProcessAccessUseCase>;

  beforeEach(async () => {
    mockProcessAccessUseCase = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccessController],
      providers: [
        {
          provide: PROCESS_ACCESS_USE_CASE,
          useValue: mockProcessAccessUseCase,
        },
      ],
    }).compile();

    controller = module.get<AccessController>(AccessController);

    // Silence logger during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // requestAccess
  // ─────────────────────────────────────────────────────────────────────────

  describe('requestAccess', () => {
    const baseDto: AccessRequestDto = {
      userId: 'user-001',
      deviceId: 'device-001',
      productId: 'product-001',
      quantity: 1,
    };

    const mockOutput: ProcessAccessOutput = {
      transactionId: 'txn-001',
      status: 'COMPLETED',
      message: 'Acceso autorizado',
      amountCharged: { cents: 15000, formatted: '$150.00' },
      processingTimeMs: 85,
    };

    it('should process access request successfully', async () => {
      mockProcessAccessUseCase.execute.mockResolvedValue(mockOutput);

      const result = await controller.requestAccess(baseDto);

      expect(result).toEqual({
        transactionId: 'txn-001',
        status: 'COMPLETED',
        message: 'Acceso autorizado',
        amountCharged: { cents: 15000, formatted: '$150.00' },
        processingTimeMs: 85,
      });
    });

    it('should use provided trace ID from header', async () => {
      mockProcessAccessUseCase.execute.mockResolvedValue(mockOutput);

      await controller.requestAccess(baseDto, 'custom-trace-id');

      expect(mockProcessAccessUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId: 'custom-trace-id',
        }),
      );
    });

    it('should generate trace ID when not provided', async () => {
      mockProcessAccessUseCase.execute.mockResolvedValue(mockOutput);

      await controller.requestAccess(baseDto);

      expect(mockProcessAccessUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
          ),
        }),
      );
    });

    it('should pass correct input to use case', async () => {
      mockProcessAccessUseCase.execute.mockResolvedValue(mockOutput);

      const dtoWithQr: AccessRequestDto = {
        ...baseDto,
        quantity: 2,
        qrPayload: {
          timestamp: '2026-01-25T10:00:00Z',
          nonce: 'abc123',
        },
      };

      await controller.requestAccess(dtoWithQr);

      expect(mockProcessAccessUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-001',
          deviceId: 'device-001',
          productId: 'product-001',
          quantity: 2,
          qrPayload: {
            timestamp: expect.any(Date),
            nonce: 'abc123',
          },
        }),
      );
    });

    it('should default quantity to 1 when not provided', async () => {
      mockProcessAccessUseCase.execute.mockResolvedValue(mockOutput);

      const dtoWithoutQuantity: AccessRequestDto = {
        userId: 'user-001',
        deviceId: 'device-001',
        productId: 'product-001',
      };

      await controller.requestAccess(dtoWithoutQuantity);

      expect(mockProcessAccessUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 1,
        }),
      );
    });

    it('should not include qrPayload when not provided', async () => {
      mockProcessAccessUseCase.execute.mockResolvedValue(mockOutput);

      await controller.requestAccess(baseDto);

      expect(mockProcessAccessUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          qrPayload: undefined,
        }),
      );
    });

    it('should propagate use case errors', async () => {
      const error = new Error('Use case failed');
      mockProcessAccessUseCase.execute.mockRejectedValue(error);

      await expect(controller.requestAccess(baseDto)).rejects.toThrow(
        'Use case failed',
      );
    });

    it('should transform output to response DTO correctly', async () => {
      const output: ProcessAccessOutput = {
        transactionId: 'txn-special',
        status: 'PENDING_PAYMENT',
        message: 'Procesando...',
        amountCharged: { cents: 0, formatted: '$0.00' },
        processingTimeMs: 200,
      };
      mockProcessAccessUseCase.execute.mockResolvedValue(output);

      const result = await controller.requestAccess(baseDto);

      expect(result).toEqual({
        transactionId: 'txn-special',
        status: 'PENDING_PAYMENT',
        message: 'Procesando...',
        amountCharged: { cents: 0, formatted: '$0.00' },
        processingTimeMs: 200,
      });
    });
  });
});
