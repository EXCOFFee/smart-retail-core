/**
 * ============================================================================
 * SMART_RETAIL - Transaction Entity (Dominio Puro)
 * ============================================================================
 * Representa una transacción de compra/acceso en el sistema.
 * Es el corazón del "Critical Path" de SMART_RETAIL.
 * 
 * ARQUITECTURA: Capa de DOMINIO 🟢
 * ⚠️ PROHIBIDO: Importar NestJS, TypeORM, o cualquier framework aquí.
 * ============================================================================
 */

import { Money } from '@domain/value-objects/money.value-object';

/**
 * Estados del ciclo de vida de una transacción
 * 
 * Flujo normal: PENDING -> PAID -> COMPLETED
 * Flujo fallido: PENDING -> FAILED
 * Flujo hardware: PENDING -> PAID -> REFUNDED_HW_FAILURE (CU-04)
 */
export enum TransactionStatus {
  /** Transacción creada, esperando pago */
  PENDING = 'PENDING',
  /** Pago en proceso (3DSecure, esperando confirmación) */
  IN_PROCESS = 'IN_PROCESS',
  /** Pago confirmado, esperando apertura de dispositivo */
  PAID = 'PAID',
  /** Dispositivo abierto exitosamente - Transacción completada */
  COMPLETED = 'COMPLETED',
  /** Pago rechazado por pasarela */
  FAILED = 'FAILED',
  /** Reembolsado por fallo de hardware (CU-04) */
  REFUNDED_HW_FAILURE = 'REFUNDED_HW_FAILURE',
  /** Reembolsado por solicitud del admin */
  REFUNDED_MANUAL = 'REFUNDED_MANUAL',
  /** Cancelado por timeout o usuario */
  CANCELLED = 'CANCELLED',
  /** Expirado (TTL del lock venció sin completar) */
  EXPIRED = 'EXPIRED',
}

/**
 * Información del pago asociado a la transacción
 */
interface PaymentInfo {
  /** ID externo de la pasarela (MP o MODO) */
  externalId: string | null;
  /** Nombre de la pasarela usada */
  gateway: 'MERCADOPAGO' | 'MODO' | null;
  /** Método de pago (card, wallet, qr) */
  method: string | null;
  /** Código de respuesta de la pasarela */
  responseCode: string | null;
  /** Mensaje de respuesta */
  responseMessage: string | null;
}

/**
 * Entidad de Transacción del Dominio
 * 
 * Representa el registro completo de una operación de compra/acceso.
 * Esta es la entidad central del sistema SMART_RETAIL.
 */
export class Transaction {
  readonly id: string;

  /**
   * ID del usuario que realiza la transacción
   */
  readonly userId: string;

  /**
   * ID del dispositivo involucrado
   */
  readonly deviceId: string;

  /**
   * ID del producto comprado (null si es solo acceso sin producto)
   */
  readonly productId: string | null;

  /**
   * ID de la ubicación donde ocurre la transacción
   * Por qué duplicar de Device: Optimiza queries sin JOINs innecesarios.
   */
  readonly locationId: string;

  /**
   * Monto de la transacción
   * Por qué Money VO: El monto se "congela" al momento del escaneo (CU-19).
   */
  readonly amount: Money;

  /**
   * Cantidad de productos (para casos con múltiples items)
   */
  readonly quantity: number;

  /**
   * Estado actual de la transacción
   */
  private _status: TransactionStatus;

  /**
   * Información del pago
   */
  private _paymentInfo: PaymentInfo;

  /**
   * ID de trazabilidad para logs y debugging
   * Por qué: Permite correlacionar logs entre frontend, backend y pasarela.
   */
  readonly traceId: string;

  /**
   * Timestamp de creación
   */
  readonly createdAt: Date;

  /**
   * Timestamp de última actualización
   */
  private _updatedAt: Date;

  /**
   * Timestamp de completado (cuando el dispositivo se abrió)
   */
  private _completedAt: Date | null;

