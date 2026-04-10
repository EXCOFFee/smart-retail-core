/**
 * ============================================================================
 * SMART_RETAIL - TransactionController Tests
 * ============================================================================
 * Tests unitarios para el controlador de transacciones.
 * ============================================================================
 */

import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TRANSACTION_REPOSITORY } from '../../../src/application/ports/output/repositories.port';
import { Transaction, TransactionStatus } from '../../../src/domain/entities/transaction.entity';
import { Money } from '../../../src/domain/value-objects/money.value-object';
import { TransactionController } from '../../../src/interfaces/http/controllers/transaction.controller';

describe('TransactionController', () => {
  let controller: TransactionController;
  let transactionRepository: {
    findById: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    getDailySummary: jest.Mock;
  };

  const mockTransactionRepository = {
    findById: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    getDailySummary: jest.fn(),
  };

  const createMockTransaction = (overrides = {}) => {
    return new Transaction({
      id: 'txn-123',
      userId: 'user-001',
      deviceId: 'device-001',
      productId: 'prod-001',
      locationId: 'loc-001',
      amount: Money.fromCents(1000),
      quantity: 1,
      traceId: 'trace-abc123',
      status: TransactionStatus.COMPLETED,
      ...overrides,
    });
  };

  const mockAdminUser = {
    sub: 'admin-001',
    email: 'admin@example.com',
    role: 'admin',
    locationId: 'loc-001',
  };

  const mockConsumerUser = {
    sub: 'user-001',
    email: 'consumer@example.com',
    role: 'consumer',
    locationId: 'loc-001',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionController],
      providers: [
        {
          provide: TRANSACTION_REPOSITORY,
          useValue: mockTransactionRepository,
        },
      ],
    }).compile();

    controller = module.get<TransactionController>(TransactionController);
    transactionRepository = module.get(TRANSACTION_REPOSITORY);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // MY TRANSACTIONS
  // ─────────────────────────────────────────────────────────────────────────

  describe('getMyTransactions', () => {
    it('should return current user transactions', async () => {
      const mockTransactions = [
        createMockTransaction({ userId: 'user-001' }),
        createMockTransaction({ id: 'txn-456', userId: 'user-001' }),
      ];
      mockTransactionRepository.findMany.mockResolvedValue(mockTransactions);
      mockTransactionRepository.count.mockResolvedValue(2);

      const result = await controller.getMyTransactions(mockConsumerUser, {});

      expect(transactionRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-001' }),
      );
      expect(result.transactions).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by status', async () => {
      const mockTransactions = [createMockTransaction()];
      mockTransactionRepository.findMany.mockResolvedValue(mockTransactions);
      mockTransactionRepository.count.mockResolvedValue(1);

      await controller.getMyTransactions(mockConsumerUser, {
        status: TransactionStatus.COMPLETED,
      });

      expect(transactionRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-001',
          status: TransactionStatus.COMPLETED,
        }),
      );
    });

    it('should handle pagination', async () => {
      const mockTransactions = [createMockTransaction()];
      mockTransactionRepository.findMany.mockResolvedValue(mockTransactions);
      mockTransactionRepository.count.mockResolvedValue(100);

      const result = await controller.getMyTransactions(mockConsumerUser, {
        limit: 10,
        offset: 20,
      });

      expect(transactionRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 20,
        }),
      );
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(20);
      expect(result.total).toBe(100);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // LIST TRANSACTIONS (ADMIN)
  // ─────────────────────────────────────────────────────────────────────────

  describe('listTransactions', () => {
    it('should return all transactions for admin', async () => {
      const mockTransactions = [
        createMockTransaction(),
        createMockTransaction({ id: 'txn-456', userId: 'user-002' }),
      ];
      mockTransactionRepository.findMany.mockResolvedValue(mockTransactions);
      mockTransactionRepository.count.mockResolvedValue(2);

      const result = await controller.listTransactions({});

      expect(transactionRepository.findMany).toHaveBeenCalled();
      expect(result.transactions).toHaveLength(2);
    });

    it('should filter by locationId', async () => {
      const mockTransactions = [createMockTransaction()];
      mockTransactionRepository.findMany.mockResolvedValue(mockTransactions);
      mockTransactionRepository.count.mockResolvedValue(1);

      await controller.listTransactions({ locationId: 'loc-001' });

      expect(transactionRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ locationId: 'loc-001' }),
      );
    });

    it('should filter by deviceId', async () => {
      const mockTransactions = [createMockTransaction()];
      mockTransactionRepository.findMany.mockResolvedValue(mockTransactions);
      mockTransactionRepository.count.mockResolvedValue(1);

      await controller.listTransactions({ deviceId: 'device-001' });

      expect(transactionRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ deviceId: 'device-001' }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET TRANSACTION BY ID
  // ─────────────────────────────────────────────────────────────────────────

  describe('getTransaction', () => {
    it('should return transaction for admin', async () => {
      const mockTransaction = createMockTransaction();
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);

      const result = await controller.getTransaction('txn-123', mockAdminUser);

      expect(transactionRepository.findById).toHaveBeenCalledWith('txn-123');
      expect(result.id).toBe('txn-123');
    });

    it('should allow user to view their own transaction', async () => {
      const mockTransaction = createMockTransaction({ userId: 'user-001' });
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);

      const result = await controller.getTransaction('txn-123', mockConsumerUser);

      expect(result.id).toBe('txn-123');
    });

    it('should throw NotFoundException for consumer viewing other user transaction', async () => {
      const mockTransaction = createMockTransaction({ userId: 'other-user' });
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);

      await expect(
        controller.getTransaction('txn-123', mockConsumerUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for non-existent transaction', async () => {
      mockTransactionRepository.findById.mockResolvedValue(null);

      await expect(
        controller.getTransaction('non-existent', mockAdminUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DAILY SUMMARY
  // ─────────────────────────────────────────────────────────────────────────

  describe('getDailySummary', () => {
    it('should return daily summary for location', async () => {
      const mockSummary = {
        totalTransactions: 50,
        totalAmountCents: 150000,
        byStatus: {
          [TransactionStatus.COMPLETED]: 45,
          [TransactionStatus.FAILED]: 3,
          [TransactionStatus.REFUNDED_HW_FAILURE]: 2,
        },
      };
      mockTransactionRepository.getDailySummary.mockResolvedValue(mockSummary);

      const result = await controller.getDailySummary({
        locationId: 'loc-001',
        date: new Date('2026-01-25'),
      });

      expect(transactionRepository.getDailySummary).toHaveBeenCalledWith(
        'loc-001',
        expect.any(Date),
      );
      expect(result.totalTransactions).toBe(50);
      expect(result.totalAmountCents).toBe(150000);
      expect(result.totalAmountFormatted).toBe('$1500.00');
    });
  });
});
