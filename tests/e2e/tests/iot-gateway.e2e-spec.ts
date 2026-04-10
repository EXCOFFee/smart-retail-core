/**
 * ============================================================================
 * SMART_RETAIL - IoT WebSocket Gateway E2E Tests
 * ============================================================================
 * Tests para el gateway WebSocket que controla dispositivos IoT.
 * 
 * IMPLEMENTA:
 * - CU-04: Reembolso por fallo de hardware
 * - CU-09: Reconexión WebSocket
 * - CU-18: Alerta de puerta forzada
 * ============================================================================
 */

import {
    MockDeviceClient,
    MockWebSocketGateway,
    mockWebSocketGateway,
} from '../mocks/websocket-gateway';

// ─────────────────────────────────────────────────────────────────────────────
// TEST SETUP
// ─────────────────────────────────────────────────────────────────────────────

describe('IoT WebSocket Gateway (E2E with Mocks)', () => {
  let gateway: MockWebSocketGateway;
  let deviceClient: MockDeviceClient;

  const GATEWAY_PORT = 3002;

  beforeAll(async () => {
    gateway = mockWebSocketGateway;
    await gateway.start();
  });

  afterAll(async () => {
    if (deviceClient) {
      deviceClient.disconnect();
    }
    await gateway.stop();
  });

  beforeEach(() => {
    gateway.reset();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Device Connection Tests
  // ─────────────────────────────────────────────────────────────────────────
  describe('Device Connection Management', () => {
    it('should accept device connection and track state', async () => {
      // Arrange
      deviceClient = new MockDeviceClient('device-001', `ws://localhost:${GATEWAY_PORT}`);
      
      // Act
      await deviceClient.connect();
      
      // Assert
      const state = gateway.getDeviceState('device-001');
      expect(state).toBeDefined();
      expect(state?.status).toBe('online');
      
      deviceClient.disconnect();
    });

    it('should handle device disconnection gracefully', async () => {
      // Arrange
      deviceClient = new MockDeviceClient('device-test', `ws://localhost:${GATEWAY_PORT}`);
      
      const disconnectPromise = new Promise<void>((resolve) => {
        gateway.once('device:disconnected', (deviceId) => {
          expect(deviceId).toBe('device-test');
          resolve();
        });
      });
      
      // Act
      await deviceClient.connect();
      deviceClient.disconnect();
      
      // Assert
      await disconnectPromise;
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CU-04: Reembolso por Fallo de Hardware
  // ─────────────────────────────────────────────────────────────────────────
  describe('CU-04: Hardware Failure Refund', () => {
    it('should handle command timeout (device not responding)', async () => {
      // Arrange
      deviceClient = new MockDeviceClient('device-001', `ws://localhost:${GATEWAY_PORT}`);
      await deviceClient.connect();
      
      // Configurar dispositivo para no responder (timeout)
      deviceClient.setBehavior('timeout');
      
      let commandReceived = false;
      deviceClient.on('command', (command) => {
        expect(command).toBe('OPEN');
        commandReceived = true;
      });
      
      // Act: enviar comando OPEN
      const result = await gateway.sendCommand('device-001', 'OPEN');
      
      // Assert
      expect(result).toBe(true); // Comando enviado
      
      // Esperar un poco para verificar que se recibió
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(commandReceived).toBe(true);
      
      // El dispositivo no envía ACK, simulando timeout
      // En producción, esto triggearía el refund automático
      
      deviceClient.disconnect();
    });

    it('should handle negative ACK (device failure)', async () => {
      // Arrange
      deviceClient = new MockDeviceClient('device-001', `ws://localhost:${GATEWAY_PORT}`);
      await deviceClient.connect();
      
      // Configurar dispositivo para enviar NACK
      deviceClient.setBehavior('nack');
      
      const ackPromise = new Promise<{ success: boolean }>((resolve) => {
        gateway.once('device:ack', ({ message }) => {
          const payload = message.payload as { success: boolean };
          resolve(payload);
        });
      });
      
      // Act
      await gateway.sendCommand('device-001', 'OPEN');
      const ackResult = await ackPromise;
      
      // Assert: dispositivo reporta falla
      expect(ackResult.success).toBe(false);
      
      deviceClient.disconnect();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CU-09: Reconexión WebSocket
  // ─────────────────────────────────────────────────────────────────────────
  describe('CU-09: WebSocket Reconnection', () => {
    it('should track device reconnection attempts', async () => {
      // Arrange
      deviceClient = new MockDeviceClient('device-reconnect', `ws://localhost:${GATEWAY_PORT}`);
      
      let connectionCount = 0;
      gateway.on('device:connected', (deviceId) => {
        if (deviceId === 'device-reconnect') {
          connectionCount++;
        }
      });
      
      // Act: conectar
      await deviceClient.connect();
      expect(connectionCount).toBe(1);
      
      // Simular desconexión y reconexión
      deviceClient.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      await deviceClient.connect();
      expect(connectionCount).toBe(2);
      
      deviceClient.disconnect();
    });

    it('should maintain command history across reconnections', async () => {
      // Arrange
      deviceClient = new MockDeviceClient('device-001', `ws://localhost:${GATEWAY_PORT}`);
      await deviceClient.connect();
      
      // Enviar comando antes de desconexión
      await gateway.sendCommand('device-001', 'OPEN');
      
      const historyBefore = gateway.getCommandHistory();
      expect(historyBefore.length).toBe(1);
      
      // Simular desconexión y reconexión
      deviceClient.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));
      await deviceClient.connect();
      
      // Enviar otro comando
      await gateway.sendCommand('device-001', 'CLOSE');
      
      // Assert: historial debe mantener ambos comandos
      const historyAfter = gateway.getCommandHistory();
      expect(historyAfter.length).toBe(2);
      
      deviceClient.disconnect();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CU-18: Alerta de Puerta Forzada
  // ─────────────────────────────────────────────────────────────────────────
  describe('CU-18: Forced Entry Detection (Security Breach)', () => {
    it('should detect sensor activation without prior command', async () => {
      // Arrange
      deviceClient = new MockDeviceClient('device-001', `ws://localhost:${GATEWAY_PORT}`);
      await deviceClient.connect();
      
      const breachPromise = new Promise<{ deviceId: string; severity: string }>((resolve) => {
        gateway.once('security:breach', (event) => {
          resolve(event);
        });
      });
      
      // Act: enviar evento de sensor SIN comando previo
      deviceClient.sendSensorEvent(false);
      
      // Assert
      const breachEvent = await breachPromise;
      expect(breachEvent.deviceId).toBe('device-001');
      expect(breachEvent.severity).toBe('critical');
      
      deviceClient.disconnect();
    });

    it('should NOT trigger breach alert for normal sensor activation', async () => {
      // Arrange
      deviceClient = new MockDeviceClient('device-001', `ws://localhost:${GATEWAY_PORT}`);
      await deviceClient.connect();
      
      let breachDetected = false;
      gateway.on('security:breach', () => {
        breachDetected = true;
      });
      
      // Act: enviar evento de sensor CON comando previo
      deviceClient.sendSensorEvent(true);
      
      // Esperar un poco
      await new Promise((resolve) => setTimeout(resolve, 200));
      
      // Assert: no debe triggear alerta
      expect(breachDetected).toBe(false);
      
      deviceClient.disconnect();
    });

    it('should emit breach event with correct device information', async () => {
      // Arrange
      const breachPromise = new Promise<unknown>((resolve) => {
        gateway.once('security:breach', (event) => {
          resolve(event);
        });
      });
      
      // Act: simular entrada forzada desde el gateway
      gateway.simulateForcedEntry('device-001');
      
      // Assert
      const event = await breachPromise as { deviceId: string; message: { type: string } };
      expect(event.deviceId).toBe('device-001');
      expect(event.message.type).toBe('event');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Command Execution Tests
  // ─────────────────────────────────────────────────────────────────────────
  describe('Command Execution', () => {
    it('should send OPEN command successfully', async () => {
      // Arrange
      deviceClient = new MockDeviceClient('device-001', `ws://localhost:${GATEWAY_PORT}`);
      await deviceClient.connect();
      
      const commandPromise = new Promise<string>((resolve) => {
        deviceClient.on('command', (command) => {
          resolve(command);
        });
      });
      
      // Act
      const result = await gateway.sendCommand('device-001', 'OPEN');
      const receivedCommand = await commandPromise;
      
      // Assert
      expect(result).toBe(true);
      expect(receivedCommand).toBe('OPEN');
      
      deviceClient.disconnect();
    });

    it('should fail to send command to offline device', async () => {
      // Act: intentar enviar comando a dispositivo offline
      const result = await gateway.sendCommand('device-002', 'OPEN');
      
      // Assert
      expect(result).toBe(false);
    });

    it('should fail to send command to unknown device', async () => {
      // Act
      const result = await gateway.sendCommand('device-unknown', 'OPEN');
      
      // Assert
      expect(result).toBe(false);
    });

    it('should track all sent commands in history', async () => {
      // Arrange
      deviceClient = new MockDeviceClient('device-001', `ws://localhost:${GATEWAY_PORT}`);
      await deviceClient.connect();
      
      // Act: enviar múltiples comandos
      await gateway.sendCommand('device-001', 'OPEN');
      await gateway.sendCommand('device-001', 'CLOSE');
      await gateway.sendCommand('device-001', 'LOCK');
      
      // Assert
      const history = gateway.getCommandHistory();
      expect(history.length).toBe(3);
      expect(history[0].payload).toEqual({ command: 'OPEN' });
      expect(history[1].payload).toEqual({ command: 'CLOSE' });
      expect(history[2].payload).toEqual({ command: 'LOCK' });
      
      deviceClient.disconnect();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Device Status Tests
  // ─────────────────────────────────────────────────────────────────────────
  describe('Device Status Management', () => {
    it('should update door state on status report', async () => {
      // Arrange
      deviceClient = new MockDeviceClient('device-001', `ws://localhost:${GATEWAY_PORT}`);
      await deviceClient.connect();
      
      // Act: enviar reporte de estado
      deviceClient.sendStatus('open');
      
      // Esperar actualización
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      // Assert
      const state = gateway.getDeviceState('device-001');
      expect(state?.doorState).toBe('open');
      
      deviceClient.disconnect();
    });

    it('should handle jammed door status', async () => {
      // Arrange
      deviceClient = new MockDeviceClient('device-001', `ws://localhost:${GATEWAY_PORT}`);
      await deviceClient.connect();
      
      // Act
      deviceClient.sendStatus('jammed');
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      // Assert
      const state = gateway.getDeviceState('device-001');
      expect(state?.doorState).toBe('jammed');
      
      deviceClient.disconnect();
    });
  });
});
