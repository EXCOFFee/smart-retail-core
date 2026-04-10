/**
 * Tests para DeviceRepository (Unit con mocks)
 */

import { Repository, SelectQueryBuilder, UpdateResult } from 'typeorm';

import { Device, DeviceStatus, DeviceType } from '@domain/entities/device.entity';
import { DeviceOrmEntity, DeviceStatusOrm, DeviceTypeOrm } from '@infrastructure/database/entities/device.orm-entity';
import { DeviceRepository } from '@infrastructure/database/repositories/device.repository';

/**
 * Crea un UpdateResult tipado para TypeORM.
 */
function createUpdateResult(affected: number): UpdateResult {
  return { raw: [], affected, generatedMaps: [] };
}

describe('DeviceRepository', () => {
  let repository: DeviceRepository;
  let mockTypeOrmRepo: jest.Mocked<Repository<DeviceOrmEntity>>;
  let mockQueryBuilder: jest.Mocked<SelectQueryBuilder<DeviceOrmEntity>>;

  const mockOrmDevice: DeviceOrmEntity = {
    id: 'device-123',
    serialNumber: 'SN-001',
    name: 'Molinete Principal',
    type: DeviceTypeOrm.TURNSTILE,
    status: DeviceStatusOrm.ONLINE,
    locationId: 'loc-1',
    config: { maxAccessesPerMinute: 10 },
    lastHeartbeatAt: new Date('2025-01-25T03:00:00Z'),
    createdAt: new Date('2024-06-01'),
    updatedAt: new Date('2025-01-25'),
  } as DeviceOrmEntity;

  beforeEach(() => {
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    } as unknown as jest.Mocked<SelectQueryBuilder<DeviceOrmEntity>>;

    mockTypeOrmRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    } as unknown as jest.Mocked<Repository<DeviceOrmEntity>>;

    repository = new DeviceRepository(mockTypeOrmRepo);
  });

  describe('findById', () => {
    it('should return domain device when found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockOrmDevice);

      const result = await repository.findById('device-123');

      expect(result).toBeInstanceOf(Device);
      expect(result?.id).toBe('device-123');
      expect(result?.serialNumber).toBe('SN-001');
      expect(result?.name).toBe('Molinete Principal');
      expect(result?.type).toBe(DeviceType.TURNSTILE);
      expect(result?.status).toBe(DeviceStatus.ONLINE);
    });

    it('should return null when device not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should handle device without lastHeartbeat', async () => {
      const ormWithoutHeartbeat = { ...mockOrmDevice, lastHeartbeatAt: null };
      mockTypeOrmRepo.findOne.mockResolvedValue(ormWithoutHeartbeat as DeviceOrmEntity);

      const result = await repository.findById('device-123');

      expect(result).not.toBeNull();
      expect(result?.lastHeartbeat).toBeNull();
    });
  });

  describe('findBySerialNumber', () => {
    it('should return domain device when found by serial', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockOrmDevice);

      const result = await repository.findBySerialNumber('SN-001');

      expect(result?.serialNumber).toBe('SN-001');
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { serialNumber: 'SN-001' },
      });
    });

    it('should return null when serial not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findBySerialNumber('UNKNOWN-SN');

      expect(result).toBeNull();
    });
  });

  describe('findByLocationId', () => {
    it('should return devices for location', async () => {
      const devices = [
        mockOrmDevice,
        { ...mockOrmDevice, id: 'device-456', name: 'Molinete 2' },
      ];
      mockTypeOrmRepo.find.mockResolvedValue(devices as DeviceOrmEntity[]);

      const result = await repository.findByLocationId('loc-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Device);
      expect(mockTypeOrmRepo.find).toHaveBeenCalledWith({
        where: { locationId: 'loc-1' },
        order: { name: 'ASC' },
      });
    });

    it('should return empty array when no devices in location', async () => {
      mockTypeOrmRepo.find.mockResolvedValue([]);

      const result = await repository.findByLocationId('empty-location');

      expect(result).toEqual([]);
    });
  });

  describe('findActive', () => {
    it('should return online and offline devices', async () => {
      const devices = [
        { ...mockOrmDevice, status: DeviceStatusOrm.ONLINE },
        { ...mockOrmDevice, id: 'device-456', status: DeviceStatusOrm.OFFLINE },
      ];
      mockTypeOrmRepo.find.mockResolvedValue(devices as DeviceOrmEntity[]);

      const result = await repository.findActive();

      expect(result).toHaveLength(2);
      expect(mockTypeOrmRepo.find).toHaveBeenCalledWith({
        where: [
          { status: DeviceStatusOrm.ONLINE },
          { status: DeviceStatusOrm.OFFLINE },
        ],
        order: { locationId: 'ASC', name: 'ASC' },
      });
    });
  });

  describe('save', () => {
    it('should persist device and return domain entity', async () => {
      const domainDevice = new Device({
        id: 'new-device',
        serialNumber: 'SN-NEW',
        name: 'New Device',
        type: DeviceType.LOCKER,
        status: DeviceStatus.OFFLINE,
        locationId: 'loc-2',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockTypeOrmRepo.save.mockResolvedValue({
        ...mockOrmDevice,
        id: 'new-device',
        serialNumber: 'SN-NEW',
        name: 'New Device',
        type: DeviceTypeOrm.LOCKER,
        status: DeviceStatusOrm.OFFLINE,
      } as DeviceOrmEntity);

      const result = await repository.save(domainDevice);

      expect(result).toBeInstanceOf(Device);
      expect(result.id).toBe('new-device');
      expect(mockTypeOrmRepo.save).toHaveBeenCalled();
    });

    it('should map all device types correctly', async () => {
      const types = [
        { domain: DeviceType.TURNSTILE, orm: DeviceTypeOrm.TURNSTILE },
        { domain: DeviceType.LOCKER, orm: DeviceTypeOrm.LOCKER },
        { domain: DeviceType.DOOR, orm: DeviceTypeOrm.DOOR },
        { domain: DeviceType.KIOSK, orm: DeviceTypeOrm.KIOSK },
      ];

      for (const { domain, orm } of types) {
        const device = new Device({
          id: 'test-device',
          serialNumber: 'SN-TEST',
          name: 'Test',
          type: domain,
          status: DeviceStatus.ONLINE,
          locationId: 'loc-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        mockTypeOrmRepo.save.mockResolvedValue({
          ...mockOrmDevice,
          type: orm,
        } as DeviceOrmEntity);

        await repository.save(device);

        const savedEntity = mockTypeOrmRepo.save.mock.calls[mockTypeOrmRepo.save.mock.calls.length - 1][0] as DeviceOrmEntity;
        expect(savedEntity.type).toBe(orm);
      }
    });
  });

  describe('updateStatus', () => {
    it('should update status atomically', async () => {
      mockTypeOrmRepo.update.mockResolvedValue(createUpdateResult(1));

      await repository.updateStatus('device-123', 'MAINTENANCE');

      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        { id: 'device-123' },
        expect.objectContaining({
          status: 'MAINTENANCE',
          updatedAt: expect.any(Date),
        }),
      );
    });
  });

  describe('updateHeartbeat', () => {
    it('should update heartbeat and set status to ONLINE', async () => {
      mockTypeOrmRepo.update.mockResolvedValue(createUpdateResult(1));
      const timestamp = new Date();

      await repository.updateHeartbeat('device-123', timestamp);

      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        { id: 'device-123' },
        expect.objectContaining({
          lastHeartbeatAt: timestamp,
          status: DeviceStatusOrm.ONLINE,
          updatedAt: expect.any(Date),
        }),
      );
    });
  });

  describe('findStaleDevices', () => {
    it('should find devices without recent heartbeat', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockOrmDevice]);

      const result = await repository.findStaleDevices(5);

      expect(result).toHaveLength(1);
      expect(mockTypeOrmRepo.createQueryBuilder).toHaveBeenCalledWith('device');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'device.status = :status',
        { status: DeviceStatusOrm.ONLINE },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(device.last_heartbeat_at < :threshold OR device.last_heartbeat_at IS NULL)',
        expect.objectContaining({ threshold: expect.any(Date) }),
      );
    });

    it('should return empty array when no stale devices', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      const result = await repository.findStaleDevices(5);

      expect(result).toEqual([]);
    });
  });

  describe('config handling', () => {
    it('should preserve config in mapping', async () => {
      const ormWithConfig = {
        ...mockOrmDevice,
        config: { maxAccessesPerMinute: 20, enableAudio: true },
      };
      mockTypeOrmRepo.findOne.mockResolvedValue(ormWithConfig as DeviceOrmEntity);

      const result = await repository.findById('device-123');

      expect(result?.config).toEqual({ maxAccessesPerMinute: 20, enableAudio: true });
    });

    it('should handle null config', async () => {
      const ormWithNullConfig = { ...mockOrmDevice, config: null };
      mockTypeOrmRepo.findOne.mockResolvedValue(ormWithNullConfig as unknown as DeviceOrmEntity);

      const result = await repository.findById('device-123');

      expect(result?.config).toEqual({});
    });
  });
});
