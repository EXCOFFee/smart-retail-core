/**
 * Tests para TransactionRepository (Unit con mocks)
 */

import { Repository, SelectQueryBuilder } from 'typeorm';

import { Transaction, TransactionStatus } from '@domain/entities/transaction.entity';
import { Money } from '@domain/value-objects/money.value-object';
import { PaymentGatewayOrm, TransactionOrmEntity, TransactionStatusOrm } from '@infrastructure/database/entities/transaction.orm-entity';
import { TransactionRepository } from '@infrastructure/database/repositories/transaction.repository';

describe('TransactionRepository', () => {
  let repository: TransactionRepository;
  let mockTypeOrmRepo: jest.Mocked<Repository<TransactionOrmEntity>>;
  let mockQueryBuilder: jest.Mocked<SelectQueryBuilder<TransactionOrmEntity>>;

  const mockOrmTransaction: TransactionOrmEntity = {
    id: 'tx-123',
    userId: 'user-001',
    deviceId: 'device-001',
    productId: 'product-001',
    locationId: 'loc-1',
    amountCents: 15000,
    quantity: 1,
    status: TransactionStatusOrm.COMPLETED,
    traceId: 'trace-abc',
    externalPaymentId: 'mp-12345',
    paymentGateway: PaymentGatewayOrm.MERCADOPAGO,
    paymentMethod: 'account_money',
    createdAt: new Date('2025-01-25T10:00:00Z'),
    updatedAt: new Date('2025-01-25T10:01:00Z'),
    completedAt: new Date('2025-01-25T10:01:00Z'),
  } as TransactionOrmEntity;

  beforeEach(() => {
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
      getCount: jest.fn(),
      getRawOne: jest.fn(),
      getRawMany: jest.fn(),
    } as unknown as jest.Mocked<SelectQueryBuilder<TransactionOrmEntity>>;

    mockTypeOrmRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    } as unknown as jest.Mocked<Repository<TransactionOrmEntity>>;

    repository = new TransactionRepository(mockTypeOrmRepo);
  });

  describe('findById', () => {
    it('should return domain transaction when found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockOrmTransaction);

      const result = await repository.findById('tx-123');

      expect(result).toBeInstanceOf(Transaction);
      expect(result?.id).toBe('tx-123');
      expect(result?.userId).toBe('user-001');
      expect(result?.amount.cents).toBe(15000);
      expect(result?.status).toBe(TransactionStatus.COMPLETED);
      // PaymentInfo is populated from externalPaymentId + paymentGateway
      expect(result?.paymentInfo).toEqual(
        expect.objectContaining({
          externalId: 'mp-12345',
          gateway: 'MERCADOPAGO',
          method: 'account_money',
        }),
      );
    });

    it('should return null when transaction not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should handle transaction without payment info', async () => {
      const ormWithoutPayment = {
        ...mockOrmTransaction,
        externalPaymentId: null,
        paymentGateway: null,
        paymentMethod: null,
      };
      mockTypeOrmRepo.findOne.mockResolvedValue(ormWithoutPayment as TransactionOrmEntity);

      const result = await repository.findById('tx-123');

      expect(result).not.toBeNull();
      // When no external payment ID + gateway, paymentInfo should have null values
      expect(result?.paymentInfo.externalId).toBeNull();
      expect(result?.paymentInfo.gateway).toBeNull();
    });

    it('should handle access-only transaction (no product)', async () => {
      const ormAccessOnly = { ...mockOrmTransaction, productId: null };
      mockTypeOrmRepo.findOne.mockResolvedValue(ormAccessOnly as TransactionOrmEntity);

      const result = await repository.findById('tx-123');

      // productId can be null for access-only transactions
      expect(result?.productId).toBeNull();
    });
  });

  describe('findByTraceId', () => {
    it('should find transaction by trace ID', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockOrmTransaction);

      const result = await repository.findByTraceId('trace-abc');

      expect(result?.traceId).toBe('trace-abc');
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { traceId: 'trace-abc' },
      });
    });

    it('should return null when trace ID not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findByTraceId('unknown-trace');

      expect(result).toBeNull();
    });
  });

  describe('findByUser', () => {
    it('should return user transactions ordered by date', async () => {
      const transactions = [
        mockOrmTransaction,
        { ...mockOrmTransaction, id: 'tx-456', createdAt: new Date('2025-01-24') },
      ];
      mockTypeOrmRepo.find.mockResolvedValue(transactions as TransactionOrmEntity[]);

      const result = await repository.findByUser('user-001');

      expect(result).toHaveLength(2);
      expect(mockTypeOrmRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user-001' },
        order: { createdAt: 'DESC' },
        take: 50,
      });
    });

    it('should accept custom limit', async () => {
      mockTypeOrmRepo.find.mockResolvedValue([]);

      await repository.findByUser('user-001', 10);

      expect(mockTypeOrmRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });
  });

  describe('findByLocationAndDateRange', () => {
    it('should find transactions in date range', async () => {
      mockTypeOrmRepo.find.mockResolvedValue([mockOrmTransaction]);
      const startDate = new Date('2025-01-25T00:00:00Z');
      const endDate = new Date('2025-01-25T23:59:59Z');

      const result = await repository.findByLocationAndDateRange('loc-1', startDate, endDate);

      expect(result).toHaveLength(1);
      expect(mockTypeOrmRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            locationId: 'loc-1',
          }),
        }),
      );
    });
  });

  describe('findStalePending', () => {
    it('should find old pending transactions', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockOrmTransaction]);

      const result = await repository.findStalePending(5);

      expect(result).toHaveLength(1);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        't.status = :status',
        { status: TransactionStatusOrm.PENDING },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        't.createdAt < :cutoff',
        expect.objectContaining({ cutoff: expect.any(Date) }),
      );
    });
  });

  describe('findByExternalPaymentId', () => {
    it('should find transaction by external ID', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockOrmTransaction);

      const result = await repository.findByExternalPaymentId('mp-12345');

      expect(result?.paymentInfo?.externalId).toBe('mp-12345');
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { externalPaymentId: 'mp-12345' },
      });
    });
  });

  describe('findMany', () => {
    it('should find transactions by criteria', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockOrmTransaction]);

      const result = await repository.findMany({
        userId: 'user-001',
        status: TransactionStatus.COMPLETED,
        limit: 20,
        offset: 10,
      });

      expect(result).toHaveLength(1);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        't.userId = :userId',
        { userId: 'user-001' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        't.status = :status',
        { status: TransactionStatus.COMPLETED },
      );
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10);
    });

    it('should filter by deviceId and locationId', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await repository.findMany({
        deviceId: 'device-001',
        locationId: 'loc-1',
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        't.deviceId = :deviceId',
        { deviceId: 'device-001' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        't.locationId = :locationId',
        { locationId: 'loc-1' },
      );
    });

    it('should filter by date range', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);
      const fromDate = new Date('2025-01-01');
      const toDate = new Date('2025-01-31');

      await repository.findMany({ fromDate, toDate });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        't.createdAt >= :fromDate',
        { fromDate },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        't.createdAt <= :toDate',
        { toDate },
      );
    });
  });

  describe('count', () => {
    it('should count transactions by criteria', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(42);

      const result = await repository.count({
        userId: 'user-001',
        status: TransactionStatus.COMPLETED,
      });

      expect(result).toBe(42);
    });

    it('should count with deviceId filter', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(10);

      const result = await repository.count({
        deviceId: 'device-123',
      });

      expect(result).toBe(10);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        't.deviceId = :deviceId',
        { deviceId: 'device-123' },
      );
    });

    it('should count with locationId filter', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(25);

      const result = await repository.count({
        locationId: 'loc-001',
      });

      expect(result).toBe(25);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        't.locationId = :locationId',
        { locationId: 'loc-001' },
      );
    });

    it('should count with date range filters', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(5);
      const fromDate = new Date('2025-01-01');
      const toDate = new Date('2025-01-31');

      const result = await repository.count({
        fromDate,
        toDate,
      });

      expect(result).toBe(5);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        't.createdAt >= :fromDate',
        { fromDate },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        't.createdAt <= :toDate',
        { toDate },
      );
    });
  });

  describe('getDailySummary', () => {
    it('should return daily summary', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({
        totalTransactions: '15',
        totalAmountCents: '750000',
      });
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { status: 'COMPLETED', count: '10' },
        { status: 'PENDING', count: '5' },
      ]);

      const result = await repository.getDailySummary('loc-1', new Date('2025-01-25'));

      expect(result.totalTransactions).toBe(15);
      expect(result.totalAmountCents).toBe(750000);
      expect(result.byStatus[TransactionStatus.COMPLETED]).toBe(10);
      expect(result.byStatus[TransactionStatus.PENDING]).toBe(5);
      expect(result.byStatus[TransactionStatus.FAILED]).toBe(0);
    });

    it('should handle empty summary', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({
        totalTransactions: null,
        totalAmountCents: null,
      });
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      const result = await repository.getDailySummary('loc-empty', new Date());

      expect(result.totalTransactions).toBe(0);
      expect(result.totalAmountCents).toBe(0);
    });
  });

  describe('save', () => {
    it('should persist transaction and return domain entity', async () => {
      const domainTx = new Transaction({
        id: 'new-tx',
        userId: 'user-002',
        deviceId: 'device-002',
        productId: 'product-002',
        locationId: 'loc-2',
        amount: Money.fromCents(25000),
        quantity: 2,
        status: TransactionStatus.PENDING,
        traceId: 'trace-new',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockTypeOrmRepo.save.mockResolvedValue({
        ...mockOrmTransaction,
        id: 'new-tx',
        userId: 'user-002',
        amountCents: 25000,
        status: TransactionStatusOrm.PENDING,
      } as TransactionOrmEntity);

      const result = await repository.save(domainTx);

      expect(result).toBeInstanceOf(Transaction);
      expect(result.id).toBe('new-tx');
      expect(mockTypeOrmRepo.save).toHaveBeenCalled();
    });

    it('should map payment info to ORM fields', async () => {
      const domainTx = new Transaction({
        id: 'tx-with-payment',
        userId: 'user-001',
        deviceId: 'device-001',
        locationId: 'loc-1',
        amount: Money.fromCents(10000),
        quantity: 1,
        status: TransactionStatus.PAID,
        traceId: 'trace-pay',
        paymentInfo: {
          externalId: 'modo-123',
          gateway: 'MODO',
          method: 'bank_transfer',
          responseCode: 'APPROVED',
          responseMessage: 'OK',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockTypeOrmRepo.save.mockImplementation(async (entity) => entity as TransactionOrmEntity);

      await repository.save(domainTx);

      const savedEntity = mockTypeOrmRepo.save.mock.calls[0][0] as TransactionOrmEntity;
      expect(savedEntity.externalPaymentId).toBe('modo-123');
      expect(savedEntity.paymentGateway).toBe('MODO');
      expect(savedEntity.paymentMethod).toBe('bank_transfer');
    });

    it('should handle transaction without completedAt', async () => {
      const pendingTx = new Transaction({
        id: 'pending-tx',
        userId: 'user-001',
        deviceId: 'device-001',
        locationId: 'loc-1',
        amount: Money.fromCents(5000),
        quantity: 1,
        status: TransactionStatus.PENDING,
        traceId: 'trace-pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockTypeOrmRepo.save.mockImplementation(async (entity) => entity as TransactionOrmEntity);

      await repository.save(pendingTx);

      const savedEntity = mockTypeOrmRepo.save.mock.calls[0][0] as TransactionOrmEntity;
      expect(savedEntity.completedAt).toBeNull();
    });
  });

  describe('toDomain mapping', () => {
    it('should correctly convert amountCents to Money', async () => {
      const ormWithAmount = { ...mockOrmTransaction, amountCents: 999999 };
      mockTypeOrmRepo.findOne.mockResolvedValue(ormWithAmount as TransactionOrmEntity);

      const result = await repository.findById('tx-123');

      expect(result?.amount.cents).toBe(999999);
      expect(result?.amount.toDecimal()).toBe(9999.99);
    });

    it('should map all transaction statuses', async () => {
      const statuses = [
        TransactionStatusOrm.PENDING,
        TransactionStatusOrm.IN_PROCESS,
        TransactionStatusOrm.PAID,
        TransactionStatusOrm.COMPLETED,
        TransactionStatusOrm.FAILED,
        TransactionStatusOrm.REFUNDED_HW_FAILURE,
        TransactionStatusOrm.CANCELLED,
        TransactionStatusOrm.EXPIRED,
      ];

      for (const status of statuses) {
        const ormWithStatus = { ...mockOrmTransaction, status };
        mockTypeOrmRepo.findOne.mockResolvedValue(ormWithStatus as TransactionOrmEntity);

        const result = await repository.findById('tx-123');

        expect(result).not.toBeNull();
      }
    });
  });
});
