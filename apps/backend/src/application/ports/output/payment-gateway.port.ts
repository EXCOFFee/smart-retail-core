/**
 * ============================================================================
 * SMART_RETAIL - IPaymentGatewayPort (Output Port)
 * ============================================================================
 * Puerto de salida para integración con pasarelas de pago.
 * 
 * ARQUITECTURA: Capa de APLICACIÓN 🟠 (ports/output)
 * 
 * Por qué Output Port: Define el contrato que los Use Cases esperan
 * de las pasarelas de pago. Los Adapters (MercadoPago, MODO) implementan
 * esta interface, permitiendo cambiar pasarelas sin modificar la lógica.
 * 
 * Patrón: Strategy - El orquestador elige qué adapter usar en runtime.
 * ============================================================================
 */

import { Money } from '@domain/value-objects/money.value-object';

/**
 * Resultado de una operación de cobro.
 */
export interface ChargeResult {
  /** Si el cobro fue exitoso */
  success: boolean;

  /** ID externo de la transacción en la pasarela */
  externalId: string | null;

  /** Estado según la pasarela */
  status: 'approved' | 'pending' | 'rejected' | 'in_process';

  /** Método de pago usado (card, wallet, qr) */
  paymentMethod: string | null;

  /** Código de respuesta para debugging */
  responseCode: string;

  /** Mensaje legible */
  responseMessage: string;

  /** Datos adicionales de la pasarela */
  rawResponse?: Record<string, unknown>;
}

/**
 * Resultado de una operación de reembolso.
 */
export interface RefundResult {
  /** Si el reembolso fue exitoso */
  success: boolean;

  /** ID del reembolso en la pasarela */
  refundId: string | null;

  /** Estado del reembolso */
  status: 'approved' | 'pending' | 'rejected';

  /** Mensaje de respuesta */
  message: string;
}

/**
 * Datos para procesar un cobro.
 */
export interface ChargeRequest {
  /** Monto a cobrar */
  amount: Money;

  /** Descripción visible en el estado de cuenta */
  description: string;

  /** ID interno de la transacción (para idempotencia) */
  transactionId: string;

  /** ID del usuario pagador */
  userId: string;

  /** Email del usuario (requerido por algunas pasarelas) */
  userEmail: string;

  /** Token de pago del frontend (card token, wallet token) */
  paymentToken?: string;

  /** Metadata adicional */
  metadata?: Record<string, string>;
}

/**
 * Puerto de salida para pasarelas de pago.
 * 
 * Cada pasarela (MercadoPago, MODO) implementa esta interface.
 * El PaymentOrchestrator decide cuál usar según la configuración.
 */
export interface IPaymentGatewayPort {
  /**
   * Identificador de la pasarela.
   * 
   * Por qué getter: Permite identificar qué adapter se está usando
   * para logs y auditoría.
   */
  readonly gatewayName: 'MERCADOPAGO' | 'MODO';

  /**
   * Procesa un cobro.
   * 
   * @param request - Datos del cobro
   * @returns Resultado del cobro
   * @throws PaymentGatewayException en caso de error técnico
   */
  charge(request: ChargeRequest): Promise<ChargeResult>;

  /**
   * Procesa un reembolso total.
   * 
   * Por qué solo reembolso total: El MVP no requiere reembolsos parciales.
   * Si se necesitan en el futuro, se agrega un método refundPartial.
   * 
   * @param externalId - ID de la transacción original en la pasarela
   * @param reason - Motivo del reembolso (para auditoría)
   * @returns Resultado del reembolso
   */
  refund(externalId: string, reason: string): Promise<RefundResult>;

  /**
   * Consulta el estado de una transacción.
   * 
   * Por qué: Para reconciliación cuando hay timeout (CU-03).
   * 
   * @param externalId - ID de la transacción en la pasarela
   * @returns Estado actual
   */
  getTransactionStatus(externalId: string): Promise<ChargeResult>;

  /**
   * Verifica si la pasarela está disponible.
   * 
   * Por qué: Health check antes de intentar cobros.
   * 
   * @returns true si la pasarela responde
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Token de inyección para NestJS DI.
 */
export const PAYMENT_GATEWAY_PORT = 'IPaymentGatewayPort';

/**
 * Token para inyectar el adapter de MercadoPago específicamente.
 */
export const MERCADOPAGO_ADAPTER = 'MercadoPagoAdapter';

/**
 * Token para inyectar el adapter de MODO específicamente.
 */
export const MODO_ADAPTER = 'ModoAdapter';
