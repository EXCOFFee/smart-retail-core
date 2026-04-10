/**
 * Tests para DailyReportTask
 */

import { Repository } from 'typeorm';

import { ITransactionRepository } from '@application/ports/output/repositories.port';
import { AuditLogOrmEntity } from '@infrastructure/database/entities/audit-log.orm-entity';
import { DeviceOrmEntity } from '@infrastructure/database/entities/device.orm-entity';
import { DailyReportTask } from '@infrastructure/tasks/daily-report.task';

// Tipo para el resumen diario con byStatus tipado
interface DailySummary {
  totalTransactions: number;
  totalAmountCents: number;
  byStatus: Record<string, number>;
}

// Tipo para el query builder mock
interface MockQueryBuilder {
  select: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  getRawMany: jest.Mock;
}

describe('DailyReportTask', () => {
  let task: DailyReportTask;
  let mockTransactionRepo: jest.Mocked<ITransactionRepository>;
  let mockDeviceRepo: jest.Mocked<Repository<DeviceOrmEntity>>;
  let mockAuditLogRepo: jest.Mocked<Repository<AuditLogOrmEntity>>;
  let mockQueryBuilder: MockQueryBuilder;

  beforeEach(() => {
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
    };

    mockTransactionRepo = {
      getDailySummary: jest.fn(),
    } as unknown as jest.Mocked<ITransactionRepository>;

    mockDeviceRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    } as unknown as jest.Mocked<Repository<DeviceOrmEntity>>;

    mockAuditLogRepo = {
      create: jest.fn((data) => data),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<AuditLogOrmEntity>>;

    task = new DailyReportTask(
      mockTransactionRepo,
      mockDeviceRepo,
      mockAuditLogRepo,
    );
  });

  describe('handleDailyReport', () => {
    it('should process all locations', async () => {
      // Setup: 2 locations
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { locationId: 'loc-1' },
        { locationId: 'loc-2' },
      ]);

      mockTransactionRepo.getDailySummary.mockResolvedValue({
        totalTransactions: 10,
        totalAmountCents: 100000,
        byStatus: { COMPLETED: 8, PENDING: 2 },
      } as DailySummary);

      await task.handleDailyReport();

      expect(mockTransactionRepo.getDailySummary).toHaveBeenCalledTimes(2);
      expect(mockAuditLogRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should skip when no locations found', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      await task.handleDailyReport();

      expect(mockTransactionRepo.getDailySummary).not.toHaveBeenCalled();
      expect(mockAuditLogRepo.save).not.toHaveBeenCalled();
    });

    it('should continue processing other locations on error', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { locationId: 'loc-1' },
        { locationId: 'loc-2' },
      ]);

      mockTransactionRepo.getDailySummary
        .mockRejectedValueOnce(new Error('DB error for loc-1'))
        .mockResolvedValueOnce({
          totalTransactions: 5,
          totalAmountCents: 50000,
          byStatus: { COMPLETED: 5 },
        } as DailySummary);

      await task.handleDailyReport();

      // Should still process second location
      expect(mockTransactionRepo.getDailySummary).toHaveBeenCalledTimes(2);
      expect(mockAuditLogRepo.save).toHaveBeenCalledTimes(1); // Only loc-2 saved
    });

    it('should query for distinct location IDs', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      await task.handleDailyReport();

      expect(mockDeviceRepo.createQueryBuilder).toHaveBeenCalledWith('d');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith(
        'DISTINCT d.locationId',
        'locationId',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'd.status = :status',
        { status: 'active' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'd.locationId IS NOT NULL',
      );
    });

    it('should create audit log with correct structure', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([{ locationId: 'loc-1' }]);

      mockTransactionRepo.getDailySummary.mockResolvedValue({
        totalTransactions: 15,
        totalAmountCents: 250000,
        byStatus: { COMPLETED: 12, FAILED: 3 },
      } as DailySummary);

      await task.handleDailyReport();

      expect(mockAuditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: expect.any(String),
          severity: 'INFO',
          entityType: 'daily_report',
          entityId: 'loc-1',
          actorId: null,
          actorType: 'system',
          description: expect.stringContaining('Reporte Z'),
          payload: expect.objectContaining({
            type: 'DAILY_REPORT_Z',
            locationId: 'loc-1',
            totalTransactions: 15,
            totalAmountCents: 250000,
          }),
        }),
      );
    });

    it('should format amount correctly in summary', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([{ locationId: 'loc-1' }]);

      mockTransactionRepo.getDailySummary.mockResolvedValue({
        totalTransactions: 1,
        totalAmountCents: 12345,
        byStatus: { COMPLETED: 1 },
      } as DailySummary);

      await task.handleDailyReport();

      expect(mockAuditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            totalAmountFormatted: '$123.45',
          }),
        }),
      );
    });

    it('should handle zero transactions gracefully', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([{ locationId: 'loc-empty' }]);

      mockTransactionRepo.getDailySummary.mockResolvedValue({
        totalTransactions: 0,
        totalAmountCents: 0,
        byStatus: {},
      } as DailySummary);

      await task.handleDailyReport();

      expect(mockAuditLogRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should handle unexpected errors without crashing', async () => {
      mockQueryBuilder.getRawMany.mockRejectedValue(new Error('Connection lost'));

      // Should not throw
      await expect(task.handleDailyReport()).resolves.not.toThrow();
    });
  });

  describe('date handling', () => {
    it('should query yesterday date', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([{ locationId: 'loc-1' }]);

      mockTransactionRepo.getDailySummary.mockResolvedValue({
        totalTransactions: 1,
        totalAmountCents: 1000,
        byStatus: {},
      } as DailySummary);

      await task.handleDailyReport();

      // Verify getDailySummary was called with a date from yesterday
      const callArgs = mockTransactionRepo.getDailySummary.mock.calls[0];
      const dateArg = callArgs[1] as Date;

      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      expect(dateArg.getDate()).toBe(yesterday.getDate());
    });
  });

  describe('audit log description', () => {
    it('should include date and amount in description', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([{ locationId: 'loc-1' }]);

      mockTransactionRepo.getDailySummary.mockResolvedValue({
        totalTransactions: 50,
        totalAmountCents: 5000000,
        byStatus: {},
      } as DailySummary);

      await task.handleDailyReport();

      expect(mockAuditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringMatching(/Reporte Z.*\$50000\.00/),
        }),
      );
    });
  });
});
