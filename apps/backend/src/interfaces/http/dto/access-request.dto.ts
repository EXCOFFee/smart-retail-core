/**
 * ============================================================================
 * SMART_RETAIL - Access Request DTO
 * ============================================================================
 * DTO para solicitar acceso/compra en un punto de control.
 * 
 * ARQUITECTURA: Capa de INTERFACES 🟢 (http/dto)
 * 
 * Este DTO recibe la solicitud del escaneo de QR y valida todos
 * los campos antes de pasarlos al Use Case.
 * ============================================================================
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsDateString,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    Min,
    ValidateNested,
} from 'class-validator';

/**
 * Payload del QR escaneado.
 * 
 * Contiene información anti-replay para prevenir ataques.
 */
export class QrPayloadDto {
  @ApiProperty({
    description: 'Timestamp de generación del QR',
    example: '2025-01-15T10:30:00.000Z',
  })
  @IsDateString()
  timestamp!: string;

  @ApiProperty({
    description: 'Nonce único del QR (anti-replay)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsString()
  @IsNotEmpty()
  nonce!: string;
}

/**
 * DTO para solicitar acceso a través de un dispositivo IoT.
 * 
 * Este es el punto de entrada del "Critical Path" (CU-01).
 */
export class AccessRequestDto {
  @ApiProperty({
    description: 'ID del usuario que solicita acceso',
    example: '550e8400-e29b-41d4-a716-446655440001',
    format: 'uuid',
  })
  @IsUUID(4)
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({
    description: 'ID del dispositivo donde se escanea el QR',
    example: '550e8400-e29b-41d4-a716-446655440002',
    format: 'uuid',
  })
  @IsUUID(4)
  @IsNotEmpty()
  deviceId!: string;

  @ApiPropertyOptional({
    description: 'ID del producto a comprar (opcional para solo acceso)',
    example: '550e8400-e29b-41d4-a716-446655440003',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID(4)
  productId?: string;

  @ApiPropertyOptional({
    description: 'Cantidad a comprar (default: 1)',
    example: 1,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  quantity?: number;

  @ApiPropertyOptional({
    description: 'Payload del QR escaneado con información anti-replay',
    type: () => QrPayloadDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => QrPayloadDto)
  qrPayload?: QrPayloadDto;

  @ApiPropertyOptional({
    description: 'ID de trazabilidad externo (para debugging/correlación)',
    example: 'trace-12345-abcde',
  })
  @IsOptional()
  @IsString()
  externalTraceId?: string;
}
