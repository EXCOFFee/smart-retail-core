/**
 * ============================================================================
 * SMART_RETAIL - Payment Module
 * ============================================================================
 * Módulo de pagos que integra las pasarelas MercadoPago y MODO.
 * 
 * ARQUITECTURA: Capa de MÓDULOS 🟣
 * 
 * PROVEE:
 * - MercadoPagoAdapter: Implementación para MercadoPago
 * - ModoAdapter: Implementación para MODO
 * - PaymentOrchestrator: Servicio de orquestación con Strategy pattern
 * ============================================================================
 */

import { Module } from '@nestjs/common';

import {
    MERCADOPAGO_ADAPTER,
    MODO_ADAPTER,
    PAYMENT_GATEWAY_PORT,
} from '@application/ports/output/payment-gateway.port';
import { PaymentOrchestrator } from '@application/services/payment-orchestrator.service';
import { MercadoPagoAdapter } from '@infrastructure/adapters/payment/mercadopago.adapter';
import { ModoAdapter } from '@infrastructure/adapters/payment/modo.adapter';

@Module({
  providers: [
    // Adapters concretos
    {
      provide: MERCADOPAGO_ADAPTER,
      useClass: MercadoPagoAdapter,
    },
    {
      provide: MODO_ADAPTER,
      useClass: ModoAdapter,
    },
    // Orquestador (usa ambos adapters)
    PaymentOrchestrator,
    // Port genérico - usa MercadoPago por defecto
    // En runtime, PaymentOrchestrator decide cuál usar
    {
      provide: PAYMENT_GATEWAY_PORT,
      useExisting: MERCADOPAGO_ADAPTER,
    },
  ],
  exports: [
    MERCADOPAGO_ADAPTER,
    MODO_ADAPTER,
    PAYMENT_GATEWAY_PORT,
    PaymentOrchestrator,
  ],
})
export class PaymentModule {}
