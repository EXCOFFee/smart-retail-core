/**
 * ============================================================================
 * SMART_RETAIL - Payment Orchestrator
 * ============================================================================
 * Servicio que orquesta los pagos entre múltiples pasarelas.
 * 
 * ARQUITECTURA: Capa de APLICACIÓN 🟠 (services)
 * 
 * IMPLEMENTA: DA-06 (Patrón Strategy para pasarelas de pago)
 * 
 * RESPONSABILIDADES:
 * 1. Seleccionar la pasarela correcta según configuración
 * 2. Implementar fallback si la pasarela primaria falla
 * 3. Manejar reintentos con backoff exponencial
 * 4. Loggear métricas de cada pasarela
 * ============================================================================
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
    ChargeRequest,
    ChargeResult,
    IPaymentGatewayPort,
    MERCADOPAGO_ADAPTER,
    MODO_ADAPTER,
    RefundResult,
} from '@application/ports/output/payment-gateway.port';
import { PaymentGatewayException } from '@domain/exceptions/payment-gateway.exception';

/**
 * Configuración de la estrategia de pagos.
 */
export interface PaymentStrategyConfig {
  /** Pasarela primaria */
  primary: 'MERCADOPAGO' | 'MODO';
  /** Pasarela de fallback (opcional) */
  fallback?: 'MERCADOPAGO' | 'MODO';
  /** Habilitar fallback automático */
  enableFallback: boolean;
  /** Número máximo de reintentos */
  maxRetries: number;
  /** Delay base para backoff (ms) */
  retryDelayMs: number;
}

/**
 * Métricas de una operación de pago.
 */
export interface PaymentMetrics {
  gateway: string;
  operation: 'charge' | 'refund' | 'status';
  success: boolean;
  latencyMs: number;
  retries: number;
  usedFallback: boolean;
}

@Injectable()
export class PaymentOrchestrator {
  private readonly logger = new Logger(PaymentOrchestrator.name);

  private readonly config: PaymentStrategyConfig;
  private readonly gateways: Map<string, IPaymentGatewayPort>;

  constructor(
    private readonly configService: ConfigService,
    @Inject(MERCADOPAGO_ADAPTER)
    private readonly mercadopagoAdapter: IPaymentGatewayPort,
    @Inject(MODO_ADAPTER)
    private readonly modoAdapter: IPaymentGatewayPort,
  ) {
    // Cargar configuración
    this.config = {
      primary:
        (this.configService.get<string>('PAYMENT_PRIMARY_GATEWAY') as
          | 'MERCADOPAGO'
          | 'MODO') || 'MERCADOPAGO',
      fallback: this.configService.get<string>(
        'PAYMENT_FALLBACK_GATEWAY',
      ) as 'MERCADOPAGO' | 'MODO' | undefined,
      enableFallback:
        this.configService.get<boolean>('PAYMENT_ENABLE_FALLBACK') ?? true,
      maxRetries: this.configService.get<number>('PAYMENT_MAX_RETRIES') ?? 2,
      retryDelayMs:
        this.configService.get<number>('PAYMENT_RETRY_DELAY_MS') ?? 500,
    };

    // Registrar gateways
    this.gateways = new Map<string, IPaymentGatewayPort>([
      ['MERCADOPAGO', this.mercadopagoAdapter],
      ['MODO', this.modoAdapter],
    ]);

    this.logger.log(
      `Payment orchestrator initialized. Primary: ${this.config.primary}, Fallback: ${this.config.fallback || 'disabled'}`,
    );
  }

