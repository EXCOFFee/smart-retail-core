/**
 * ============================================================================
 * SMART_RETAIL - Device ORM Entity (Infraestructura)
 * ============================================================================
 * Entidad TypeORM para persistencia de dispositivos IoT en PostgreSQL.
 * 
 * ARQUITECTURA: Capa de INFRAESTRUCTURA 🔴
 * ============================================================================
 */

import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

/**
 * Estados del dispositivo (mirror del enum de dominio)
 */
export enum DeviceStatusOrm {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  MAINTENANCE = 'MAINTENANCE',
  COMPROMISED = 'COMPROMISED',
}

/**
 * Tipos de dispositivo (mirror del enum de dominio)
 */
export enum DeviceTypeOrm {
  TURNSTILE = 'TURNSTILE',
  LOCKER = 'LOCKER',
  DOOR = 'DOOR',
  KIOSK = 'KIOSK',
}

@Entity('devices')
export class DeviceOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Número de serie único del dispositivo
   */
  @Column({ type: 'varchar', length: 100, unique: true, name: 'serial_number' })
  @Index('IDX_DEVICE_SERIAL')
  serialNumber!: string;

  /**
   * Nombre descriptivo del dispositivo
   */
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /**
   * Tipo de dispositivo
   */
  @Column({ type: 'enum', enum: DeviceTypeOrm })
  type!: DeviceTypeOrm;

  /**
   * Estado actual
   */
  @Column({
    type: 'enum',
    enum: DeviceStatusOrm,
    default: DeviceStatusOrm.OFFLINE,
  })
  status!: DeviceStatusOrm;

  /**
   * ID de la ubicación donde está instalado
   */
  @Column({ type: 'uuid', name: 'location_id' })
  @Index('IDX_DEVICE_LOCATION')
  locationId!: string;

  /**
   * Configuración específica del dispositivo (JSON)
   * 
   * Por qué jsonb: PostgreSQL optimiza consultas y permite indexar campos.
   * Ejemplos: timeouts, sensibilidad de sensores, IP del hardware.
   */
  @Column({ type: 'jsonb', default: '{}', name: 'config' })
  config!: Record<string, unknown>;

  /**
   * Hash del token de autenticación del dispositivo
   * 
   * Por qué nullable: Dispositivos nuevos no tienen token hasta provisioning.
   * El token se revoca (null) si el dispositivo está comprometido (CU-20).
   */
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'device_token_hash' })
  deviceTokenHash?: string | null;

  /**
   * Último heartbeat recibido
   * 
   * Por qué: Detectar dispositivos que dejaron de responder.
   * Un proceso periódico marca OFFLINE a los que no envían heartbeat.
   */
  @Column({ type: 'timestamptz', nullable: true, name: 'last_heartbeat_at' })
  @Index('IDX_DEVICE_HEARTBEAT')
  lastHeartbeatAt?: Date | null;

  /**
   * Dirección MAC del dispositivo (para identificación física)
   */
  @Column({ type: 'varchar', length: 17, nullable: true, name: 'mac_address' })
  macAddress?: string | null;

  /**
   * Versión del firmware instalado
   */
  @Column({ type: 'varchar', length: 50, nullable: true, name: 'firmware_version' })
  firmwareVersion?: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
