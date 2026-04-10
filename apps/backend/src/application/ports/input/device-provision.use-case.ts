/**
 * ============================================================================
 * SMART_RETAIL - Device Provision Use Case (Input Port)
 * ============================================================================
 * Puerto de entrada para el caso de uso CU-10: Alta de Nuevo Dispositivo.
 * 
 * ARQUITECTURA: Capa de APLICACIÓN 🟠 (ports/input)
 * 
 * Por qué este use case: El provisioning de dispositivos es un proceso
 * crítico de seguridad. Solo admins autenticados pueden agregar nuevos
 * dispositivos al sistema. Cada dispositivo recibe credenciales únicas
 * (API Key + Secret) que se usan para autenticar conexiones WebSocket.
 * ============================================================================
 */

import { Device, DeviceType } from '@domain/entities/device.entity';

/**
 * Input para provisionar un nuevo dispositivo.
 */
export interface DeviceProvisionInput {
  /**
   * Número de serie único del dispositivo (del fabricante).
   */
  serialNumber: string;

  /**
   * Nombre legible del dispositivo (ej: "Molinete Entrada Norte").
   */
  name: string;

  /**
   * Tipo de dispositivo.
   */
  type: DeviceType;

  /**
   * ID de la ubicación/local donde se instalará.
   * Por qué: DA-03 - Multi-Location. Cada dispositivo pertenece a una sucursal.
   */
  locationId: string;

  /**
   * Configuración inicial del dispositivo (opcional).
   */
  config?: Record<string, unknown>;

  /**
   * ID del admin que ejecuta el provisioning (para auditoría).
   */
  provisionedBy: string;
}

/**
 * Output del provisioning de dispositivo.
 */
export interface DeviceProvisionOutput {
  /**
   * Dispositivo creado.
   */
  device: Device;

  /**
   * API Key generada para el dispositivo.
   * CRÍTICO: Solo se muestra una vez. El admin debe copiarla.
   */
  apiKey: string;

  /**
   * Secret generado para el dispositivo.
   * CRÍTICO: Solo se muestra una vez. Se almacena hasheado.
   */
  secret: string;

  /**
   * Timestamp del provisioning.
   */
  provisionedAt: Date;
}

/**
 * Puerto de entrada para el caso de uso de Provisioning de Dispositivos.
 * 
 * Flujo (CU-10):
 * 1. Admin ingresa datos del dispositivo en Panel Web
 * 2. Backend valida que no exista otro dispositivo con mismo serialNumber
 * 3. Backend genera credenciales únicas (API Key + Secret)
 * 4. Backend hashea el secret y guarda en DB
 * 5. Backend retorna credenciales en texto plano (única vez)
 * 6. Dispositivo usa credenciales para conectarse vía WebSocket
 */
export interface IDeviceProvisionUseCase {
  /**
   * Ejecuta el provisioning de un nuevo dispositivo.
   * 
   * @param input - Datos del dispositivo a provisionar
   * @returns Dispositivo creado con sus credenciales
   * @throws DeviceAlreadyExistsException si ya existe un dispositivo con ese serialNumber
   */
  execute(input: DeviceProvisionInput): Promise<DeviceProvisionOutput>;
}

/**
 * Token de inyección para el Use Case de Provisioning.
 */
export const DEVICE_PROVISION_USE_CASE = 'IDeviceProvisionUseCase';
