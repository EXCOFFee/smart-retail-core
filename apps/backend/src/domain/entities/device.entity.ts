/**
 * ============================================================================
 * SMART_RETAIL - Device Entity (Dominio Puro)
 * ============================================================================
 * Representa un dispositivo físico (molinete, locker, puerta) del sistema.
 * 
 * ARQUITECTURA: Capa de DOMINIO 🟢
 * ⚠️ PROHIBIDO: Importar NestJS, TypeORM, o cualquier framework aquí.
 * ============================================================================
 */

/**
 * Estados posibles de un dispositivo
 */
export enum DeviceStatus {
  /** Dispositivo conectado y operativo */
  ONLINE = 'ONLINE',
  /** Dispositivo desconectado (sin heartbeat) */
  OFFLINE = 'OFFLINE',
  /** Dispositivo en mantenimiento (CU-12) */
  MAINTENANCE = 'MAINTENANCE',
  /** Dispositivo robado o comprometido (CU-20) */
  COMPROMISED = 'COMPROMISED',
}

/**
 * Tipos de dispositivo soportados
 */
export enum DeviceType {
  /** Molinete de acceso */
  TURNSTILE = 'TURNSTILE',
  /** Locker para entregas */
  LOCKER = 'LOCKER',
  /** Puerta controlada */
  DOOR = 'DOOR',
  /** Kiosco de autoservicio */
  KIOSK = 'KIOSK',
}

/**
 * Entidad de Dispositivo del Dominio
 * 
 * Representa un actuador físico controlado por el sistema.
 * Los comandos enviados a estos dispositivos son críticos para la seguridad.
 */
export class Device {
  readonly id: string;

  /**
   * Número de serie único del dispositivo
   */
  readonly serialNumber: string;

  /**
   * Nombre legible del dispositivo (ej: "Molinete Entrada Norte")
   */
  readonly name: string;

  /**
   * Tipo de dispositivo
   */
  readonly type: DeviceType;

  /**
   * Estado actual del dispositivo
   */
  private _status: DeviceStatus;

  /**
   * ID de la ubicación/local donde está instalado
   */
  readonly locationId: string;

  /**
   * Configuración específica del dispositivo (JSON)
   * Por qué Record<string, unknown>: Cada tipo de dispositivo puede
   * tener configuraciones diferentes (timeouts, sensibilidad, etc.)
   */
  private _config: Record<string, unknown>;

  /**
   * Última vez que el dispositivo envió heartbeat
   * Por qué: Detectar dispositivos "fantasma" que aparecen online
   * pero no responden.
   */
  private _lastHeartbeat: Date | null;

  /**
   * Token de autenticación del dispositivo (hash)
   * Por qué: Cada dispositivo tiene su propia identidad criptográfica.
   * Si se compromete, se revoca solo ese dispositivo (CU-20).
   */
  private _deviceTokenHash: string | null;

  readonly createdAt: Date;
  private _updatedAt: Date;

  constructor(props: {
    id: string;
    serialNumber: string;
    name: string;
    type: DeviceType;
    status?: DeviceStatus;
    locationId: string;
    config?: Record<string, unknown>;
    lastHeartbeat?: Date | null;
    deviceTokenHash?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = props.id;
    this.serialNumber = props.serialNumber;
    this.name = props.name;
    this.type = props.type;
    this._status = props.status ?? DeviceStatus.OFFLINE;
    this.locationId = props.locationId;
    this._config = props.config ?? {};
    this._lastHeartbeat = props.lastHeartbeat ?? null;
    this._deviceTokenHash = props.deviceTokenHash ?? null;
    this.createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GETTERS
  // ─────────────────────────────────────────────────────────────────────────

  get status(): DeviceStatus {
    return this._status;
  }

  get config(): Record<string, unknown> {
    return { ...this._config }; // Copia para evitar mutación externa
  }

  get lastHeartbeat(): Date | null {
    return this._lastHeartbeat;
  }

  get deviceTokenHash(): string | null {
    return this._deviceTokenHash;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MÉTODOS DE NEGOCIO
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Verifica si el dispositivo puede recibir comandos.
   * 
   * Por qué: Solo dispositivos ONLINE pueden operar. Enviar comandos
   * a dispositivos en MAINTENANCE o COMPROMISED es un error de negocio.
   * 
   * @returns true si está operativo
   */
  isOperational(): boolean {
    return this._status === DeviceStatus.ONLINE;
  }

  /**
   * Verifica si el dispositivo está comprometido (robado).
   * 
   * Por qué método específico: Permite checks rápidos en validaciones
   * de seguridad sin exponer todo el enum de estados.
   * 
   * @returns true si está comprometido
   */
  isCompromised(): boolean {
    return this._status === DeviceStatus.COMPROMISED;
  }

  /**
   * Registra un heartbeat del dispositivo.
   * 
   * Por qué: Los dispositivos envían heartbeats periódicos.
   * Si pasa mucho tiempo sin heartbeat, el dispositivo pasa a OFFLINE.
   */
  recordHeartbeat(): void {
    this._lastHeartbeat = new Date();

    // Si estaba offline y recibimos heartbeat, vuelve a online
    if (this._status === DeviceStatus.OFFLINE) {
      this._status = DeviceStatus.ONLINE;
    }

    this._updatedAt = new Date();
  }

  /**
   * Marca el dispositivo como offline.
   * 
   * Por qué: Llamado por un proceso que detecta falta de heartbeat.
   */
  markOffline(): void {
    if (this._status === DeviceStatus.ONLINE) {
      this._status = DeviceStatus.OFFLINE;
      this._updatedAt = new Date();
    }
  }

  /**
   * Pone el dispositivo en modo mantenimiento (CU-12).
   * 
   * Por qué: Bloquea todas las transacciones en ese dispositivo
   * mientras se realiza mantenimiento físico.
   */
  enableMaintenanceMode(): void {
    this._status = DeviceStatus.MAINTENANCE;
    this._updatedAt = new Date();
  }

  /**
   * Saca el dispositivo del modo mantenimiento.
   */
  disableMaintenanceMode(): void {
    // Vuelve a OFFLINE hasta que reciba heartbeat
    this._status = DeviceStatus.OFFLINE;
    this._updatedAt = new Date();
  }

  /**
   * Marca el dispositivo como comprometido (CU-20 - Kill Switch).
   * 
   * Por qué: Un dispositivo robado debe ser bloqueado inmediatamente.
   * Esta operación también revoca el token de autenticación.
   */
  markCompromised(): void {
    this._status = DeviceStatus.COMPROMISED;
    this._deviceTokenHash = null; // Revoca el token
    this._updatedAt = new Date();
  }

  /**
   * Registra un nuevo token de dispositivo (provisioning o renovación).
   * 
   * @param tokenHash - Hash del nuevo token
   */
  setDeviceToken(tokenHash: string): void {
    this._deviceTokenHash = tokenHash;
    this._updatedAt = new Date();
  }

  /**
   * Actualiza la configuración del dispositivo.
   * 
   * @param newConfig - Nueva configuración (merge parcial)
   */
  updateConfig(newConfig: Record<string, unknown>): void {
    this._config = { ...this._config, ...newConfig };
    this._updatedAt = new Date();
  }
}
