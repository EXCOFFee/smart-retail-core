/**
 * ============================================================================
 * SMART_RETAIL - Device Entity Tests
 * ============================================================================
 * Tests unitarios para la entidad de dominio Device.
 * ============================================================================
 */

import { Device, DeviceStatus, DeviceType } from '../../../src/domain/entities/device.entity';

describe('Device Entity', () => {
  const defaultProps = {
    id: 'device-001',
    serialNumber: 'SN-2026-ABC123',
    name: 'Molinete Entrada Norte',
    type: DeviceType.TURNSTILE,
    locationId: 'loc-001',
  };

  describe('creation', () => {
    it('should create device with required properties', () => {
      const device = new Device(defaultProps);

      expect(device.id).toBe('device-001');
      expect(device.serialNumber).toBe('SN-2026-ABC123');
      expect(device.name).toBe('Molinete Entrada Norte');
      expect(device.type).toBe(DeviceType.TURNSTILE);
      expect(device.locationId).toBe('loc-001');
    });

    it('should default status to OFFLINE', () => {
      const device = new Device(defaultProps);

      expect(device.status).toBe(DeviceStatus.OFFLINE);
    });

    it('should accept custom status', () => {
      const device = new Device({
        ...defaultProps,
        status: DeviceStatus.ONLINE,
      });

      expect(device.status).toBe(DeviceStatus.ONLINE);
    });

    it('should default config to empty object', () => {
      const device = new Device(defaultProps);

      expect(device.config).toEqual({});
    });

    it('should accept custom config', () => {
      const config = { timeout: 5000, sensitivity: 'high' };
      const device = new Device({ ...defaultProps, config });

      expect(device.config).toEqual(config);
    });

    it('should return copy of config to prevent mutation', () => {
      const config = { timeout: 5000 };
      const device = new Device({ ...defaultProps, config });

      const configCopy = device.config;
      configCopy.newProp = 'test';

      expect(device.config).toEqual({ timeout: 5000 });
    });

    it('should default lastHeartbeat to null', () => {
      const device = new Device(defaultProps);

      expect(device.lastHeartbeat).toBeNull();
    });

    it('should default deviceTokenHash to null', () => {
      const device = new Device(defaultProps);

      expect(device.deviceTokenHash).toBeNull();
    });

    it('should set createdAt and updatedAt', () => {
      const device = new Device(defaultProps);

      expect(device.createdAt).toBeInstanceOf(Date);
      expect(device.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('isOperational', () => {
    it('should return true when ONLINE', () => {
      const device = new Device({
        ...defaultProps,
        status: DeviceStatus.ONLINE,
      });

      expect(device.isOperational()).toBe(true);
    });

    it('should return false when OFFLINE', () => {
      const device = new Device({
        ...defaultProps,
        status: DeviceStatus.OFFLINE,
      });

      expect(device.isOperational()).toBe(false);
    });

    it('should return false when MAINTENANCE', () => {
      const device = new Device({
        ...defaultProps,
        status: DeviceStatus.MAINTENANCE,
      });

      expect(device.isOperational()).toBe(false);
    });

    it('should return false when COMPROMISED', () => {
      const device = new Device({
        ...defaultProps,
        status: DeviceStatus.COMPROMISED,
      });

      expect(device.isOperational()).toBe(false);
    });
  });

  describe('isCompromised', () => {
    it('should return true when COMPROMISED', () => {
      const device = new Device({
        ...defaultProps,
        status: DeviceStatus.COMPROMISED,
      });

      expect(device.isCompromised()).toBe(true);
    });

    it('should return false for other statuses', () => {
      const device = new Device({
        ...defaultProps,
        status: DeviceStatus.ONLINE,
      });

      expect(device.isCompromised()).toBe(false);
    });
  });

  describe('recordHeartbeat', () => {
    it('should update lastHeartbeat', () => {
      const device = new Device(defaultProps);
      const before = device.lastHeartbeat;

      device.recordHeartbeat();

      expect(device.lastHeartbeat).not.toBeNull();
      expect(device.lastHeartbeat).not.toEqual(before);
    });

    it('should change status from OFFLINE to ONLINE', () => {
      const device = new Device({
        ...defaultProps,
        status: DeviceStatus.OFFLINE,
      });

      device.recordHeartbeat();

      expect(device.status).toBe(DeviceStatus.ONLINE);
    });

    it('should keep ONLINE status unchanged', () => {
      const device = new Device({
        ...defaultProps,
        status: DeviceStatus.ONLINE,
      });

      device.recordHeartbeat();

      expect(device.status).toBe(DeviceStatus.ONLINE);
    });

    it('should not change MAINTENANCE status', () => {
      const device = new Device({
        ...defaultProps,
        status: DeviceStatus.MAINTENANCE,
      });

      device.recordHeartbeat();

      // Heartbeat should still be recorded but status unchanged
      expect(device.lastHeartbeat).not.toBeNull();
      expect(device.status).toBe(DeviceStatus.MAINTENANCE);
    });

    it('should update updatedAt', () => {
      const device = new Device(defaultProps);
      const before = device.updatedAt;

      // Small delay to ensure different timestamp
      device.recordHeartbeat();

      expect(device.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('markOffline', () => {
    it('should change ONLINE to OFFLINE', () => {
      const device = new Device({
        ...defaultProps,
        status: DeviceStatus.ONLINE,
      });

      device.markOffline();

      expect(device.status).toBe(DeviceStatus.OFFLINE);
    });

    it('should not change if already OFFLINE', () => {
      const device = new Device({
        ...defaultProps,
        status: DeviceStatus.OFFLINE,
      });
      const beforeUpdate = device.updatedAt;

      device.markOffline();

      expect(device.status).toBe(DeviceStatus.OFFLINE);
      // updatedAt should not change if status didn't change
      expect(device.updatedAt).toEqual(beforeUpdate);
    });

    it('should not change MAINTENANCE status', () => {
      const device = new Device({
        ...defaultProps,
        status: DeviceStatus.MAINTENANCE,
      });

      device.markOffline();

      expect(device.status).toBe(DeviceStatus.MAINTENANCE);
    });
  });

  describe('enableMaintenanceMode', () => {
    it('should set status to MAINTENANCE', () => {
      const device = new Device({
        ...defaultProps,
        status: DeviceStatus.ONLINE,
      });

      device.enableMaintenanceMode();

      expect(device.status).toBe(DeviceStatus.MAINTENANCE);
    });

    it('should work from any status', () => {
      const device = new Device({
        ...defaultProps,
        status: DeviceStatus.OFFLINE,
      });

      device.enableMaintenanceMode();

      expect(device.status).toBe(DeviceStatus.MAINTENANCE);
    });
  });

  describe('disableMaintenanceMode', () => {
    it('should set status to OFFLINE', () => {
      const device = new Device({
        ...defaultProps,
        status: DeviceStatus.MAINTENANCE,
      });

      device.disableMaintenanceMode();

      expect(device.status).toBe(DeviceStatus.OFFLINE);
    });
  });

  describe('markCompromised', () => {
    it('should set status to COMPROMISED', () => {
      const device = new Device({
        ...defaultProps,
        status: DeviceStatus.ONLINE,
      });

      device.markCompromised();

      expect(device.status).toBe(DeviceStatus.COMPROMISED);
    });

    it('should revoke device token', () => {
      const device = new Device({
        ...defaultProps,
        deviceTokenHash: 'some-token-hash',
      });

      device.markCompromised();

      expect(device.deviceTokenHash).toBeNull();
    });
  });

  describe('setDeviceToken', () => {
    it('should set new device token hash', () => {
      const device = new Device(defaultProps);

      device.setDeviceToken('new-token-hash');

      expect(device.deviceTokenHash).toBe('new-token-hash');
    });

    it('should update updatedAt', () => {
      const device = new Device(defaultProps);
      const before = device.updatedAt;

      device.setDeviceToken('token');

      expect(device.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('updateConfig', () => {
    it('should merge new config with existing', () => {
      const device = new Device({
        ...defaultProps,
        config: { timeout: 5000, mode: 'normal' },
      });

      device.updateConfig({ sensitivity: 'high' });

      expect(device.config).toEqual({
        timeout: 5000,
        mode: 'normal',
        sensitivity: 'high',
      });
    });

    it('should override existing keys', () => {
      const device = new Device({
        ...defaultProps,
        config: { timeout: 5000 },
      });

      device.updateConfig({ timeout: 10000 });

      expect(device.config).toEqual({ timeout: 10000 });
    });
  });

  describe('DeviceType enum', () => {
    it('should have all expected types', () => {
      expect(DeviceType.TURNSTILE).toBe('TURNSTILE');
      expect(DeviceType.LOCKER).toBe('LOCKER');
      expect(DeviceType.DOOR).toBe('DOOR');
      expect(DeviceType.KIOSK).toBe('KIOSK');
    });
  });

  describe('DeviceStatus enum', () => {
    it('should have all expected statuses', () => {
      expect(DeviceStatus.ONLINE).toBe('ONLINE');
      expect(DeviceStatus.OFFLINE).toBe('OFFLINE');
      expect(DeviceStatus.MAINTENANCE).toBe('MAINTENANCE');
      expect(DeviceStatus.COMPROMISED).toBe('COMPROMISED');
    });
  });
});