  /**
   * Procesa un cobro usando la estrategia configurada.
   * 
   * Flujo:
   * 1. Intenta con la pasarela primaria
   * 2. Si falla y hay fallback, intenta con la secundaria
   * 3. Aplica reintentos con backoff exponencial
   * 
   * @param request - Datos del cobro
   * @returns Resultado del cobro
   * @throws PaymentGatewayException si todos los intentos fallan
   */
  async charge(request: ChargeRequest): Promise<ChargeResult & PaymentMetrics> {
    const startTime = Date.now();
    let retries = 0;
    let usedFallback = false;

    // Intentar con pasarela primaria
    const primaryGateway = this.gateways.get(this.config.primary);
    if (!primaryGateway) {
      throw new PaymentGatewayException(
        this.config.primary,
        'GATEWAY_NOT_CONFIGURED',
        `Gateway ${this.config.primary} is not configured`,
      );
    }

    try {
      const result = await this.chargeWithRetry(primaryGateway, request);
      
      return {
        ...result,
        gateway: this.config.primary,
        operation: 'charge',
        latencyMs: Date.now() - startTime,
        retries,
        usedFallback: false,
      };
    } catch (primaryError) {
      this.logger.warn(
        `Primary gateway ${this.config.primary} failed: ${primaryError}`,
      );

      // Intentar con fallback si está configurado
      if (this.config.enableFallback && this.config.fallback) {
        const fallbackGateway = this.gateways.get(this.config.fallback);
        
        if (fallbackGateway) {
          usedFallback = true;
          this.logger.log(`Attempting fallback to ${this.config.fallback}`);

          try {
            const result = await this.chargeWithRetry(fallbackGateway, request);
            
            return {
              ...result,
              gateway: this.config.fallback,
              operation: 'charge',
              latencyMs: Date.now() - startTime,
              retries,
              usedFallback: true,
            };
          } catch (fallbackError) {
            this.logger.error(
              `Fallback gateway ${this.config.fallback} also failed: ${fallbackError}`,
            );
          }
        }
      }

      // Ambas pasarelas fallaron
      throw new PaymentGatewayException(
        this.config.primary,
        'ALL_GATEWAYS_FAILED',
        'All payment gateways failed',
        {
          primaryGateway: this.config.primary,
          fallbackGateway: this.config.fallback,
          usedFallback,
        },
      );
    }
  }

  /**
   * Procesa un reembolso.
   * 
   * Los reembolsos siempre van a la pasarela original.
   * 
   * @param externalId - ID de la transacción original
   * @param reason - Motivo del reembolso
   * @param gateway - Pasarela donde se procesó el cobro original
   */
  async refund(
    externalId: string,
    reason: string,
    gateway: 'MERCADOPAGO' | 'MODO',
  ): Promise<RefundResult> {
    const targetGateway = this.gateways.get(gateway);

    if (!targetGateway) {
      throw new PaymentGatewayException(
        gateway,
        'GATEWAY_NOT_CONFIGURED',
        `Gateway ${gateway} is not configured for refund`,
      );
    }

    return targetGateway.refund(externalId, reason);
  }

  /**
   * Consulta el estado de una transacción.
   * 
   * @param externalId - ID de la transacción
   * @param gateway - Pasarela donde se procesó
   */
  async getTransactionStatus(
    externalId: string,
    gateway: 'MERCADOPAGO' | 'MODO',
  ): Promise<ChargeResult> {
    const targetGateway = this.gateways.get(gateway);

    if (!targetGateway) {
      throw new PaymentGatewayException(
        gateway,
        'GATEWAY_NOT_CONFIGURED',
        `Gateway ${gateway} is not configured`,
      );
    }

    return targetGateway.getTransactionStatus(externalId);
  }

  /**
   * Verifica disponibilidad de las pasarelas.
   */
  async getGatewaysHealth(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};

    for (const [name, gateway] of this.gateways) {
      try {
        health[name] = await gateway.isAvailable();
      } catch {
        health[name] = false;
      }
    }

    return health;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE METHODS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Intenta un cobro con reintentos y backoff exponencial.
   */
  private async chargeWithRetry(
    gateway: IPaymentGatewayPort,
    request: ChargeRequest,
  ): Promise<ChargeResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Backoff exponencial: 500ms, 1000ms, 2000ms...
          const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1);
          this.logger.debug(
            `Retry ${attempt}/${this.config.maxRetries} after ${delay}ms`,
          );
          await this.sleep(delay);
        }

        const result = await gateway.charge(request);

        // Si el pago fue rechazado (no error técnico), no reintentar
        if (result.status === 'rejected') {
          return result;
        }

        // Si es pending o approved, retornar
        if (result.status === 'approved' || result.status === 'pending') {
          return result;
        }

        // Si está in_process, esperar un poco y consultar estado
        if (result.status === 'in_process' && result.externalId) {
          await this.sleep(1000);
          return gateway.getTransactionStatus(result.externalId);
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Solo reintentar en errores de timeout o conexión
        if (error instanceof PaymentGatewayException) {
          const retryableCodes = ['TIMEOUT', 'CONNECTION_ERROR', 'HTTP_500', 'HTTP_502', 'HTTP_503'];
          if (!retryableCodes.includes(error.code)) {
            throw error;
          }
        }

        this.logger.warn(
          `Gateway ${gateway.gatewayName} attempt ${attempt + 1} failed: ${error}`,
        );
      }
    }

    throw lastError || new Error('Unknown error in payment gateway');
  }

  /**
   * Espera un tiempo determinado.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
