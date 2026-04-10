/**
 * ============================================================================
 * SMART_RETAIL - Mock WebSocket Gateway for IoT E2E Tests
 * ============================================================================
 * Simula el gateway WebSocket que controla dispositivos IoT.
 * 
 * IMPLEMENTA MOCKS PARA:
 * - CU-04: Reembolso por fallo de hardware
 * - CU-09: Reconexión WebSocket
 * - CU-18: Alerta de puerta forzada
 * ============================================================================
 */

import { EventEmitter } from 'events';
import { WebSocket, WebSocketServer } from 'ws';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type DeviceCommand = 'OPEN' | 'CLOSE' | 'LOCK' | 'UNLOCK' | 'FORCE_OPEN' | 'WIPE_DATA';

export interface DeviceMessage {
  type: 'command' | 'ack' | 'event' | 'status';
  deviceId: string;
  payload: unknown;
  timestamp: number;
}

export interface DeviceState {
  id: string;
  status: 'online' | 'offline' | 'error';
  lastSeen: number;
  doorState: 'closed' | 'open' | 'jammed';
}

export type MockBehavior = 'normal' | 'timeout' | 'nack' | 'sensor_anomaly';

// ─────────────────────────────────────────────────────────────────────────────
// MOCK WEBSOCKET GATEWAY
// ─────────────────────────────────────────────────────────────────────────────

