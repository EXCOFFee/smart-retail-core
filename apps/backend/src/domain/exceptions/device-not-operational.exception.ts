/**
 * ============================================================================
 * SMART_RETAIL - Device Not Operational Exception
 * ============================================================================
 * Se lanza cuando se intenta operar un dispositivo que no está disponible.
 * 
 * Mapeo HTTP: 503 Service Unavailable
 * Caso de Uso: CU-12 (Modo Mantenimiento), CU-20 (Dispositivo Comprometido)
 * ============================================================================
 */

import { DomainException } from './domain.exception';

/**
 * Por qué no importamos DeviceStatus del entity:
 * Evitamos dependencias circulares entre excepciones y entidades.
 * El status se pasa como string y se documenta en los details.
 */
export class DeviceNotOperationalException extends DomainException {
  readonly code = 'DEVICE_NOT_OPERATIONAL';
  readonly httpStatus = 503; // Service Unavailable

  readonly deviceId: string;
  readonly deviceName: string;
  readonly deviceStatus: string;

  constructor(
    deviceId: string,
    deviceName: string,
    currentStatus: string,
    reason?: string,
  ) {
    super(
      `Device "${deviceName}" (${deviceId}) is not operational. Status: ${currentStatus}`,
      {
        deviceId,
        deviceName,
        currentStatus,
        reason: reason ?? 'Device is offline or under maintenance',
      },
    );

    this.deviceId = deviceId;
    this.deviceName = deviceName;
    this.deviceStatus = currentStatus;
  }
}
