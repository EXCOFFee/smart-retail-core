/**
 * ============================================================================
 * SMART_RETAIL - Device WebSocket Gateway
 * ============================================================================
 * Gateway WebSocket para comunicación en tiempo real con dispositivos IoT.
 * 
 * ARQUITECTURA: Capa de INFRAESTRUCTURA 🔵 (adapters/websocket)
 * 
 * IMPLEMENTA: DA-01 (WebSockets sobre TLS para dispositivos IoT)
 * 
 * PROTOCOLO:
 * 1. Dispositivo conecta con JWT en handshake
 * 2. Servidor valida JWT y registra deviceId
 * 3. Comunicación bidireccional con eventos tipados
 * 
 * EVENTOS (Server → Device):
 * - device:open          - Comando para abrir acceso
 * - device:config        - Actualización de configuración
 * - device:ping          - Heartbeat request
 * 
 * EVENTOS (Device → Server):
 * - device:register      - Registro inicial con serial
 * - device:heartbeat     - Heartbeat con estado
 * - device:ack           - Confirmación de comando
 * - device:error         - Reporte de error
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
    WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { DeviceCommand, DeviceCommandResult, DeviceEventHandler, IDeviceGatewayPort } from '@application/ports/output/device-gateway.port';

/**
 * Payload del evento device:register
 */
interface DeviceRegisterPayload {
  serialNumber: string;
  firmwareVersion: string;
  deviceType: string;
}

/**
 * Payload del evento device:heartbeat
 */
interface DeviceHeartbeatPayload {
  serialNumber: string;
  status: 'online' | 'error';
  metrics?: {
    cpu?: number;
    memory?: number;
    temperature?: number;
  };
}

/**
 * Payload del evento device:ack
 */
interface DeviceAckPayload {
  commandId: string;
  success: boolean;
  errorMessage?: string;
  timestamp: number;
}

/**
 * Payload del evento device:error
 */
interface DeviceErrorPayload {
  serialNumber: string;
  errorCode: string;
  message: string;
  recoverable: boolean;
}

/**
 * Respuesta de ACK de dispositivo (para promesas internas)
 */
interface DeviceAck {
  commandId: string;
  success: boolean;
  errorMessage?: string;
  receivedAt: Date;
}

/**
 * Información de un dispositivo conectado
 */
interface ConnectedDevice {
  socketId: string;
  deviceId: string;
  serialNumber: string;
  locationId: string;
  connectedAt: Date;
  lastHeartbeat: Date;
}

/**
 * Gateway WebSocket para dispositivos IoT.
 * 
 * Por qué namespace /devices: Separa el tráfico de dispositivos
 * del tráfico de usuarios (futuro /app para mobile).
 */
