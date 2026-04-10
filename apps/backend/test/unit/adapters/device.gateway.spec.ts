/**
 * ============================================================================
 * SMART_RETAIL - DeviceGateway Tests
 * ============================================================================
 * Tests unitarios para el gateway WebSocket de dispositivos IoT.
 * ============================================================================
 */

import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { DeviceCommand } from '../../../src/application/ports/output/device-gateway.port';
import { DeviceGateway } from '../../../src/infrastructure/adapters/websocket/device.gateway';

// Tipos para mocks parciales
type MockConfigService = Pick<ConfigService, 'getOrThrow' | 'get'>;
type MockJwtService = Pick<JwtService, 'verify'>;

// Tipo para mock de Server parcial - permite propiedades adicionales
interface MockServer {
  to?: jest.Mock;
  sockets?: {
    sockets?: Map<string, unknown>;
  };
  [key: string]: unknown;
}

// Tipo para el gateway con acceso a propiedades privadas en tests
// Usamos unknown para evitar conflictos de tipos con mocks parciales
interface TestableDeviceGateway {
  server: MockServer;
  pendingCommands: Map<string, unknown>;
  eventHandlers: Array<unknown>;
}

describe('DeviceGateway', () => {
  let gateway: DeviceGateway;
  let testableGateway: TestableDeviceGateway;

  const mockConfigService: jest.Mocked<MockConfigService> = {
    getOrThrow: jest.fn().mockReturnValue('mock-public-key'),
    get: jest.fn(),
  };

  const mockJwtService: jest.Mocked<MockJwtService> = {
    verify: jest.fn(),
  };

  // Usamos Socket para el tipo de retorno del mock
  // El mock es parcial pero compatible con los métodos que probamos
  const createMockSocket = (overrides = {}): Socket => ({
    id: 'socket-123',
    handshake: {
      auth: { token: 'valid-jwt-token' },
      headers: {},
    },
    data: {},
    disconnect: jest.fn(),
    join: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
    ...overrides,
  }) as unknown as Socket;

  beforeEach(() => {
    gateway = new DeviceGateway(
      mockConfigService as unknown as ConfigService,
      mockJwtService as unknown as JwtService,
    );
    testableGateway = gateway as unknown as TestableDeviceGateway;
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // LIFECYCLE HOOKS
  // ─────────────────────────────────────────────────────────────────────────

  describe('afterInit', () => {
    it('should log initialization', () => {
      expect(() => gateway.afterInit()).not.toThrow();
    });
  });

  describe('handleConnection', () => {
    it('should accept connection with valid JWT', async () => {
      const mockSocket = createMockSocket();
      const mockPayload = {
        deviceId: 'device-001',
        locationId: 'loc-001',
      };
      mockJwtService.verify.mockReturnValue(mockPayload);

      await gateway.handleConnection(mockSocket);

      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-jwt-token', {
        publicKey: 'mock-public-key',
        algorithms: ['RS256'],
      });
      expect(mockSocket.data.deviceId).toBe('device-001');
      expect(mockSocket.data.locationId).toBe('loc-001');
      expect(mockSocket.join).toHaveBeenCalledWith('location:loc-001');
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });

    it('should reject connection without token', async () => {
      const mockSocket = createMockSocket({
        handshake: { auth: {}, headers: {} },
      });

      await gateway.handleConnection(mockSocket);

      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    });

    it('should accept token from Authorization header', async () => {
      const mockSocket = createMockSocket({
        handshake: {
          auth: {},
          headers: { authorization: 'Bearer header-jwt-token' },
        },
      });
      const mockPayload = { deviceId: 'device-002', locationId: 'loc-002' };
      mockJwtService.verify.mockReturnValue(mockPayload);

      await gateway.handleConnection(mockSocket);

      expect(mockJwtService.verify).toHaveBeenCalledWith('header-jwt-token', expect.any(Object));
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });

    it('should reject connection with invalid JWT', async () => {
      const mockSocket = createMockSocket();
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await gateway.handleConnection(mockSocket);

      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('handleDisconnect', () => {
    it('should clean up device on disconnect', async () => {
      const mockSocket = createMockSocket();
      mockSocket.data = {
        deviceId: 'device-001',
        locationId: 'loc-001',
        connectedAt: new Date(),
      };

      // Register the device first
      gateway.handleRegister(mockSocket, {
        serialNumber: 'SN-001',
        firmwareVersion: '1.0.0',
        deviceType: 'molinete',
      });

      // Then disconnect
      gateway.handleDisconnect(mockSocket);

      expect(() => gateway.handleDisconnect(mockSocket)).not.toThrow();
    });

    it('should handle disconnect of unknown socket gracefully', () => {
      const mockSocket = createMockSocket({ id: 'unknown-socket' });

      expect(() => gateway.handleDisconnect(mockSocket)).not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // MESSAGE HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  describe('handleRegister', () => {
    it('should register device successfully', () => {
      const mockSocket = createMockSocket();
      mockSocket.data = {
        deviceId: 'device-001',
        locationId: 'loc-001',
        connectedAt: new Date(),
      };

      const result = gateway.handleRegister(mockSocket, {
        serialNumber: 'SN-001',
        firmwareVersion: '1.0.0',
        deviceType: 'molinete',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Device registered successfully');
    });

    it('should throw WsException for unauthenticated device', () => {
      const mockSocket = createMockSocket();
      mockSocket.data = {}; // No deviceId

      expect(() =>
        gateway.handleRegister(mockSocket, {
          serialNumber: 'SN-001',
          firmwareVersion: '1.0.0',
          deviceType: 'molinete',
        }),
      ).toThrow(WsException);
    });
  });

  describe('handleHeartbeat', () => {
    it('should acknowledge heartbeat for registered device', () => {
      const mockSocket = createMockSocket();
      mockSocket.data = {
        deviceId: 'device-001',
        locationId: 'loc-001',
        connectedAt: new Date(),
      };

      // First register
      gateway.handleRegister(mockSocket, {
        serialNumber: 'SN-001',
        firmwareVersion: '1.0.0',
        deviceType: 'molinete',
      });

      const result = gateway.handleHeartbeat(mockSocket, {
        serialNumber: 'SN-001',
        status: 'online',
        metrics: { cpu: 45, memory: 60 },
      });

      expect(result.received).toBe(true);
    });

    it('should handle heartbeat for unregistered device', () => {
      const mockSocket = createMockSocket();
      mockSocket.data = { deviceId: 'device-unknown' };

      const result = gateway.handleHeartbeat(mockSocket, {
        serialNumber: 'SN-UNKNOWN',
        status: 'online',
      });

      expect(result.received).toBe(true);
    });
  });

  describe('handleAck', () => {
    it('should handle ACK for unknown command gracefully', () => {
      const mockSocket = createMockSocket();

      expect(() =>
        gateway.handleAck(mockSocket, {
          commandId: 'unknown-cmd',
          success: true,
          timestamp: Date.now(),
        }),
      ).not.toThrow();
    });
  });

  describe('handleError', () => {
    it('should log device errors', () => {
      const mockSocket = createMockSocket();

      expect(() =>
        gateway.handleError(mockSocket, {
          serialNumber: 'SN-001',
          errorCode: 'E001',
          message: 'Sensor malfunction',
          recoverable: true,
        }),
      ).not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // OUTPUT PORT IMPLEMENTATION
  // ─────────────────────────────────────────────────────────────────────────

  describe('isDeviceConnected', () => {
    it('should return true for connected device', async () => {
      const mockSocket = createMockSocket();
      mockSocket.data = {
        deviceId: 'device-001',
        locationId: 'loc-001',
        connectedAt: new Date(),
      };

      gateway.handleRegister(mockSocket, {
        serialNumber: 'SN-001',
        firmwareVersion: '1.0.0',
        deviceType: 'molinete',
      });

      expect(await gateway.isDeviceConnected('device-001')).toBe(true);
    });

    it('should return false for disconnected device', async () => {
      expect(await gateway.isDeviceConnected('non-existent')).toBe(false);
    });
  });

  describe('getConnectedDevices count', () => {
    it('should return correct count', () => {
      expect(gateway.getConnectedDevices().length).toBe(0);

      const mockSocket = createMockSocket();
      mockSocket.data = {
        deviceId: 'device-001',
        locationId: 'loc-001',
        connectedAt: new Date(),
      };

      gateway.handleRegister(mockSocket, {
        serialNumber: 'SN-001',
        firmwareVersion: '1.0.0',
        deviceType: 'molinete',
      });

      expect(gateway.getConnectedDevices().length).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SEND COMMAND
  // ─────────────────────────────────────────────────────────────────────────

  describe('sendCommand', () => {
    beforeEach(() => {
      // Setup mock server
      testableGateway.server = {
        to: jest.fn().mockReturnValue({
          emit: jest.fn(),
        }),
        sockets: {
          sockets: new Map(),
        },
      };
    });

    it('should return not connected for unknown device', async () => {
      const result = await gateway.sendCommand('unknown-device', DeviceCommand.OPEN);

      expect(result.acknowledged).toBe(false);
      expect(result.connected).toBe(false);
      expect(result.message).toBe('Device not connected');
    });

    it('should send command to connected device', async () => {
      const mockSocket = createMockSocket();
      mockSocket.data = {
        deviceId: 'device-001',
        locationId: 'loc-001',
        connectedAt: new Date(),
      };

      gateway.handleRegister(mockSocket, {
        serialNumber: 'SN-001',
        firmwareVersion: '1.0.0',
        deviceType: 'molinete',
      });

      // Run command with short timeout - will timeout since no ACK
      const result = await gateway.sendCommand('device-001', DeviceCommand.OPEN, 50);

      expect(result.acknowledged).toBe(false);
      expect(result.connected).toBe(true);
      expect(result.message).toBe('ACK timeout');
    });

    it('should resolve command when ACK is received', async () => {
      const mockSocket = createMockSocket();
      mockSocket.data = {
        deviceId: 'device-ack',
        locationId: 'loc-ack',
        connectedAt: new Date(),
      };

      gateway.handleRegister(mockSocket, {
        serialNumber: 'SN-ACK',
        firmwareVersion: '1.0.0',
        deviceType: 'molinete',
      });

      // Start command - will create pending entry
      const commandPromise = gateway.sendCommand('device-ack', DeviceCommand.OPEN, 5000);

      // Wait a tick for the command to be registered
      await new Promise((resolve) => setImmediate(resolve));

      // Get the pending command ID (it was generated internally)
      const pendingCommands = testableGateway.pendingCommands as Map<string, unknown>;
      const commandId = Array.from(pendingCommands.keys())[0];

      // Simulate device ACK arriving
      gateway.handleAck(mockSocket, {
        commandId,
        success: true,
        timestamp: Date.now(),
      });

      const result = await commandPromise;

      expect(result.acknowledged).toBe(true);
      expect(result.connected).toBe(true);
      expect(result.latencyMs).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // OPEN AND WAIT CONFIRMATION
  // ─────────────────────────────────────────────────────────────────────────

  describe('openAndWaitConfirmation', () => {
    beforeEach(() => {
      testableGateway.server = {
        to: jest.fn().mockReturnValue({
          emit: jest.fn(),
        }),
        sockets: {
          sockets: new Map(),
        },
      };
    });

    it('should return false when device not connected', async () => {
      const result = await gateway.openAndWaitConfirmation(
        'unknown-device',
        'tx-123',
        100,
      );

      expect(result).toBe(false);
    });

    it('should return false on timeout', async () => {
      const mockSocket = createMockSocket();
      mockSocket.data = {
        deviceId: 'device-002',
        locationId: 'loc-002',
        connectedAt: new Date(),
      };

      gateway.handleRegister(mockSocket, {
        serialNumber: 'SN-002',
        firmwareVersion: '1.0.0',
        deviceType: 'molinete',
      });

      const result = await gateway.openAndWaitConfirmation(
        'device-002',
        'tx-456',
        50,
      );

      expect(result).toBe(false);
    });

    it('should return true when device acknowledges open command', async () => {
      const mockSocket = createMockSocket();
      mockSocket.data = {
        deviceId: 'device-open-ack',
        locationId: 'loc-open-ack',
        connectedAt: new Date(),
      };

      gateway.handleRegister(mockSocket, {
        serialNumber: 'SN-OPEN-ACK',
        firmwareVersion: '1.0.0',
        deviceType: 'molinete',
      });

      // Start the open command
      const openPromise = gateway.openAndWaitConfirmation(
        'device-open-ack',
        'tx-ack-success',
        5000,
      );

      // Wait for command to be registered
      await new Promise((resolve) => setImmediate(resolve));

      // Get pending command ID and send ACK
      const pendingCommands = testableGateway.pendingCommands as Map<string, unknown>;
      const commandId = Array.from(pendingCommands.keys())[0];

      gateway.handleAck(mockSocket, {
        commandId,
        success: true,
        timestamp: Date.now(),
      });

      const result = await openPromise;

      expect(result).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // FORCE DISCONNECT
  // ─────────────────────────────────────────────────────────────────────────

  describe('forceDisconnect', () => {
    beforeEach(() => {
      const mockSocketInstance = createMockSocket();
      testableGateway.server = {
        to: jest.fn().mockReturnValue({
          emit: jest.fn(),
        }),
        sockets: {
          sockets: new Map([['socket-123', mockSocketInstance]]),
        },
      };
    });

    it('should do nothing for unknown device', async () => {
      await expect(gateway.forceDisconnect('unknown-device')).resolves.not.toThrow();
    });

    it('should disconnect registered device', async () => {
      const mockSocket = createMockSocket();
      mockSocket.data = {
        deviceId: 'device-003',
        locationId: 'loc-003',
        connectedAt: new Date(),
      };

      gateway.handleRegister(mockSocket, {
        serialNumber: 'SN-003',
        firmwareVersion: '1.0.0',
        deviceType: 'molinete',
      });

      expect(await gateway.isDeviceConnected('device-003')).toBe(true);

      await gateway.forceDisconnect('device-003');

      expect(await gateway.isDeviceConnected('device-003')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SEND CONFIG
  // ─────────────────────────────────────────────────────────────────────────

  describe('sendConfig', () => {
    beforeEach(() => {
      testableGateway.server = {
        to: jest.fn().mockReturnValue({
          emit: jest.fn(),
        }),
      };
    });

    it('should return false for unknown device', async () => {
      const result = await gateway.sendConfig('unknown', { key: 'value' });

      expect(result).toBe(false);
    });

    it('should send config to connected device', async () => {
      const mockSocket = createMockSocket();
      mockSocket.data = {
        deviceId: 'device-004',
        locationId: 'loc-004',
        connectedAt: new Date(),
      };

      gateway.handleRegister(mockSocket, {
        serialNumber: 'SN-004',
        firmwareVersion: '1.0.0',
        deviceType: 'molinete',
      });

      const result = await gateway.sendConfig('device-004', { timeout: 5000 });

      expect(result).toBe(true);
      expect(testableGateway.server.to).toHaveBeenCalledWith('socket-123');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // BROADCAST TO LOCATION
  // ─────────────────────────────────────────────────────────────────────────

  describe('broadcastToLocation', () => {
    it('should broadcast to location room', async () => {
      const mockEmit = jest.fn();
      testableGateway.server = {
        to: jest.fn().mockReturnValue({
          emit: mockEmit,
        }),
      };

      await gateway.broadcastToLocation('loc-001', 'test:event', { data: 'value' });

      expect(testableGateway.server.to).toHaveBeenCalledWith('location:loc-001');
      expect(mockEmit).toHaveBeenCalledWith('test:event', { data: 'value' });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // EVENT HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  describe('onDeviceEvent', () => {
    it('should register event handler', () => {
      const handler = jest.fn();

      gateway.onDeviceEvent(handler);

      expect(testableGateway.eventHandlers).toContain(handler);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CONNECTED COUNT
  // ─────────────────────────────────────────────────────────────────────────

  describe('getConnectedCount', () => {
    it('should return 0 initially', () => {
      expect(gateway.getConnectedCount()).toBe(0);
    });

    it('should return correct count after registrations', () => {
      const mockSocket = createMockSocket({ id: 'socket-A' });
      mockSocket.data = {
        deviceId: 'device-A',
        locationId: 'loc-A',
        connectedAt: new Date(),
      };

      gateway.handleRegister(mockSocket, {
        serialNumber: 'SN-A',
        firmwareVersion: '1.0.0',
        deviceType: 'molinete',
      });

      expect(gateway.getConnectedCount()).toBe(1);
    });
  });
});