  constructor(props: {
    id: string;
    userId: string;
    deviceId: string;
    productId?: string | null;
    locationId: string;
    amount: Money;
    quantity?: number;
    status?: TransactionStatus;
    paymentInfo?: Partial<PaymentInfo>;
    traceId: string;
    createdAt?: Date;
    updatedAt?: Date;
    completedAt?: Date | null;
  }) {
    this.id = props.id;
    this.userId = props.userId;
    this.deviceId = props.deviceId;
    this.productId = props.productId ?? null;
    this.locationId = props.locationId;
    this.amount = props.amount;
    this.quantity = props.quantity ?? 1;
    this._status = props.status ?? TransactionStatus.PENDING;
    this._paymentInfo = {
      externalId: props.paymentInfo?.externalId ?? null,
      gateway: props.paymentInfo?.gateway ?? null,
      method: props.paymentInfo?.method ?? null,
      responseCode: props.paymentInfo?.responseCode ?? null,
      responseMessage: props.paymentInfo?.responseMessage ?? null,
    };
    this.traceId = props.traceId;
    this.createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();
    this._completedAt = props.completedAt ?? null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GETTERS
  // ─────────────────────────────────────────────────────────────────────────

  get status(): TransactionStatus {
    return this._status;
  }

  get paymentInfo(): PaymentInfo {
    return { ...this._paymentInfo };
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get completedAt(): Date | null {
    return this._completedAt;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MÉTODOS DE CONSULTA
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Verifica si la transacción está en un estado terminal (no puede cambiar).
   */
  isTerminal(): boolean {
    return [
      TransactionStatus.COMPLETED,
      TransactionStatus.FAILED,
      TransactionStatus.REFUNDED_HW_FAILURE,
      TransactionStatus.REFUNDED_MANUAL,
      TransactionStatus.CANCELLED,
      TransactionStatus.EXPIRED,
    ].includes(this._status);
  }

  /**
   * Verifica si la transacción fue pagada exitosamente.
   */
  isPaid(): boolean {
    return [
      TransactionStatus.PAID,
      TransactionStatus.COMPLETED,
    ].includes(this._status);
  }

  /**
   * Verifica si la transacción requiere reembolso.
   */
  isRefundable(): boolean {
    return this._status === TransactionStatus.PAID;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TRANSICIONES DE ESTADO (State Machine)
  // Por qué métodos separados: Cada transición tiene sus propias validaciones
  // y efectos secundarios. Evita un switch gigante.
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Marca el pago como en proceso (esperando confirmación externa).
   * 
   * Por qué: 3DSecure o confirmación de huella pueden tardar.
   * El usuario ve "Procesando..." mientras esperamos.
   */
  markInProcess(): void {
    this.assertStatus([TransactionStatus.PENDING]);
    this._status = TransactionStatus.IN_PROCESS;
    this._updatedAt = new Date();
  }

  /**
   * Registra el pago exitoso desde la pasarela.
   * 
   * @param paymentData - Datos del pago de la pasarela
   */
  markPaid(paymentData: {
    externalId: string;
    gateway: 'MERCADOPAGO' | 'MODO';
    method: string;
  }): void {
    this.assertStatus([TransactionStatus.PENDING, TransactionStatus.IN_PROCESS]);

    this._status = TransactionStatus.PAID;
    this._paymentInfo = {
      ...this._paymentInfo,
      externalId: paymentData.externalId,
      gateway: paymentData.gateway,
      method: paymentData.method,
      responseCode: 'approved',
      responseMessage: 'Payment approved',
    };
    this._updatedAt = new Date();
  }

  /**
   * Marca la transacción como completada (dispositivo abrió exitosamente).
   * Permite transición desde PENDING (access-only sin pago) o PAID (con pago).
   */
  markCompleted(): void {
    this.assertStatus([TransactionStatus.PENDING, TransactionStatus.PAID]);
    this._status = TransactionStatus.COMPLETED;
    this._completedAt = new Date();
    this._updatedAt = new Date();
  }

  /**
   * Marca el pago como fallido.
   * 
   * @param responseCode - Código de error de la pasarela
   * @param responseMessage - Mensaje de error
   */
  markFailed(responseCode: string, responseMessage: string): void {
    this.assertStatus([TransactionStatus.PENDING, TransactionStatus.IN_PROCESS]);

    this._status = TransactionStatus.FAILED;
    this._paymentInfo = {
      ...this._paymentInfo,
      responseCode,
      responseMessage,
    };
    this._updatedAt = new Date();
  }

  /**
   * Registra reembolso por fallo de hardware (CU-04).
   */
  markRefundedHardwareFailure(): void {
    this.assertStatus([TransactionStatus.PAID]);
    this._status = TransactionStatus.REFUNDED_HW_FAILURE;
    this._updatedAt = new Date();
  }

  /**
   * Registra reembolso manual (admin).
   */
  markRefundedManual(): void {
    this.assertStatus([TransactionStatus.PAID, TransactionStatus.COMPLETED]);
    this._status = TransactionStatus.REFUNDED_MANUAL;
    this._updatedAt = new Date();
  }

  /**
   * Marca como cancelada por el usuario.
   */
  markCancelled(): void {
    this.assertStatus([TransactionStatus.PENDING, TransactionStatus.IN_PROCESS]);
    this._status = TransactionStatus.CANCELLED;
    this._updatedAt = new Date();
  }

  /**
   * Marca como expirada por timeout.
   */
  markExpired(): void {
    this.assertStatus([TransactionStatus.PENDING, TransactionStatus.IN_PROCESS]);
    this._status = TransactionStatus.EXPIRED;
    this._updatedAt = new Date();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS PRIVADOS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Valida que el estado actual permita la transición.
   * 
   * Por qué: Fail Fast - Lanza error si se intenta una transición inválida.
   * Esto ayuda a detectar bugs en la lógica de negocio tempranamente.
   * 
   * @param allowedStatuses - Estados desde los cuales se permite la transición
   * @throws Error si el estado actual no está permitido
   */
  private assertStatus(allowedStatuses: TransactionStatus[]): void {
    if (!allowedStatuses.includes(this._status)) {
      throw new Error(
        `Invalid transaction state transition: cannot transition from ${this._status} ` +
          `(allowed: ${allowedStatuses.join(', ')})`,
      );
    }
  }
}
