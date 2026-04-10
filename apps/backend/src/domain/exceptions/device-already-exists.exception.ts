/**
 * ============================================================================
 * SMART_RETAIL - Device Already Exists Exception
 * ============================================================================
 * Excepción de dominio lanzada cuando se intenta provisionar un dispositivo
 * con un número de serie que ya existe en el sistema.
 * 
 * ARQUITECTURA: Capa de DOMINIO 🟢 (exceptions)
 * ⚠️ PROHIBIDO: Importar NestJS o frameworks aquí.
 * ============================================================================
 */

import { DomainException } from './domain.exception';

/**
 * Excepción: Dispositivo ya existe.
 * 
 * Código HTTP sugerido: 409 Conflict
 */
export class DeviceAlreadyExistsException extends DomainException {
  /**
   * Código único de error.
   */
  readonly code = 'DEVICE_ALREADY_EXISTS';

  /**
   * HTTP 409 Conflict.
   */
  readonly httpStatus = 409;

  /**
   * Número de serie duplicado.
   */
  public readonly serialNumber: string;

  constructor(serialNumber: string) {
    super(`Ya existe un dispositivo con número de serie: ${serialNumber}`, {
      serialNumber,
    });
    this.serialNumber = serialNumber;
  }
}
