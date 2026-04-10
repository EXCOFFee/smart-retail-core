/**
 * ============================================================================
 * SMART_RETAIL - DeviceController Tests
 * ============================================================================
 * Tests unitarios para el controlador de dispositivos.
 * ============================================================================
 */

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
    DEVICE_PROVISION_USE_CASE,
    DeviceProvisionOutput,
    IDeviceProvisionUseCase,
} from '../../../src/application/ports/input/device-provision.use-case';
import {
    DEVICE_REPOSITORY,
    IDeviceRepository,
} from '../../../src/application/ports/output/repositories.port';
import { Device, DeviceStatus, DeviceType } from '../../../src/domain/entities/device.entity';
import { DeviceController } from '../../../src/interfaces/http/controllers/device.controller';
import {
    DeviceProvisionRequestDto,
    DeviceTypeDto,
} from '../../../src/interfaces/http/dto/device.dto';

describe('DeviceController', () => {
  let controller: DeviceController;
  let mockDeviceProvisionUseCase: jest.Mocked<IDeviceProvisionUseCase>;
  let mockDeviceRepository: jest.Mocked<IDeviceRepository>;

  const mockDevice: Device = new Device({
    id: 'device-001',
    serialNumber: 'SN-001',
    name: 'Molinete Norte',
    type: DeviceType.TURNSTILE,
    status: DeviceStatus.ONLINE,
    locationId: 'loc-001',
    deviceTokenHash: 'hash',
    lastHeartbeat: new Date('2026-01-25T10:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-25T10:00:00Z'),
  });

  beforeEach(async () => {
    mockDeviceProvisionUseCase = {
      execute: jest.fn(),
    };

    mockDeviceRepository = {
      findById: jest.fn(),
      findBySerialNumber: jest.fn(),
      findByLocationId: jest.fn(),
      findActive: jest.fn(),
      findByApiKeyHash: jest.fn(),
      save: jest.fn(),
      updateStatus: jest.fn(),
      updateHeartbeat: jest.fn(),
    } as unknown as jest.Mocked<IDeviceRepository>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeviceController],
      providers: [
        {
          provide: DEVICE_PROVISION_USE_CASE,
          useValue: mockDeviceProvisionUseCase,
        },
        {
          provide: DEVICE_REPOSITORY,
          useValue: mockDeviceRepository,
        },
      ],
    }).compile();

    controller = module.get<DeviceController>(DeviceController);

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
  // provision
  // ─────────────────────────────────────────────────────────────────────────

  describe('provision', () => {
    const provisionDto: DeviceProvisionRequestDto = {
      serialNumber: 'SN-002',
      name: 'Nuevo Molinete',
      type: DeviceTypeDto.TURNSTILE,
      locationId: 'loc-001',
    };

    const provisionOutput: DeviceProvisionOutput = {
      device: new Device({
        id: 'device-002',
        serialNumber: 'SN-002',
        name: 'Nuevo Molinete',
        type: DeviceType.TURNSTILE,
        status: DeviceStatus.OFFLINE,
        locationId: 'loc-001',
        deviceTokenHash: 'hash',
        createdAt: new Date('2026-01-25T12:00:00Z'),
        updatedAt: new Date('2026-01-25T12:00:00Z'),
      }),
      apiKey: 'api-key-plaintext',
      secret: 'secret-plaintext',
      provisionedAt: new Date('2026-01-25T12:00:00Z'),
    };

    it('should provision device successfully', async () => {
      mockDeviceProvisionUseCase.execute.mockResolvedValue(provisionOutput);

      const result = await controller.provision(provisionDto);

      expect(result).toEqual(
        expect.objectContaining({
          deviceId: 'device-002',
          serialNumber: 'SN-002',
          name: 'Nuevo Molinete',
          status: DeviceStatus.OFFLINE,
          apiKey: 'api-key-plaintext',
          secret: 'secret-plaintext',
          warning: expect.stringContaining('IMPORTANTE'),
        }),
      );
    });

    it('should map TURNSTILE type correctly', async () => {
      mockDeviceProvisionUseCase.execute.mockResolvedValue(provisionOutput);

      await controller.provision(provisionDto);

      expect(mockDeviceProvisionUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          type: DeviceType.TURNSTILE,
        }),
      );
    });

    it('should map LOCKER type correctly', async () => {
      mockDeviceProvisionUseCase.execute.mockResolvedValue(provisionOutput);

      await controller.provision({
        ...provisionDto,
        type: DeviceTypeDto.LOCKER,
      });

      expect(mockDeviceProvisionUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          type: DeviceType.LOCKER,
        }),
      );
    });

    it('should map DOOR type correctly', async () => {
      mockDeviceProvisionUseCase.execute.mockResolvedValue(provisionOutput);

      await controller.provision({
        ...provisionDto,
        type: DeviceTypeDto.DOOR,
      });

      expect(mockDeviceProvisionUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          type: DeviceType.DOOR,
        }),
      );
    });

    it('should map KIOSK type correctly', async () => {
      mockDeviceProvisionUseCase.execute.mockResolvedValue(provisionOutput);

      await controller.provision({
        ...provisionDto,
        type: DeviceTypeDto.KIOSK,
      });

      expect(mockDeviceProvisionUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          type: DeviceType.KIOSK,
        }),
      );
    });

    it('should pass config to use case', async () => {
      mockDeviceProvisionUseCase.execute.mockResolvedValue(provisionOutput);

      const dtoWithConfig = {
        ...provisionDto,
        config: { timeout: 5000 },
      };

      await controller.provision(dtoWithConfig);

      expect(mockDeviceProvisionUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          config: { timeout: 5000 },
        }),
      );
    });

    it('should propagate use case errors', async () => {
      mockDeviceProvisionUseCase.execute.mockRejectedValue(
        new Error('Serial number already exists'),
      );

      await expect(controller.provision(provisionDto)).rejects.toThrow(
        'Serial number already exists',
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // list
  // ─────────────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('should return all active devices when no locationId', async () => {
      mockDeviceRepository.findActive.mockResolvedValue([mockDevice]);

      const result = await controller.list();

      expect(mockDeviceRepository.findActive).toHaveBeenCalled();
      expect(result.devices).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by locationId when provided', async () => {
      mockDeviceRepository.findByLocationId.mockResolvedValue([mockDevice]);

      const result = await controller.list('loc-001');

      expect(mockDeviceRepository.findByLocationId).toHaveBeenCalledWith(
        'loc-001',
      );
      expect(result.devices).toHaveLength(1);
    });

    it('should map device fields correctly', async () => {
      mockDeviceRepository.findActive.mockResolvedValue([mockDevice]);

      const result = await controller.list();

      expect(result.devices[0]).toEqual(
        expect.objectContaining({
          id: 'device-001',
          serialNumber: 'SN-001',
          name: 'Molinete Norte',
          status: DeviceStatus.ONLINE,
          locationId: 'loc-001',
        }),
      );
    });

    it('should handle null lastHeartbeat', async () => {
      const deviceNoHeartbeat = new Device({
        ...mockDevice,
        id: 'device-no-hb',
        serialNumber: 'SN-NO-HB',
        lastHeartbeat: null,
      });
      mockDeviceRepository.findActive.mockResolvedValue([deviceNoHeartbeat]);

      const result = await controller.list();

      expect(result.devices[0].lastHeartbeat).toBeNull();
    });

    it('should return empty list when no devices', async () => {
      mockDeviceRepository.findActive.mockResolvedValue([]);

      const result = await controller.list();

      expect(result.devices).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getById
  // ─────────────────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('should return device when found', async () => {
      mockDeviceRepository.findById.mockResolvedValue(mockDevice);

      const result = await controller.getById('device-001');

      expect(result).toEqual(
        expect.objectContaining({
          id: 'device-001',
          serialNumber: 'SN-001',
          name: 'Molinete Norte',
        }),
      );
    });

    it('should throw error when device not found', async () => {
      mockDeviceRepository.findById.mockResolvedValue(null);

      await expect(controller.getById('nonexistent')).rejects.toThrow(
        'Dispositivo no encontrado: nonexistent',
      );
    });

    it('should format dates as ISO strings', async () => {
      mockDeviceRepository.findById.mockResolvedValue(mockDevice);

      const result = await controller.getById('device-001');

      expect(result.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(result.lastHeartbeat).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // updateStatus
  // ─────────────────────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should update status to MAINTENANCE', async () => {
      mockDeviceRepository.findById.mockResolvedValue(mockDevice);
      mockDeviceRepository.updateStatus.mockResolvedValue(undefined);

      const result = await controller.updateStatus('device-001', 'MAINTENANCE');

      expect(mockDeviceRepository.updateStatus).toHaveBeenCalledWith(
        'device-001',
        'MAINTENANCE',
      );
      expect(result).toEqual({
        success: true,
        message: expect.stringContaining('MAINTENANCE'),
      });
    });

    it('should update status to COMPROMISED', async () => {
      mockDeviceRepository.findById.mockResolvedValue(mockDevice);
      mockDeviceRepository.updateStatus.mockResolvedValue(undefined);

      const result = await controller.updateStatus('device-001', 'COMPROMISED');

      expect(mockDeviceRepository.updateStatus).toHaveBeenCalledWith(
        'device-001',
        'COMPROMISED',
      );
      expect(result.success).toBe(true);
    });

    it('should update status to OFFLINE', async () => {
      mockDeviceRepository.findById.mockResolvedValue(mockDevice);
      mockDeviceRepository.updateStatus.mockResolvedValue(undefined);

      const result = await controller.updateStatus('device-001', 'OFFLINE');

      expect(mockDeviceRepository.updateStatus).toHaveBeenCalledWith(
        'device-001',
        'OFFLINE',
      );
      expect(result.success).toBe(true);
    });

    it('should throw error when device not found', async () => {
      mockDeviceRepository.findById.mockResolvedValue(null);

      await expect(
        controller.updateStatus('nonexistent', 'MAINTENANCE'),
      ).rejects.toThrow('Dispositivo no encontrado: nonexistent');
    });
  });
});