@WebSocketGateway({
  namespace: '/devices',
  cors: {
    // SECURITY: Restringir a orígenes conocidos
    // En desarrollo: permite localhost
    // En producción: usa ALLOWED_ORIGINS de Fly.io secrets
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://smart-retail-admin.vercel.app',
    ],
    credentials: true,
  },
  transports: ['websocket'], // Solo WebSocket, no polling
})
@Injectable()
export class DeviceGateway
  implements
    IDeviceGatewayPort,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect
{
  private readonly logger = new Logger(DeviceGateway.name);

  @WebSocketServer()
  private server!: Server;

  /**
   * Mapa de dispositivos conectados por deviceId
   */
  private connectedDevices = new Map<string, ConnectedDevice>();

  /**
   * Mapa de sockets por socketId para lookup inverso
   */
  private socketToDevice = new Map<string, string>();

  /**
   * Comandos pendientes de ACK, por commandId
   */
  private pendingCommands = new Map<
    string,
    {
      resolve: (ack: DeviceAck) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >();

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // LIFECYCLE HOOKS
  // ─────────────────────────────────────────────────────────────────────────

  afterInit(): void {
    this.logger.log('Device WebSocket Gateway initialized');
  }

  /**
   * Maneja nueva conexión de dispositivo.
   * 
   * Valida JWT del handshake antes de aceptar la conexión.
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      // Extraer token del handshake
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Connection rejected: No token provided`);
        client.disconnect(true);
        return;
      }

      // Validar JWT
      const publicKey = this.configService.getOrThrow<string>('JWT_PUBLIC_KEY');
      const payload = this.jwtService.verify(token, {
        publicKey,
        algorithms: ['RS256'],
      });

      // Almacenar información del dispositivo en el socket
      client.data.deviceId = payload.deviceId;
      client.data.locationId = payload.locationId;
      client.data.connectedAt = new Date();

      this.logger.log(
        `Device connected: ${payload.deviceId} (socket: ${client.id})`,
      );

      // Unir al room de su ubicación (para broadcasts por location)
      await client.join(`location:${payload.locationId}`);
    } catch (error) {
      this.logger.warn(`Connection rejected: Invalid token - ${error}`);
      client.disconnect(true);
    }
  }

  /**
   * Maneja desconexión de dispositivo.
   */
  handleDisconnect(client: Socket): void {
    const deviceId = this.socketToDevice.get(client.id);

    if (deviceId) {
      this.connectedDevices.delete(deviceId);
      this.socketToDevice.delete(client.id);
      this.logger.log(`Device disconnected: ${deviceId}`);
    } else {
      this.logger.debug(`Unknown socket disconnected: ${client.id}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MESSAGE HANDLERS (Device → Server)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Maneja registro de dispositivo después de conexión.
   */
  @SubscribeMessage('device:register')
  handleRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: DeviceRegisterPayload,
  ): { success: boolean; message: string } {
    const deviceId = client.data.deviceId;

    if (!deviceId) {
      throw new WsException('Device not authenticated');
    }

    const device: ConnectedDevice = {
      socketId: client.id,
      deviceId,
      serialNumber: payload.serialNumber,
      locationId: client.data.locationId,
      connectedAt: client.data.connectedAt,
      lastHeartbeat: new Date(),
    };

    this.connectedDevices.set(deviceId, device);
    this.socketToDevice.set(client.id, deviceId);

    this.logger.log(
      `Device registered: ${payload.serialNumber} (${payload.deviceType})`,
    );

    return { success: true, message: 'Device registered successfully' };
  }

  /**
   * Maneja heartbeat de dispositivo.
   */
  @SubscribeMessage('device:heartbeat')
  handleHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: DeviceHeartbeatPayload,
  ): { received: boolean } {
    const deviceId = client.data.deviceId;
    const device = this.connectedDevices.get(deviceId);

    if (device) {
      device.lastHeartbeat = new Date();
      this.logger.debug(
        `Heartbeat from ${payload.serialNumber}: ${payload.status}`,
      );
    }

    return { received: true };
  }

  /**
   * Maneja ACK de comando.
   */
  @SubscribeMessage('device:ack')
  handleAck(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: DeviceAckPayload,
  ): void {
    const pending = this.pendingCommands.get(payload.commandId);

    if (!pending) {
      this.logger.warn(`ACK for unknown command: ${payload.commandId}`);
      return;
    }

    // Limpiar timeout
    clearTimeout(pending.timeout);
    this.pendingCommands.delete(payload.commandId);

    // Resolver promesa
    pending.resolve({
      commandId: payload.commandId,
      success: payload.success,
      errorMessage: payload.errorMessage,
      receivedAt: new Date(payload.timestamp),
    });

    this.logger.debug(
      `ACK received for command ${payload.commandId}: ${payload.success ? 'SUCCESS' : 'FAILURE'}`,
    );
  }

  /**
   * Maneja reporte de error de dispositivo.
   */
  @SubscribeMessage('device:error')
  handleError(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: DeviceErrorPayload,
  ): void {
    this.logger.error(
      `Device error from ${payload.serialNumber}: [${payload.errorCode}] ${payload.message}`,
    );

    // En producción, aquí notificaríamos al sistema de alertas
  }

  // ─────────────────────────────────────────────────────────────────────────
  // OUTPUT PORT IMPLEMENTATION (Server → Device)
  // ─────────────────────────────────────────────────────────────────────────

  /** Event handlers registrados */
  private eventHandlers: DeviceEventHandler[] = [];

  /**
   * Envía un comando a un dispositivo y espera ACK.
   * 
   * Implementa IDeviceGatewayPort.sendCommand()
   */
  async sendCommand(
    deviceId: string,
    command: DeviceCommand,
    timeout = 5000,
  ): Promise<DeviceCommandResult> {
    const device = this.connectedDevices.get(deviceId);
    const startTime = Date.now();

    if (!device) {
      return {
        acknowledged: false,
        connected: false,
        latencyMs: null,
        message: 'Device not connected',
      };
    }

    const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Crear promesa que se resolverá cuando llegue el ACK
    const ackPromise = new Promise<DeviceCommandResult>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingCommands.delete(commandId);
        resolve({
          acknowledged: false,
          connected: true,
          latencyMs: null,
          message: 'ACK timeout',
        });
      }, timeout);

      this.pendingCommands.set(commandId, {
        resolve: () => {
          clearTimeout(timeoutHandle);
          resolve({
            acknowledged: true,
            connected: true,
            latencyMs: Date.now() - startTime,
          });
        },
        reject,
        timeout: timeoutHandle,
      });
    });

    // Enviar comando al dispositivo
    this.server.to(device.socketId).emit('device:command', {
      commandId,
      command,
      timestamp: Date.now(),
    });

    this.logger.debug(`Sent command ${command} to device ${deviceId}`);

    return ackPromise;
  }

  /**
   * Verifica si un dispositivo está conectado.
   * 
   * Implementa IDeviceGatewayPort.isDeviceConnected()
   */
  async isDeviceConnected(deviceId: string): Promise<boolean> {
    return this.connectedDevices.has(deviceId);
  }

  /**
   * Registra un handler para eventos de dispositivos.
   * 
   * Implementa IDeviceGatewayPort.onDeviceEvent()
   */
  onDeviceEvent(handler: DeviceEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Envía señal de apertura y espera confirmación.
   * 
   * Implementa IDeviceGatewayPort.openAndWaitConfirmation()
   */
  async openAndWaitConfirmation(
    deviceId: string,
    transactionId: string,
    timeout: number,
  ): Promise<boolean> {
    const result = await this.sendCommand(deviceId, DeviceCommand.OPEN, timeout);
    
    if (!result.acknowledged) {
      this.logger.warn(
        `Open command not acknowledged for transaction ${transactionId}`,
      );
      return false;
    }

    this.logger.log(
      `Device ${deviceId} opened for transaction ${transactionId} (${result.latencyMs}ms)`,
    );
    return true;
  }

  /**
   * Desconecta forzosamente un dispositivo.
   * 
   * Implementa IDeviceGatewayPort.forceDisconnect()
   */
  async forceDisconnect(deviceId: string): Promise<void> {
    const device = this.connectedDevices.get(deviceId);
    
    if (!device) {
      this.logger.warn(`Cannot disconnect: device ${deviceId} not connected`);
      return;
    }

    const socket = this.server.sockets.sockets.get(device.socketId);
    if (socket) {
      socket.disconnect(true);
    }

    this.connectedDevices.delete(deviceId);
    this.socketToDevice.delete(device.socketId);
    
    this.logger.warn(`Force disconnected device ${deviceId}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADDITIONAL METHODS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Envía configuración actualizada a un dispositivo.
   */
  async sendConfig(
    deviceId: string,
    config: Record<string, unknown>,
  ): Promise<boolean> {
    const device = this.connectedDevices.get(deviceId);

    if (!device) {
      return false;
    }

    this.server.to(device.socketId).emit('device:config', {
      config,
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Broadcast a todos los dispositivos de una ubicación.
   */
  async broadcastToLocation(
    locationId: string,
    event: string,
    data: unknown,
  ): Promise<void> {
    this.server.to(`location:${locationId}`).emit(event, data);
    this.logger.debug(`Broadcast '${event}' to location ${locationId}`);
  }

  /**
   * Obtiene lista de dispositivos conectados.
   */
  getConnectedDevices(): ConnectedDevice[] {
    return Array.from(this.connectedDevices.values());
  }

  /**
   * Obtiene conteo de dispositivos conectados.
   */
  getConnectedCount(): number {
    return this.connectedDevices.size;
  }
}
