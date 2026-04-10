/**
 * ============================================================================
 * SMART_RETAIL - MercadoPago Payment Adapter
 * ============================================================================
 * Implementación del puerto IPaymentGatewayPort para MercadoPago.
 * 
 * ARQUITECTURA: Capa de INFRAESTRUCTURA 🔵 (adapters/payment)
 * 
 * IMPLEMENTA: DA-06 (Patrón Strategy para múltiples pasarelas)
 * 
 * MERCADOPAGO API:
 * - Base URL: https://api.mercadopago.com
 * - Auth: Bearer token (access_token)
 * - Endpoints usados:
 *   - POST /v1/payments - Crear pago
 *   - GET /v1/payments/{id} - Consultar estado
 *   - POST /v1/payments/{id}/refunds - Reembolso
 * 
 * IDEMPOTENCIA:
 * Se usa X-Idempotency-Key para evitar cobros duplicados.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
    ChargeRequest,
    ChargeResult,
    IPaymentGatewayPort,
    RefundResult,
} from '@application/ports/output/payment-gateway.port';
import { PaymentGatewayException } from '@domain/exceptions/payment-gateway.exception';

/**
 * Respuesta de MercadoPago para crear un pago.
 */
interface MercadoPagoPaymentResponse {
  id: number;
  status: 'approved' | 'pending' | 'in_process' | 'rejected';
  status_detail: string;
  payment_method_id: string;
  transaction_details?: {
    external_resource_url?: string;
  };
}

/**
 * Respuesta de MercadoPago para reembolso.
 */
interface MercadoPagoRefundResponse {
  id: number;
  status: string;
  amount: number;
}

@Injectable()
export class MercadoPagoAdapter implements IPaymentGatewayPort {
  private readonly logger = new Logger(MercadoPagoAdapter.name);

  readonly gatewayName = 'MERCADOPAGO' as const;

  private readonly baseUrl: string;
  private readonly accessToken: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('MERCADOPAGO_API_URL') ||
      'https://api.mercadopago.com';

    this.accessToken = this.configService.getOrThrow<string>(
      'MERCADOPAGO_ACCESS_TOKEN',
    );