export class MockWebSocketGateway extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocket> = new Map();
  private deviceStates: Map<string, DeviceState> = new Map();
  private port: number;
  
  // Configuración de comportamiento mock
  private behavior: MockBehavior = 'normal';
  private ackDelayMs = 50;
  private commandHistory: DeviceMessage[] = [];

  constructor(port = 3002) {
    super();
    this.port = port;
    
    // Inicializar dispositivos mock
    this.deviceStates.set('device-001', {
      id: 'device-001',
      status: 'online',
      lastSeen: Date.now(),
      doorState: 'closed',
    });
    
    this.deviceStates.set('device-002', {
      id: 'device-002',
      status: 'offline',
      lastSeen: Date.now() - 60000,
      doorState: 'closed',
    });
  }

  /**
   * Inicia el servidor WebSocket mock.
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.wss = new WebSocketServer({ port: this.port });

      this.wss.on('connection', (ws: WebSocket, req) => {
        // Extraer deviceId del query string o headers
        const url = new URL(req.url ?? '', `http://localhost:${this.port}`);
        const deviceId = url.searchParams.get('deviceId') ?? 'unknown';
        
        console.log(`Device connected: ${deviceId}`);
        this.clients.set(deviceId, ws);
        
        // Actualizar estado
        const state = this.deviceStates.get(deviceId);
        if (state) {
          state.status = 'online';
          state.lastSeen = Date.now();
        }
        
        this.emit('device:connected', deviceId);

        ws.on('message', (data: Buffer) => {
          this.handleMessage(deviceId, data);
        });

        ws.on('close', () => {
          console.log(`Device disconnected: ${deviceId}`);
          this.clients.delete(deviceId);
          
          const state = this.deviceStates.get(deviceId);
          if (state) {
            state.status = 'offline';
          }
          
          this.emit('device:disconnected', deviceId);
        });

        ws.on('error', (error) => {
          console.error(`WebSocket error for ${deviceId}:`, error);
          this.emit('device:error', { deviceId, error });
        });
      });

      this.wss.on('listening', () => {
        console.log(`Mock WebSocket Gateway running on port ${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Detiene el servidor WebSocket mock.
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // Cerrar todas las conexiones
      for (const [deviceId, ws] of this.clients.entries()) {
        ws.close(1000, 'Server shutting down');
        this.clients.delete(deviceId);
      }

      if (this.wss) {
        this.wss.close(() => {
          console.log('Mock WebSocket Gateway stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Resetea el estado del gateway.
   */
  reset(): void {
    this.behavior = 'normal';
    this.ackDelayMs = 50;
    this.commandHistory = [];
    
    // Restaurar estados de dispositivos
    for (const state of this.deviceStates.values()) {
      state.doorState = 'closed';
    }
  }

  /**
   * Configura el comportamiento del mock.
   */
  setBehavior(behavior: MockBehavior): void {
    this.behavior = behavior;
  }

  /**
   * Configura el delay para ACKs.
   */
  setAckDelay(ms: number): void {
    this.ackDelayMs = ms;
  }

  /**
   * Simula enviar un comando a un dispositivo.
   */
  async sendCommand(deviceId: string, command: DeviceCommand): Promise<boolean> {
    const client = this.clients.get(deviceId);
    const state = this.deviceStates.get(deviceId);

    if (!client || !state || state.status !== 'online') {
      return false;
    }

    const message: DeviceMessage = {
      type: 'command',
      deviceId,
      payload: { command },
      timestamp: Date.now(),
    };

    this.commandHistory.push(message);

    try {
      client.send(JSON.stringify(message));
      this.emit('command:sent', message);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Obtiene el historial de comandos enviados.
   */
  getCommandHistory(): DeviceMessage[] {
    return [...this.commandHistory];
  }

  /**
   * Obtiene el estado de un dispositivo.
   */
  getDeviceState(deviceId: string): DeviceState | undefined {
    return this.deviceStates.get(deviceId);
  }

  /**
   * Simula un evento de sensor sin comando previo (CU-18: puerta forzada).
   */
  simulateForcedEntry(deviceId: string): void {
    const event: DeviceMessage = {
      type: 'event',
      deviceId,
      payload: {
        eventType: 'SENSOR_ACTIVATED',
        hasPreviousCommand: false,
      },
      timestamp: Date.now(),
    };

    this.emit('security:breach', event);
  }

  /**
   * Maneja mensajes entrantes de dispositivos.
   */
  private handleMessage(deviceId: string, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString()) as DeviceMessage;
      
      console.log(`Message from ${deviceId}:`, message.type);
      
      switch (message.type) {
        case 'ack':
          this.handleAck(deviceId, message);
          break;
        case 'event':
          this.handleEvent(deviceId, message);
          break;
        case 'status':
          this.handleStatus(deviceId, message);
          break;
        default:
          console.warn(`Unknown message type from ${deviceId}`);
      }
    } catch (error) {
      console.error(`Failed to parse message from ${deviceId}:`, error);
    }
  }

  /**
   * Maneja ACKs de dispositivos.
   */
  private handleAck(deviceId: string, message: DeviceMessage): void {
    const state = this.deviceStates.get(deviceId);
    
    if (state) {
      // Actualizar estado según el ACK
      const payload = message.payload as { command: DeviceCommand; success: boolean };
      
      if (payload.command === 'OPEN' && payload.success) {
        state.doorState = 'open';
        
        // Simular cierre automático después de 3 segundos
        setTimeout(() => {
          state.doorState = 'closed';
          this.emit('device:door_closed', deviceId);
        }, 3000);
      }
    }

    this.emit('device:ack', { deviceId, message });
  }

  /**
   * Maneja eventos de dispositivos.
   */
  private handleEvent(deviceId: string, message: DeviceMessage): void {
    const payload = message.payload as { eventType: string; hasPreviousCommand?: boolean };

    // CU-18: Detectar entrada forzada
    if (payload.eventType === 'SENSOR_ACTIVATED' && !payload.hasPreviousCommand) {
      this.emit('security:breach', {
        deviceId,
        message,
        severity: 'critical',
      });
    }

    this.emit('device:event', { deviceId, message });
  }

  /**
   * Maneja reportes de estado de dispositivos.
   */
  private handleStatus(deviceId: string, message: DeviceMessage): void {
    const state = this.deviceStates.get(deviceId);
    
    if (state) {
      state.lastSeen = Date.now();
      
      const payload = message.payload as Partial<DeviceState>;
      if (payload.doorState) {
        state.doorState = payload.doorState;
      }
    }

    this.emit('device:status', { deviceId, message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DEVICE CLIENT (Para simular dispositivos en tests)
// ─────────────────────────────────────────────────────────────────────────────

export class MockDeviceClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private deviceId: string;
  private gatewayUrl: string;
  private behavior: MockBehavior = 'normal';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(deviceId: string, gatewayUrl = 'ws://localhost:3002') {
    super();
    this.deviceId = deviceId;
    this.gatewayUrl = gatewayUrl;
  }

  /**
   * Conecta al gateway.
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${this.gatewayUrl}?deviceId=${this.deviceId}`;
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        console.log(`Device ${this.deviceId} connected to gateway`);
        this.reconnectAttempts = 0;
        this.emit('connected');
        resolve();
      });

      this.ws.on('message', (data: Buffer) => {
        this.handleMessage(data);
      });

      this.ws.on('close', () => {
        console.log(`Device ${this.deviceId} disconnected`);
        this.emit('disconnected');
        this.attemptReconnect();
      });

      this.ws.on('error', (error) => {
        console.error(`Device ${this.deviceId} error:`, error);
        this.emit('error', error);
        reject(error);
      });
    });
  }

  /**
   * Desconecta del gateway.
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
  }

  /**
   * Configura el comportamiento del mock.
   */
  setBehavior(behavior: MockBehavior): void {
    this.behavior = behavior;
  }

  /**
   * Envía un ACK al gateway.
   */
  sendAck(command: DeviceCommand, success: boolean): void {
    const message: DeviceMessage = {
      type: 'ack',
      deviceId: this.deviceId,
      payload: { command, success },
      timestamp: Date.now(),
    };

    this.send(message);
  }

  /**
   * Simula un evento de sensor.
   */
  sendSensorEvent(hasPreviousCommand: boolean): void {
    const message: DeviceMessage = {
      type: 'event',
      deviceId: this.deviceId,
      payload: {
        eventType: 'SENSOR_ACTIVATED',
        hasPreviousCommand,
      },
      timestamp: Date.now(),
    };

    this.send(message);
  }

  /**
   * Envía reporte de estado.
   */
  sendStatus(doorState: 'open' | 'closed' | 'jammed'): void {
    const message: DeviceMessage = {
      type: 'status',
      deviceId: this.deviceId,
      payload: { doorState },
      timestamp: Date.now(),
    };

    this.send(message);
  }

  private send(message: DeviceMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private handleMessage(data: Buffer): void {
    try {
      const message = JSON.parse(data.toString()) as DeviceMessage;
      
      if (message.type === 'command') {
        this.handleCommand(message);
      }
    } catch (error) {
      console.error(`Device ${this.deviceId} failed to parse message:`, error);
    }
  }

  private handleCommand(message: DeviceMessage): void {
    const payload = message.payload as { command: DeviceCommand };
    
    this.emit('command', payload.command);

    // Simular respuesta según behavior configurado
    switch (this.behavior) {
      case 'timeout':
        // No enviar ACK (simula timeout)
        break;
      case 'nack':
        // Enviar ACK negativo
        setTimeout(() => this.sendAck(payload.command, false), 100);
        break;
      case 'sensor_anomaly':
        // Enviar evento de sensor sin comando previo
        setTimeout(() => this.sendSensorEvent(false), 500);
        break;
      case 'normal':
      default:
        // Enviar ACK positivo después de un delay
        setTimeout(() => this.sendAck(payload.command, true), 100);
        break;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`Device ${this.deviceId}: Max reconnect attempts reached`);
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`Device ${this.deviceId}: Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect().catch(() => {
        // Reconnection failed, will try again
      });
    }, delay);
  }
}

// Export singleton para tests
export const mockWebSocketGateway = new MockWebSocketGateway();
