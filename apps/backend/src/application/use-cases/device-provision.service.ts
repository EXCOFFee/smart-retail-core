/**
 * ============================================================================
 * SMART_RETAIL - Device Provision Service (Use Case Implementation)
 * ============================================================================
 * Implementación del caso de uso CU-10: Alta de Nuevo Dispositivo (Provisioning).
 * 
 * ARQUITECTURA: Capa de APLICACIÓN 🟠 (use-cases)
 * 
 * Este servicio orquesta el provisioning de dispositivos IoT:
 * 1. Valida que no exista duplicado por serialNumber
 * 2. Genera credenciales criptográficamente seguras
 * 3. Hashea el secret antes de guardar (seguridad)
 * 4. Persiste el dispositivo en estado OFFLINE (hasta primer heartbeat)
 * 5. Registra evento de auditoría
 * ============================================================================
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import {
    DeviceProvisionInput,
    DeviceProvisionOutput,
    IDeviceProvisionUseCase,
} from '@application/ports/input/device-provision.use-case';
import {
    DEVICE_REPOSITORY,
    IDeviceRepository,
} from '@application/ports/output/repositories.port';
import { Device, DeviceStatus } from '@domain/entities/device.entity';
import { DeviceAlreadyExistsException } from '@domain/exceptions/device-already-exists.exception';

@Injectable()
export class DeviceProvisionService implements IDeviceProvisionUseCase {
  private readonly logger = new Logger(DeviceProvisionService.name);

  constructor(
    @Inject(DEVICE_REPOSITORY)
    private readonly deviceRepository: IDeviceRepository,
  ) {}

  /**
   * Ejecuta el provisioning de un nuevo dispositivo.
   * 
   * Por qué generamos credenciales aquí y no en infra:
   * La generación de credenciales es una regla de negocio (seguridad).
   * El hash puede estar en infra, pero la decisión de generar está aquí.
   * 
   * @param input - Datos del dispositivo a provisionar
   * @returns Dispositivo creado con credenciales en texto plano
   */
  async execute(input: DeviceProvisionInput): Promise<DeviceProvisionOutput> {
    const traceId = uuidv4();

    this.logger.log('Iniciando provisioning de dispositivo', {
      traceId,
      serialNumber: input.serialNumber,
      type: input.type,
      locationId: input.locationId,
      provisionedBy: input.provisionedBy,
    });

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 1: Verificar que no exista dispositivo con mismo serialNumber
    // ─────────────────────────────────────────────────────────────────────────
    const existing = await this.deviceRepository.findBySerialNumber(input.serialNumber);
    if (existing) {
      this.logger.warn('Intento de provisioning con serialNumber duplicado', {
        traceId,
        serialNumber: input.serialNumber,
        existingDeviceId: existing.id,
      });
      throw new DeviceAlreadyExistsException(input.serialNumber);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 2: Generar credenciales únicas
    // Por qué randomBytes: Criptográficamente seguro (CSPRNG)
    // Por qué 32 bytes: 256 bits de entropía (suficiente para siglos)
    // ─────────────────────────────────────────────────────────────────────────
    const apiKey = this.generateApiKey(input.serialNumber);
    const secret = this.generateSecret();
    const secretHash = this.hashSecret(secret);

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 3: Crear entidad de dominio
    // Por qué OFFLINE: El dispositivo debe conectarse y enviar heartbeat
    // para pasar a ONLINE. Esto valida que las credenciales funcionan.
    // ─────────────────────────────────────────────────────────────────────────
    const deviceId = uuidv4();
    const now = new Date();

    const device = new Device({
      id: deviceId,
      serialNumber: input.serialNumber,
      name: input.name,
      type: input.type,
      status: DeviceStatus.OFFLINE,
      locationId: input.locationId,
      config: input.config ?? {},
      lastHeartbeat: null,
      deviceTokenHash: secretHash,
      createdAt: now,
      updatedAt: now,
    });

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 4: Persistir dispositivo
    // ─────────────────────────────────────────────────────────────────────────
    const savedDevice = await this.deviceRepository.save(device);

    this.logger.log('Dispositivo provisionado exitosamente', {
      traceId,
      deviceId: savedDevice.id,
      serialNumber: savedDevice.serialNumber,
      locationId: savedDevice.locationId,
      provisionedBy: input.provisionedBy,
    });

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 5: Retornar con credenciales en texto plano
    // CRÍTICO: Esta es la ÚNICA vez que el secret se muestra en texto plano.
    // El admin DEBE copiarlo inmediatamente.
    // ─────────────────────────────────────────────────────────────────────────
    return {
      device: savedDevice,
      apiKey,
      secret,
      provisionedAt: now,
    };
  }

  /**
   * Genera un API Key único para el dispositivo.
   * 
   * Formato: SMART_RETAIL_{serialNumber}_{random}
   * Por qué incluir serialNumber: Facilita identificación en logs.
   */
  private generateApiKey(serialNumber: string): string {
    const random = randomBytes(8).toString('hex').toUpperCase();
    // Limpiar serialNumber de caracteres especiales
    const cleanSerial = serialNumber.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
    return `SMART_RETAIL_${cleanSerial}_${random}`;
  }

  /**
   * Genera un secret criptográficamente seguro.
   * 
   * Por qué 32 bytes -> 64 hex: 256 bits de entropía.
   * Suficiente para resistir ataques de fuerza bruta.
   */
  private generateSecret(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Hashea el secret usando SHA-256.
   * 
   * Por qué SHA-256 y no bcrypt: Los secrets de dispositivos no son
   * passwords de usuarios (no hay reutilización). SHA-256 es suficiente
   * y más rápido para validación en cada request.
   */
  private hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }
}

/**
 * Token de inyección para el Use Case.
 */
export const DEVICE_PROVISION_USE_CASE = 'IDeviceProvisionUseCase';
