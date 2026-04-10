/**
 * ============================================================================
 * SMART_RETAIL - Audit Log ORM Entity (Infraestructura)
 * ============================================================================
 * Entidad para registro de auditoría de eventos del sistema.
 * 
 * ARQUITECTURA: Capa de INFRAESTRUCTURA 🔴
 * 
 * Por qué tabla separada: Los logs de auditoría son append-only y pueden
 * crecer rápidamente. Separarlos facilita la rotación y archivado.
 * ============================================================================
 */

import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Tipos de eventos de auditoría
 */
export enum AuditEventType {
  // Transacciones
  TRANSACTION_CREATED = 'TRANSACTION_CREATED',
  TRANSACTION_PAID = 'TRANSACTION_PAID',
  TRANSACTION_COMPLETED = 'TRANSACTION_COMPLETED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  TRANSACTION_REFUNDED = 'TRANSACTION_REFUNDED',

  // Seguridad
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_LOGIN_FAILED = 'USER_LOGIN_FAILED',
  TOKEN_REFRESHED = 'TOKEN_REFRESHED',
  TOKEN_REVOKED = 'TOKEN_REVOKED',

  // Dispositivos
  DEVICE_CONNECTED = 'DEVICE_CONNECTED',
  DEVICE_DISCONNECTED = 'DEVICE_DISCONNECTED',
  DEVICE_COMMAND_SENT = 'DEVICE_COMMAND_SENT',
  DEVICE_OPENED = 'DEVICE_OPENED',
  DEVICE_COMPROMISED = 'DEVICE_COMPROMISED',

  // Alertas de seguridad
  SECURITY_BREACH = 'SECURITY_BREACH',
  FORCED_ACCESS_DETECTED = 'FORCED_ACCESS_DETECTED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Administración
  ADMIN_FORCE_OPEN = 'ADMIN_FORCE_OPEN',
  ADMIN_STOCK_ADJUSTMENT = 'ADMIN_STOCK_ADJUSTMENT',
  ADMIN_DEVICE_MAINTENANCE = 'ADMIN_DEVICE_MAINTENANCE',
  ADMIN_REFUND_MANUAL = 'ADMIN_REFUND_MANUAL',

  // Sistema
  SYSTEM_STARTUP = 'SYSTEM_STARTUP',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
}

/**
 * Severidad del evento
 */
export enum AuditSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

@Entity({ name: 'audit_logs', schema: 'audit' })
@Index('IDX_AUDIT_EVENT_DATE', ['eventType', 'createdAt'])
@Index('IDX_AUDIT_ENTITY', ['entityType', 'entityId'])
export class AuditLogOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Tipo de evento
   */
  @Column({ type: 'enum', enum: AuditEventType, name: 'event_type' })
  eventType!: AuditEventType;

  /**
   * Severidad del evento
   */
  @Column({
    type: 'enum',
    enum: AuditSeverity,
    default: AuditSeverity.INFO,
  })
  severity!: AuditSeverity;

  /**
   * Tipo de entidad relacionada (user, device, transaction, etc.)
   */
  @Column({ type: 'varchar', length: 50, name: 'entity_type' })
  entityType!: string;

  /**
   * ID de la entidad relacionada
   */
  @Column({ type: 'uuid', name: 'entity_id' })
  entityId!: string;

  /**
   * ID del usuario que causó el evento (null para eventos del sistema)
   */
  @Column({ type: 'uuid', nullable: true, name: 'actor_id' })
  @Index('IDX_AUDIT_ACTOR')
  actorId?: string | null;

  /**
   * Tipo de actor (user, admin, system, device)
   */
  @Column({ type: 'varchar', length: 20, nullable: true, name: 'actor_type' })
  actorType?: string | null;

  /**
   * ID de trazabilidad para correlacionar logs
   */
  @Column({ type: 'varchar', length: 100, nullable: true, name: 'trace_id' })
  @Index('IDX_AUDIT_TRACE')
  traceId?: string | null;

  /**
   * Descripción legible del evento
   */
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  /**
   * Payload completo del evento (JSON)
   */
  @Column({ type: 'jsonb', default: '{}' })
  payload!: Record<string, unknown>;

  /**
   * IP del cliente (si aplica)
   */
  @Column({ type: 'inet', nullable: true, name: 'ip_address' })
  ipAddress?: string | null;

  /**
   * User Agent del cliente (si aplica)
   */
  @Column({ type: 'varchar', length: 500, nullable: true, name: 'user_agent' })
  userAgent?: string | null;

  /**
   * Timestamp del evento
   * Por qué no @UpdateDateColumn: Los logs son immutables (append-only).
   */
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
