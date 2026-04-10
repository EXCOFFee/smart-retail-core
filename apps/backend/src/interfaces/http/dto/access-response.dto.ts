/**
 * ============================================================================
 * SMART_RETAIL - Access Response DTO
 * ============================================================================
 * DTO para la respuesta de una solicitud de acceso.
 * 
 * ARQUITECTURA: Capa de INTERFACES 🟢 (http/dto)
 * ============================================================================
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Detalle del monto cobrado.
 */
export class AmountChargedDto {
  @ApiProperty({
    description: 'Monto en centavos',
    example: 15000,
  })
  cents!: number;

  @ApiProperty({
    description: 'Monto formateado para display',
    example: '$150.00',
  })
  formatted!: string;
}

/**
 * DTO de respuesta para solicitud de acceso.
 */
export class AccessResponseDto {
  @ApiProperty({
    description: 'ID de la transacción creada',
    example: '550e8400-e29b-41d4-a716-446655440099',
    format: 'uuid',
  })
  transactionId!: string;

  @ApiProperty({
    description: 'Estado final de la transacción',
    enum: ['COMPLETED', 'FAILED', 'PENDING', 'PENDING_PAYMENT'],
    example: 'COMPLETED',
  })
  status!: 'COMPLETED' | 'FAILED' | 'PENDING' | 'PENDING_PAYMENT';

  @ApiProperty({
    description: 'Mensaje descriptivo del resultado',
    example: 'Acceso concedido',
  })
  message!: string;

  @ApiPropertyOptional({
    description: 'Detalle del monto cobrado (si aplica)',
    type: () => AmountChargedDto,
  })
  amountCharged?: AmountChargedDto;

  @ApiProperty({
    description: 'Tiempo de procesamiento en milisegundos',
    example: 185,
  })
  processingTimeMs!: number;
}

/**
 * DTO para respuestas de error estándar.
 */
export class ErrorResponseDto {
  @ApiProperty({
    description: 'Código de estado HTTP',
    example: 409,
  })
  statusCode!: number;

  @ApiProperty({
    description: 'Mensaje de error',
    example: 'Stock insuficiente para el producto solicitado',
  })
  message!: string;

  @ApiProperty({
    description: 'Código de error interno',
    example: 'STOCK_INSUFFICIENT',
  })
  errorCode!: string;

  @ApiPropertyOptional({
    description: 'Detalles adicionales del error',
    example: { productId: '123', available: 0, requested: 1 },
  })
  details?: Record<string, unknown>;

  @ApiProperty({
    description: 'ID de trazabilidad para soporte',
    example: 'trace-12345-abcde',
  })
  traceId!: string;

  @ApiProperty({
    description: 'Timestamp del error',
    example: '2025-01-15T10:30:00.000Z',
  })
  timestamp!: string;
}
