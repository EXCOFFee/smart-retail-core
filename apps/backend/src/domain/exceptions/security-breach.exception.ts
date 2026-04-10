/**
 * ============================================================================
 * SMART_RETAIL - Security Breach Exception
 * ============================================================================
 * Se lanza cuando se detecta un intento de violación de seguridad.
 * 
 * Mapeo HTTP: 403 Forbidden
 * Caso de Uso: CU-18 (Puerta Forzada), CU-20 (Dispositivo Comprometido)
 * ============================================================================
 */

import { DomainException } from './domain.exception';

export enum SecurityBreachType {
  /** Dispositivo reportó movimiento sin comando previo */
  FORCED_ACCESS = 'FORCED_ACCESS',
  /** Dispositivo comprometido intentando conectar */
  COMPROMISED_DEVICE = 'COMPROMISED_DEVICE',
  /** Múltiples intentos fallidos (rate limiting) */
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  /** Token revocado en uso */
  REVOKED_TOKEN = 'REVOKED_TOKEN',
}

export class SecurityBreachException extends DomainException {
  readonly code = 'SECURITY_BREACH';
  readonly httpStatus = 403; // Forbidden

  constructor(
    breachType: SecurityBreachType,
    entityId: string,
    entityType: 'device' | 'user' | 'token',
    additionalInfo?: Record<string, unknown>,
  ) {
    super(
      `Security breach detected: ${breachType} on ${entityType} ${entityId}`,
      {
        breachType,
        entityId,
        entityType,
        ...additionalInfo,
        // Siempre incluir timestamp para auditoría
        detectedAt: new Date().toISOString(),
      },
    );
  }
}
