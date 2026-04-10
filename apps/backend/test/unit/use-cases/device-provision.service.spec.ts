/**
 * ============================================================================
 * SMART_RETAIL - DeviceProvisionService Tests
 * ============================================================================
 * Tests unitarios para el servicio de provisioning de dispositivos.
 * ============================================================================
 */

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DeviceProvisionInput } from '../../../src/application/ports/input/device-provision.use-case';
import {
    DEVICE_REPOSITORY,
    IDeviceRepository,
} from '../../../src/application/ports/output/repositories.port';
import {
    DeviceProvisionService,
} from '../../../src/application/use-cases/device-provision.service';
import { Device, DeviceStatus, DeviceType } from '../../../src/domain/entities/device.entity';
import { DeviceAlreadyExistsException } from '../../../src/domain/exceptions/device-already-exists.exception';

describe('DeviceProvisionService', () => {
  let service: DeviceProvisionService;
  let mockDeviceRepository: jest.Mocked<IDeviceRepository>;

  const baseInput: DeviceProvisionInput = {
    serialNumber: 'SN-001-TEST',
    name: 'Test Turnstile',
    type: DeviceType.TURNSTILE,
    locationId: 'loc-001',
    provisionedBy: 'admin@test.com',
  };

  beforeEach(async () => {
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
      providers: [
        DeviceProvisionService,
        { provide: DEVICE_REPOSITORY, useValue: mockDeviceRepository },
      ],
    }).compile();

    service = module.get<DeviceProvisionService>(DeviceProvisionService);

    // Silence logger
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // execute - Success scenarios
  // ─────────────────────────────────────────────────────────────────────────

  describe('execute - success scenarios', () => {
    beforeEach(() => {
      mockDeviceRepository.findBySerialNumber.mockResolvedValue(null);
      mockDeviceRepository.save.mockImplementation(async (device: Device) => device);
    });

    it('should provision device successfully', async () => {
      const result = await service.execute(baseInput);

      expect(result.device).toBeDefined();
      expect(result.apiKey).toBeDefined();
      expect(result.secret).toBeDefined();
      expect(result.provisionedAt).toBeInstanceOf(Date);
    });

    it('should generate API key with correct format', async () => {
      const result = await service.execute(baseInput);

      expect(result.apiKey).toMatch(/^SMART_RETAIL_[A-Z0-9]+_[A-F0-9]+$/);
    });

    it('should generate 64-char hex secret', async () => {
      const result = await service.execute(baseInput);

      expect(result.secret).toHaveLength(64);
      expect(result.secret).toMatch(/^[a-f0-9]+$/);
    });

    it('should create device in OFFLINE status', async () => {
      const result = await service.execute(baseInput);

      expect(result.device.status).toBe(DeviceStatus.OFFLINE);
    });

    it('should save device to repository', async () => {
      await service.execute(baseInput);

      expect(mockDeviceRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          serialNumber: 'SN-001-TEST',
          name: 'Test Turnstile',
          type: DeviceType.TURNSTILE,
          locationId: 'loc-001',
        }),
      );
    });

    it('should generate unique UUID for device ID', async () => {
      const result = await service.execute(baseInput);

      expect(result.device.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('should include config when provided', async () => {
      const inputWithConfig = {
        ...baseInput,
        config: { timeout: 5000, mode: 'fast' },
      };

      await service.execute(inputWithConfig);

      expect(mockDeviceRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          config: { timeout: 5000, mode: 'fast' },
        }),
      );
    });

    it('should use empty config when not provided', async () => {
      await service.execute(baseInput);

      expect(mockDeviceRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          config: {},
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // execute - Duplicate handling
  // ─────────────────────────────────────────────────────────────────────────

  describe('execute - duplicate handling', () => {
    it('should throw DeviceAlreadyExistsException for duplicate serial', async () => {
      const existingDevice = {
        id: 'existing-001',
        serialNumber: 'SN-001-TEST',
        name: 'Existing Device',
        type: DeviceType.TURNSTILE,
        status: DeviceStatus.ONLINE,
        locationId: 'loc-001',
      } as Device;

      mockDeviceRepository.findBySerialNumber.mockResolvedValue(existingDevice);

      await expect(service.execute(baseInput)).rejects.toThrow(
        DeviceAlreadyExistsException,
      );
    });

    it('should not save device when duplicate exists', async () => {
      mockDeviceRepository.findBySerialNumber.mockResolvedValue({
        id: 'existing',
      } as Device);

      await expect(service.execute(baseInput)).rejects.toThrow();

      expect(mockDeviceRepository.save).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // execute - Device types
  // ─────────────────────────────────────────────────────────────────────────

  describe('execute - device types', () => {
    beforeEach(() => {
      mockDeviceRepository.findBySerialNumber.mockResolvedValue(null);
      mockDeviceRepository.save.mockImplementation(async (device: Device) => device);
    });

    it('should provision TURNSTILE device', async () => {
      const result = await service.execute({
        ...baseInput,
        type: DeviceType.TURNSTILE,
      });

      expect(result.device.type).toBe(DeviceType.TURNSTILE);
    });

    it('should provision LOCKER device', async () => {
      const result = await service.execute({
        ...baseInput,
        type: DeviceType.LOCKER,
      });

      expect(result.device.type).toBe(DeviceType.LOCKER);
    });

    it('should provision DOOR device', async () => {
      const result = await service.execute({
        ...baseInput,
        type: DeviceType.DOOR,
      });

      expect(result.device.type).toBe(DeviceType.DOOR);
    });

    it('should provision KIOSK device', async () => {
      const result = await service.execute({
        ...baseInput,
        type: DeviceType.KIOSK,
      });

      expect(result.device.type).toBe(DeviceType.KIOSK);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Credential generation (security tests)
  // ─────────────────────────────────────────────────────────────────────────

  describe('credential generation', () => {
    beforeEach(() => {
      mockDeviceRepository.findBySerialNumber.mockResolvedValue(null);
      mockDeviceRepository.save.mockImplementation(async (device: Device) => device);
    });

    it('should generate unique credentials on each call', async () => {
      const result1 = await service.execute({
        ...baseInput,
        serialNumber: 'SN-001',
      });
      const result2 = await service.execute({
        ...baseInput,
        serialNumber: 'SN-002',
      });

      expect(result1.secret).not.toBe(result2.secret);
      expect(result1.apiKey).not.toBe(result2.apiKey);
    });

    it('should include sanitized serial number in API key', async () => {
      const result = await service.execute({
        ...baseInput,
        serialNumber: 'SN-001-TEST!@#',
      });

      expect(result.apiKey).toContain('SN001TEST');
    });

    it('should store hashed secret, not plaintext', async () => {
      await service.execute(baseInput);

      const savedDevice = mockDeviceRepository.save.mock.calls[0][0] as Device;
      
      // The deviceTokenHash should be a SHA-256 hash (64 hex chars)
      expect(savedDevice.deviceTokenHash).toHaveLength(64);
      expect(savedDevice.deviceTokenHash).toMatch(/^[a-f0-9]+$/);
    });
  });
});
