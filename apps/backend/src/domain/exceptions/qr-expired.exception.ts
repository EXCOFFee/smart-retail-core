/**
 * ============================================================================
 * SMART_RETAIL - QR Expired Exception
 * ============================================================================
 * Se lanza cuando un código QR ha expirado o ya fue usado.
 * 
 * Mapeo HTTP: 403 Forbidden
 * Caso de Uso: CU-08 (Detección de QR Clonado / Replay Attack)
 * ============================================================================
 */

import { DomainException } from './domain.exception';

export class QrExpiredException extends DomainException {
  readonly code = 'QR_EXPIRED';
  readonly httpStatus = 403; // Forbidden

  readonly generatedAt: Date;
  readonly validatedAt: Date;
  readonly maxAgeSeconds: number;

  constructor(
    qrTimestamp: Date,
    currentTime: Date,
    maxAgeSeconds: number,
  ) {
    const ageSeconds = Math.floor(
      (currentTime.getTime() - qrTimestamp.getTime()) / 1000,
    );

    super(
      `QR code has expired. Age: ${ageSeconds}s, Max allowed: ${maxAgeSeconds}s`,
      {
        qrTimestamp: qrTimestamp.toISOString(),
        currentTime: currentTime.toISOString(),
        ageSeconds,
        maxAgeSeconds,
      },
    );

    this.generatedAt = qrTimestamp;
    this.validatedAt = currentTime;
    this.maxAgeSeconds = maxAgeSeconds;
  }
}