    this.timeoutMs = this.configService.get<number>(
      'PAYMENT_TIMEOUT_MS',
      3000, // 3 segundos - crítico para <200ms total
    );
  }

  /**
   * Procesa un cobro a través de MercadoPago.
   * 
   * @param request - Datos del cobro
   * @returns Resultado del cobro
   */
  async charge(request: ChargeRequest): Promise<ChargeResult> {
    const startTime = Date.now();

    try {
      // Preparar payload según documentación de MP
      const payload = {
        transaction_amount: request.amount.toDecimal(), // MercadoPago espera decimal
        description: request.description,
        payment_method_id: 'account_money', // Por defecto, wallet MP
        payer: {
          email: request.userEmail,
        },
        external_reference: request.transactionId,
        metadata: {
          ...request.metadata,
          smart_retail_transaction_id: request.transactionId,
          smart_retail_user_id: request.userId,
        },
      };

      // Si hay token de tarjeta, usarlo
      if (request.paymentToken) {
        Object.assign(payload, { token: request.paymentToken });
      }

      const response = await this.makeRequest<MercadoPagoPaymentResponse>(
        'POST',
        '/v1/payments',
        payload,
        request.transactionId, // Idempotency key
      );

      const latency = Date.now() - startTime;
      this.logger.log(
        `MercadoPago charge completed in ${latency}ms: ${response.status}`,
      );

      return {
        success: response.status === 'approved',
        externalId: response.id.toString(),
        status: response.status,
        paymentMethod: response.payment_method_id,
        responseCode: response.status_detail,
        responseMessage: this.getStatusMessage(response.status_detail),
        rawResponse: response as unknown as Record<string, unknown>,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      this.logger.error(
        `MercadoPago charge failed in ${latency}ms: ${error}`,
      );

      if (error instanceof PaymentGatewayException) {
        throw error;
      }

      throw new PaymentGatewayException(
        'MERCADOPAGO',
        'CHARGE_FAILED',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  /**
   * Procesa un reembolso total.
   * 
   * @param externalId - ID del pago original en MercadoPago
   * @param reason - Motivo del reembolso
   */
  async refund(externalId: string, reason: string): Promise<RefundResult> {
    try {
      const response = await this.makeRequest<MercadoPagoRefundResponse>(
        'POST',
        `/v1/payments/${externalId}/refunds`,
        { reason },
      );

      return {
        success: response.status === 'approved',
        refundId: response.id.toString(),
        status: response.status === 'approved' ? 'approved' : 'pending',
        message: `Refund processed: ${response.amount}`,
      };
    } catch (error) {
      this.logger.error(`MercadoPago refund failed: ${error}`);

      return {
        success: false,
        refundId: null,
        status: 'rejected',
        message: error instanceof Error ? error.message : 'Refund failed',
      };
    }
  }

  /**
   * Consulta el estado de un pago.
   * 
   * @param externalId - ID del pago en MercadoPago
   */
  async getTransactionStatus(externalId: string): Promise<ChargeResult> {
    try {
      const response = await this.makeRequest<MercadoPagoPaymentResponse>(
        'GET',
        `/v1/payments/${externalId}`,
      );

      return {
        success: response.status === 'approved',
        externalId: response.id.toString(),
        status: response.status,
        paymentMethod: response.payment_method_id,
        responseCode: response.status_detail,
        responseMessage: this.getStatusMessage(response.status_detail),
      };
    } catch (error) {
      this.logger.error(`MercadoPago status check failed: ${error}`);

      return {
        success: false,
        externalId,
        status: 'rejected',
        paymentMethod: null,
        responseCode: 'STATUS_CHECK_FAILED',
        responseMessage: 'Could not retrieve transaction status',
      };
    }
  }

  /**
   * Verifica disponibilidad del API de MercadoPago.
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Hacer una consulta simple para verificar conectividad
      await this.makeRequest('GET', '/users/me');
      return true;
    } catch {
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE METHODS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Realiza una petición HTTP al API de MercadoPago.
   */
  private async makeRequest<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
    idempotencyKey?: string,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new PaymentGatewayException(
          'MERCADOPAGO',
          `HTTP_${response.status}`,
          `MercadoPago API error: ${response.status} - ${errorBody}`,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new PaymentGatewayException(
          'MERCADOPAGO',
          'TIMEOUT',
          `Request timed out after ${this.timeoutMs}ms`,
        );
      }

      throw error;
    }
  }

  /**
   * Traduce códigos de status_detail a mensajes legibles.
   */
  private getStatusMessage(statusDetail: string): string {
    const messages: Record<string, string> = {
      accredited: 'Pago acreditado exitosamente',
      pending_contingency: 'Pago en proceso, esperando confirmación',
      pending_review_manual: 'Pago pendiente de revisión',
      cc_rejected_bad_filled_card_number: 'Número de tarjeta incorrecto',
      cc_rejected_bad_filled_date: 'Fecha de vencimiento incorrecta',
      cc_rejected_bad_filled_other: 'Datos de tarjeta incorrectos',
      cc_rejected_bad_filled_security_code: 'Código de seguridad incorrecto',
      cc_rejected_blacklist: 'Tarjeta no habilitada',
      cc_rejected_call_for_authorize: 'Debe autorizar el pago con su banco',
      cc_rejected_card_disabled: 'Tarjeta deshabilitada',
      cc_rejected_duplicated_payment: 'Pago duplicado',
      cc_rejected_high_risk: 'Pago rechazado por seguridad',
      cc_rejected_insufficient_amount: 'Saldo insuficiente',
      cc_rejected_invalid_installments: 'Cuotas no disponibles',
      cc_rejected_max_attempts: 'Límite de intentos alcanzado',
      cc_rejected_other_reason: 'Pago rechazado',
    };

    return messages[statusDetail] || statusDetail;
  }
}
