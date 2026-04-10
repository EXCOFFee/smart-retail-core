/**
 * ============================================================================
 * SMART_RETAIL - MODO Payment Adapter
 * ============================================================================
 * Implementación del puerto IPaymentGatewayPort para MODO (Argentina).
 * 
 * ARQUITECTURA: Capa de INFRAESTRUCTURA 🔵 (adapters/payment)
 * 
 * IMPLEMENTA: DA-06 (Patrón Strategy para múltiples pasarelas)
 * 
 * MODO es una billetera digital argentina interoperable que permite:
 * - Pagos QR interoperables (estándar BCRA)
 * - Transferencias inmediatas
 * - Integración con múltiples bancos
 * 
 * API MODO:
 * - Auth: API Key + Secret
 * - Webhook para notificaciones asíncronas
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
 * Respuesta de MODO al crear una intención de pago.
 */
interface ModoPaymentIntentResponse {
  id: string;
  status: 'created' | 'pending' | 'approved' | 'rejected' | 'expired';
  qr_code?: string;
  qr_code_base64?: string;
  deep_link?: string;
  expires_at: string;
}

/**
 * Respuesta de MODO para consulta de pago.
 */
interface ModoPaymentStatusResponse {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  payment_method?: string;
  payer_bank?: string;
  approved_at?: string;
}

/**
 * Respuesta de MODO para reembolso.
 */
interface ModoRefundResponse {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  amount: number;
}

@Injectable()
export class ModoAdapter implements IPaymentGatewayPort {
  private readonly logger = new Logger(ModoAdapter.name);

  readonly gatewayName = 'MODO' as const;

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly storeId: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('MODO_API_URL') ||
      'https://api.modo.com.ar';

    this.apiKey = this.configService.getOrThrow<string>('MODO_API_KEY');
    this.apiSecret = this.configService.getOrThrow<string>('MODO_API_SECRET');
    this.storeId = this.configService.getOrThrow<string>('MODO_STORE_ID');

