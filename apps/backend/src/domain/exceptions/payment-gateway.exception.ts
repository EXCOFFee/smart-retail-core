/**
 * ============================================================================
 * SMART_RETAIL - Payment Gateway Exception
 * ============================================================================
 * Se lanza cuando hay un error al procesar el pago en la pasarela.
 * 
 * Mapeo HTTP: 502 Bad Gateway (para errores de conexión)
 *             402 Payment Required (para rechazos)
 * Caso de Uso: CU-02, CU-03
 * ============================================================================
 */

import { DomainException } from './domain.exception';

export class PaymentGatewayException extends DomainException {
  readonly code: string;
  readonly httpStatus: number;

  readonly gatewayName: string;
  readonly responseCode: string;
  readonly isUserDeclined: boolean;

  constructor(
    gateway: 'MERCADOPAGO' | 'MODO' | string,
    errorCode: string,
    errorMessage: string,
    extraDetails?: Record<string, unknown>,
  ) {
    const isRejection = errorCode.startsWith('cc_rejected') || 
                        errorCode === 'REJECTED' ||
                        errorCode.includes('insufficient');

    super(
      `Payment gateway ${gateway} error: ${errorMessage}`,
      {
        gateway,
        errorCode,
        errorMessage,
        isRejection,
        ...extraDetails,
      },
    );

    this.code = `PAYMENT_${errorCode}`;
    this.gatewayName = gateway;
    this.responseCode = errorCode;
    this.isUserDeclined = isRejection;

    // Si es un rechazo del usuario (fondos, tarjeta vencida), es 402
    // Si es un error técnico de la pasarela, es 502
    this.httpStatus = isRejection ? 402 : 502;
  }
}
