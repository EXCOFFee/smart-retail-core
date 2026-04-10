/**
 * ============================================================================
 * SMART_RETAIL - Payment Module Barrel Export
 * ============================================================================
 */

// Adapters
export { MercadoPagoAdapter } from '@infrastructure/adapters/payment/mercadopago.adapter';
export { ModoAdapter } from '@infrastructure/adapters/payment/modo.adapter';

// Services
export { PaymentMetrics, PaymentOrchestrator, PaymentStrategyConfig } from '@application/services/payment-orchestrator.service';

// Ports & Types
export {
    ChargeRequest,
    ChargeResult, IPaymentGatewayPort, MERCADOPAGO_ADAPTER,
    MODO_ADAPTER, PAYMENT_GATEWAY_PORT, RefundResult
} from '@application/ports/output/payment-gateway.port';

// Module
export { PaymentModule } from './payment.module';
