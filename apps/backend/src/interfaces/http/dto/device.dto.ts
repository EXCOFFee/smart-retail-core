/**
 * ============================================================================
 * SMART_RETAIL - Device Provision DTO
 * ============================================================================
 * DTOs para el endpoint de provisioning de dispositivos (CU-10).
 * 
 * ARQUITECTURA: Capa de INTERFACES 🟢 (http/dto)
 * 
 * Estos DTOs validan la entrada y definen la forma del response.
 * ============================================================================
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsEnum,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    MinLength,
} from 'class-validator';

/**
 * Tipos de dispositivo válidos para el DTO.
 * Por qué duplicar enum: Desacoplar capa de interfaces de dominio.
 */
export enum DeviceTypeDto {
  TURNSTILE = 'TURNSTILE',
  LOCKER = 'LOCKER',
  DOOR = 'DOOR',
  KIOSK = 'KIOSK',
}

/**
 * DTO de entrada para provisioning de dispositivo.
 * 
 * Validación estricta según Regla 1 (Paranoia de Tipado).
 */
export class DeviceProvisionRequestDto {
  @ApiProperty({
    description: 'Número de serie único del dispositivo (del fabricante)',
    example: 'SN-2026-MOLINETE-001',
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  serialNumber!: string;

  @ApiProperty({
    description: 'Nombre legible del dispositivo',
    example: 'Molinete Entrada Norte',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    description: 'Tipo de dispositivo',
    enum: DeviceTypeDto,
    example: DeviceTypeDto.TURNSTILE,
  })
  @IsEnum(DeviceTypeDto)
  type!: DeviceTypeDto;

  @ApiProperty({
    description: 'ID de la ubicación/sucursal donde se instalará',
    example: '550e8400-e29b-41d4-a716-446655440001',
    format: 'uuid',
  })
  @IsUUID()
  locationId!: string;

  @ApiPropertyOptional({
    description: 'Configuración inicial del dispositivo (JSON)',
    example: { timeout: 5000, retryAttempts: 3 },
  })
  @IsOptional()
  @IsObject()
  @Type(() => Object)
  config?: Record<string, unknown>;
}

/**
 * DTO de respuesta para provisioning exitoso.
 * 
 * CRÍTICO: Contiene credenciales en texto plano que solo se muestran una vez.
 */
export class DeviceProvisionResponseDto {
  @ApiProperty({
    description: 'ID único del dispositivo creado',
    example: '550e8400-e29b-41d4-a716-446655440002',
    format: 'uuid',
  })
  deviceId!: string;

  @ApiProperty({
    description: 'Número de serie del dispositivo',
    example: 'SN-2026-MOLINETE-001',
  })
  serialNumber!: string;

  @ApiProperty({
    description: 'Nombre del dispositivo',
    example: 'Molinete Entrada Norte',
  })
  name!: string;

  @ApiProperty({
    description: 'Estado inicial del dispositivo',
    example: 'OFFLINE',
  })
  status!: string;

  @ApiProperty({
    description: 'ID de la ubicación asignada',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  locationId!: string;

  @ApiProperty({
    description: 'API Key para autenticación del dispositivo. ⚠️ GUARDAR INMEDIATAMENTE',
    example: 'SMART_RETAIL_SN2026MOL_A1B2C3D4',
  })
  apiKey!: string;

  @ApiProperty({
    description: 'Secret para autenticación del dispositivo. ⚠️ GUARDAR INMEDIATAMENTE - NO SE MOSTRARÁ NUEVAMENTE',
    example: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef12345678',
  })
  secret!: string;

  @ApiProperty({
    description: 'Timestamp del provisioning',
    example: '2026-01-19T10:30:00.000Z',
  })
  provisionedAt!: string;

  @ApiProperty({
    description: 'Mensaje de advertencia sobre las credenciales',
    example: 'IMPORTANTE: Guarde las credenciales inmediatamente. El secret no se mostrará nuevamente.',
  })
  warning!: string;
}

/**
 * DTO de respuesta para lista de dispositivos.
 */
export class DeviceListItemDto {
  @ApiProperty({
    description: 'ID único del dispositivo',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  id!: string;

  @ApiProperty({
    description: 'Número de serie',
    example: 'SN-2026-MOLINETE-001',
  })
  serialNumber!: string;

  @ApiProperty({
    description: 'Nombre del dispositivo',
    example: 'Molinete Entrada Norte',
  })
  name!: string;

  @ApiProperty({
    description: 'Tipo de dispositivo',
    enum: DeviceTypeDto,
  })
  type!: DeviceTypeDto;

  @ApiProperty({
    description: 'Estado actual',
    example: 'ONLINE',
  })
  status!: string;

  @ApiProperty({
    description: 'ID de la ubicación',
  })
  locationId!: string;

  @ApiPropertyOptional({
    description: 'Último heartbeat recibido',
    example: '2026-01-19T10:30:00.000Z',
  })
  lastHeartbeat?: string | null;

  @ApiProperty({
    description: 'Fecha de creación',
  })
  createdAt!: string;
}

/**
 * DTO de respuesta para lista paginada de dispositivos.
 */
export class DeviceListResponseDto {
  @ApiProperty({
    description: 'Lista de dispositivos',
    type: [DeviceListItemDto],
  })
  devices!: DeviceListItemDto[];

  @ApiProperty({
    description: 'Total de dispositivos',
    example: 15,
  })
  total!: number;
}
