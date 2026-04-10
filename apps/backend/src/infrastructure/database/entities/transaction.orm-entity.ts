/**
 * ============================================================================
 * SMART_RETAIL - Transaction ORM Entity (Infraestructura)
 * ============================================================================
 * Entidad TypeORM para persistencia de transacciones en PostgreSQL.
 * Esta es la entidad central del sistema de "Aduana de Control".
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
 * Estados de transacción (mirror del enum de dominio)
 */
export enum TransactionStatusOrm {
  PENDING = 'PENDING',
  IN_PROCESS = 'IN_PROCESS',
  PAID = 'PAID',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED_HW_FAILURE = 'REFUNDED_HW_FAILURE',
  REFUNDED_MANUAL = 'REFUNDED_MANUAL',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

/**
 * Pasarelas de pago soportadas
 */
export enum PaymentGatewayOrm {
  MERCADOPAGO = 'MERCADOPAGO',
  MODO = 'MODO',
}

@Entity('transactions')
@Index('IDX_TRANSACTION_USER_DATE', ['userId', 'createdAt'])
@Index('IDX_TRANSACTION_LOCATION_DATE', ['locationId', 'createdAt'])
export class TransactionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * ID del usuario que realizó la transacción
   */
  @Column({ type: 'uuid', name: 'user_id' })
  @Index('IDX_TRANSACTION_USER')
  userId!: string;

  /**
   * ID del dispositivo involucrado
   */
  @Column({ type: 'uuid', name: 'device_id' })
  @Index('IDX_TRANSACTION_DEVICE')
  deviceId!: string;

  /**
   * ID del producto (null si es solo acceso sin producto)
   */
  @Column({ type: 'uuid', nullable: true, name: 'product_id' })
  productId?: string | null;

  /**
   * ID de la ubicación (denormalizado para queries rápidas)
   */
  @Column({ type: 'uuid', name: 'location_id' })
  locationId!: string;

  /**
   * Monto de la transacción en centavos
   */
  @Column({ type: 'integer', name: 'amount_cents' })
  amountCents!: number;

  /**
   * Cantidad de productos
   */
  @Column({ type: 'integer', default: 1 })
  quantity!: number;

  /**
   * Estado actual de la transacción
   */
  @Column({
    type: 'enum',
    enum: TransactionStatusOrm,
    default: TransactionStatusOrm.PENDING,
  })
  @Index('IDX_TRANSACTION_STATUS')
  status!: TransactionStatusOrm;

  /**
   * ID externo en la pasarela de pagos
   */
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'external_payment_id' })
  @Index('IDX_TRANSACTION_EXTERNAL_ID')
  externalPaymentId?: string | null;

  /**
   * Pasarela de pagos usada
   */
  @Column({
    type: 'enum',
    enum: PaymentGatewayOrm,
    nullable: true,
    name: 'payment_gateway',
  })
  paymentGateway?: PaymentGatewayOrm | null;

  /**
   * Método de pago (card, wallet, qr, etc.)
   */
  @Column({ type: 'varchar', length: 50, nullable: true, name: 'payment_method' })
  paymentMethod?: string | null;

  /**
   * Código de respuesta de la pasarela
   */
  @Column({ type: 'varchar', length: 100, nullable: true, name: 'response_code' })
  responseCode?: string | null;

  /**
   * Mensaje de respuesta
   */
  @Column({ type: 'varchar', length: 500, nullable: true, name: 'response_message' })
  responseMessage?: string | null;

  /**
   * ID de trazabilidad (correlación de logs)
   */
  @Column({ type: 'varchar', length: 100, name: 'trace_id' })
  @Index('IDX_TRANSACTION_TRACE')
  traceId!: string;

  /**
   * Metadata adicional (JSON)
   * Por qué: Datos flexibles como IP del cliente, user agent, etc.
   */
  @Column({ type: 'jsonb', default: '{}', name: 'metadata' })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  /**
   * Timestamp de completado (cuando el dispositivo abrió)
   */
  @Column({ type: 'timestamptz', nullable: true, name: 'completed_at' })
  completedAt?: Date | null;
}