    this.timeoutMs = this.configService.get<number>(
      'PAYMENT_TIMEOUT_MS',
      3000,
    );
  }

  /**
   * Procesa un cobro a través de MODO.
   * 
   * MODO funciona con "intenciones de pago" que generan un QR.
   * El cliente escanea el QR con la app de su banco.
   * La confirmación llega por webhook.
   * 
   * Para el MVP, asumimos flujo síncrono con polling.
   * 
   * @param request - Datos del cobro
   * @returns Resultado del cobro
   */
  async charge(request: ChargeRequest): Promise<ChargeResult> {
    const startTime = Date.now();

    try {
      // Crear intención de pago
      const intentPayload = {
        amount: request.amount.cents, // MODO usa centavos
        currency: 'ARS',
        description: request.description,
        external_id: request.transactionId,
        store_id: this.storeId,
        payer_email: request.userEmail,
        expires_in_seconds: 60, // QR válido por 1 minuto
        metadata: {
          ...request.metadata,
          smart_retail_transaction_id: request.transactionId,
          smart_retail_user_id: request.userId,
        },
      };

      const intent = await this.makeRequest<ModoPaymentIntentResponse>(
        'POST',
        '/v2/payment-intents',
        intentPayload,
        request.transactionId,
      );

      // Si hay paymentToken, significa que el usuario ya autorizó
      // (vino de la app SMART_RETAIL con deep link de retorno)
      if (request.paymentToken) {
        // Confirmar el pago con el token
        const confirmResponse = await this.makeRequest<ModoPaymentStatusResponse>(
          'POST',
          `/v2/payment-intents/${intent.id}/confirm`,
          { payment_token: request.paymentToken },
        );

        const latency = Date.now() - startTime;
        this.logger.log(
          `MODO charge completed in ${latency}ms: ${confirmResponse.status}`,
        );

        return this.mapStatusToResult(confirmResponse);
      }

      // Sin token, retornamos el QR para que el cliente lo escanee
      // El flujo real usaría webhooks, pero para el MVP hacemos polling corto
      const latency = Date.now() - startTime;
      this.logger.log(
        `MODO payment intent created in ${latency}ms: ${intent.id}`,
      );

      return {
        success: false, // Aún no está aprobado
        externalId: intent.id,
        status: 'pending',
        paymentMethod: 'modo_qr',
        responseCode: 'PENDING_QR_SCAN',
        responseMessage: 'Escanee el código QR para completar el pago',
        rawResponse: {
          qr_code: intent.qr_code,
          qr_code_base64: intent.qr_code_base64,
          deep_link: intent.deep_link,
          expires_at: intent.expires_at,
        },
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      this.logger.error(`MODO charge failed in ${latency}ms: ${error}`);

      if (error instanceof PaymentGatewayException) {
        throw error;
      }

      throw new PaymentGatewayException(
        'MODO',
        'CHARGE_FAILED',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  /**
   * Procesa un reembolso total a través de MODO.
   * 
   * @param externalId - ID del pago original
   * @param reason - Motivo del reembolso
   */
  async refund(externalId: string, reason: string): Promise<RefundResult> {
    try {
      const response = await this.makeRequest<ModoRefundResponse>(
        'POST',
        `/v2/payment-intents/${externalId}/refund`,
        { reason },
      );

      return {
        success: response.status === 'approved',
        refundId: response.id,
        status: response.status === 'approved' ? 'approved' : 'pending',
        message: `Reembolso procesado: $${(response.amount / 100).toFixed(2)}`,
      };
    } catch (error) {
      this.logger.error(`MODO refund failed: ${error}`);

      return {
        success: false,
        refundId: null,
        status: 'rejected',
        message: error instanceof Error ? error.message : 'Refund failed',
      };
    }
  }

  /**
   * Consulta el estado de un pago en MODO.
   * 
   * @param externalId - ID del payment intent
   */
  async getTransactionStatus(externalId: string): Promise<ChargeResult> {
    try {
      const response = await this.makeRequest<ModoPaymentStatusResponse>(
        'GET',
        `/v2/payment-intents/${externalId}`,
      );

      return this.mapStatusToResult(response);
    } catch (error) {
      this.logger.error(`MODO status check failed: ${error}`);

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
   * Verifica disponibilidad del API de MODO.
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.makeRequest('GET', '/v2/health');
      return true;
    } catch {
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE METHODS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Realiza una petición HTTP al API de MODO.
   */
  private async makeRequest<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
    idempotencyKey?: string,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    // MODO usa HMAC-SHA256 para autenticación
    const timestamp = Date.now().toString();
    const signature = await this.generateSignature(method, path, timestamp, body);

    const headers: Record<string, string> = {
      'X-API-Key': this.apiKey,
      'X-Timestamp': timestamp,
      'X-Signature': signature,
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
          'MODO',
          `HTTP_${response.status}`,
          `MODO API error: ${response.status} - ${errorBody}`,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new PaymentGatewayException(
          'MODO',
          'TIMEOUT',
          `Request timed out after ${this.timeoutMs}ms`,
        );
      }

      throw error;
    }
  }

  /**
   * Genera firma HMAC-SHA256 para autenticación con MODO.
   */
  private async generateSignature(
    method: string,
    path: string,
    timestamp: string,
    body?: Record<string, unknown>,
  ): Promise<string> {
    const payload = `${method}${path}${timestamp}${body ? JSON.stringify(body) : ''}`;

    // Usar Web Crypto API (disponible en Node.js 18+)
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.apiSecret);
    const messageData = encoder.encode(payload);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    
    return Buffer.from(signature).toString('hex');
  }

  /**
   * Mapea respuesta de estado MODO a ChargeResult.
   */
  private mapStatusToResult(response: ModoPaymentStatusResponse): ChargeResult {
    const statusMap: Record<
      ModoPaymentStatusResponse['status'],
      ChargeResult['status']
    > = {
      pending: 'pending',
      approved: 'approved',
      rejected: 'rejected',
      expired: 'rejected',
    };

    return {
      success: response.status === 'approved',
      externalId: response.id,
      status: statusMap[response.status],
      paymentMethod: response.payment_method || 'modo',
      responseCode: response.status.toUpperCase(),
      responseMessage: this.getStatusMessage(response.status),
    };
  }

  /**
   * Traduce estados MODO a mensajes legibles.
   */
  private getStatusMessage(status: string): string {
    const messages: Record<string, string> = {
      pending: 'Pago pendiente de aprobación',
      approved: 'Pago aprobado exitosamente',
      rejected: 'Pago rechazado',
      expired: 'El tiempo para pagar ha expirado',
    };

    return messages[status] || status;
  }
}
