/**
 * ============================================================================
 * SMART_RETAIL - IDeviceGatewayPort (Output Port)
 * ============================================================================
 * Puerto de salida para comunicación con dispositivos IoT.
 * 
 * ARQUITECTURA: Capa de APLICACIÓN 🟠 (ports/output)
 * 
 * Por qué Output Port: Abstrae la comunicación WebSocket/MQTT con hardware.
 * El Use Case solo pide "abre esta puerta", no le importa el protocolo.
 * ============================================================================
 */

/**
 * Comandos que se pueden enviar a los dispositivos.
 */
export enum DeviceCommand {
  /** Abrir el dispositivo (puerta, molinete) */
  OPEN = 'OPEN',
  /** Cerrar/bloquear el dispositivo */
  CLOSE = 'CLOSE',
  /** Apertura de emergencia (admin override) */
  FORCE_OPEN = 'FORCE_OPEN',
  /** Solicitar estado actual */
  STATUS = 'STATUS',
  /** Reiniciar dispositivo remotamente */
  REBOOT = 'REBOOT',
  /** Borrar datos locales (dispositivo comprometido) */
  WIPE = 'WIPE',
}

/**
 * Resultado de enviar un comando al dispositivo.
 */
export interface DeviceCommandResult {
  /** Si el comando fue recibido por el dispositivo */
  acknowledged: boolean;

  /** Si el dispositivo está conectado */
  connected: boolean;

  /** Tiempo de respuesta en ms (null si no hubo ACK) */
  latencyMs: number | null;

  /** Mensaje del dispositivo (si aplica) */
  message?: string;

  /** Estado actual del dispositivo */
  deviceStatus?: string;
}

/**
 * Evento recibido desde un dispositivo.
 */
export interface DeviceEvent {
  /** ID del dispositivo que emite el evento */
  deviceId: string;

  /** Tipo de evento */
  eventType:
    | 'HEARTBEAT'
    | 'SENSOR_ACTIVATED'
    | 'DOOR_OPENED'
    | 'DOOR_CLOSED'
    | 'ERROR'
    | 'TAMPER_ALERT';

  /** Timestamp del evento (del dispositivo) */
  timestamp: Date;

  /** Datos adicionales del evento */
  payload: Record<string, unknown>;
}

/**
 * Callback para manejar eventos de dispositivos.
 */
export type DeviceEventHandler = (event: DeviceEvent) => void;

/**
 * Puerto de salida para comunicación con dispositivos IoT.
 * 
 * Implementado por SocketIoDeviceAdapter.
 */
export interface IDeviceGatewayPort {
  /**
   * Envía un comando a un dispositivo y espera ACK.
   * 
   * CRÍTICO: El timeout debe ser configurable (HARDWARE_ACK_TIMEOUT).
   * Si no hay ACK en tiempo, se considera fallo (CU-04).
   * 
   * @param deviceId - ID del dispositivo
   * @param command - Comando a enviar
   * @param timeout - Timeout en ms para esperar ACK
   * @returns Resultado del comando
   */
  sendCommand(
    deviceId: string,
    command: DeviceCommand,
    timeout?: number,
  ): Promise<DeviceCommandResult>;

  /**
   * Verifica si un dispositivo está conectado.
   * 
   * Por qué: Antes de intentar cobrar, verificamos que el dispositivo
   * esté online para evitar cobrar y no poder abrir.
   * 
   * @param deviceId - ID del dispositivo
   * @returns true si está conectado
   */
  isDeviceConnected(deviceId: string): Promise<boolean>;

  /**
   * Registra un handler para eventos de dispositivos.
   * 
   * Por qué: Los dispositivos envían heartbeats, alertas de tamper,
   * y confirmaciones asíncronas. Este método permite suscribirse.
   * 
   * @param handler - Función callback para manejar eventos
   */
  onDeviceEvent(handler: DeviceEventHandler): void;

  /**
   * Envía señal de apertura y espera confirmación.
   * 
   * Método de conveniencia que combina:
   * 1. sendCommand(OPEN)
   * 2. Espera evento DOOR_OPENED
   * 
   * Si no llega confirmación, el Use Case debe iniciar rollback (CU-04).
   * 
   * @param deviceId - ID del dispositivo
   * @param transactionId - ID de transacción (para correlación de logs)
   * @param timeout - Timeout total para la operación
   * @returns true si el dispositivo confirmó apertura
   */
  openAndWaitConfirmation(
    deviceId: string,
    transactionId: string,
    timeout: number,
  ): Promise<boolean>;

  /**
   * Desconecta forzosamente un dispositivo.
   * 
   * Por qué CU-20: Si un dispositivo está comprometido, lo desconectamos
   * y rechazamos cualquier intento de reconexión.
   * 
   * @param deviceId - ID del dispositivo
   */
  forceDisconnect(deviceId: string): Promise<void>;
}

/**
 * Token de inyección para NestJS DI.
 */
export const DEVICE_GATEWAY_PORT = 'IDeviceGatewayPort';
