/**
 * ============================================================================
 * SMART_RETAIL - Transaction DTOs
 * ============================================================================
 * DTOs para operaciones de consulta de transacciones.
 * 
 * ARQUITECTURA: Capa de INTERFACES 🟢 (http/dto)
 * 
 * NOTA: Las transacciones se crean a través del flujo de Access (CU-01),
 * no directamente por esta API. Estos endpoints son solo para consulta.
 * ============================================================================
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsDate,
    IsEnum,
    IsInt,
    IsOptional,
    IsUUID,
    Max,
    Min
} from 'class-validator';

import { TransactionStatus } from '@domain/entities/transaction.entity';

// ─────────────────────────────────────────────────────────────────────────────
// TRANSACTION QUERY DTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DTO para filtrar transacciones en consultas.
 */
export class TransactionQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por usuario',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por dispositivo',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  deviceId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ubicación',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  locationId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado',
    enum: TransactionStatus,
  })
  @IsEnum(TransactionStatus)
  @IsOptional()
  status?: TransactionStatus;

  @ApiPropertyOptional({
    description: 'Fecha de inicio (formato ISO)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  fromDate?: Date;

  @ApiPropertyOptional({
    description: 'Fecha de fin (formato ISO)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  toDate?: Date;

  @ApiPropertyOptional({
    description: 'Límite de resultados',
    example: 50,
    default: 50,
    minimum: 1,
    maximum: 100,
  })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Offset para paginación',
    example: 0,
    default: 0,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  offset?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSACTION RESPONSE DTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Información del pago asociado.
 */
export class PaymentInfoDto {
  @ApiPropertyOptional({ description: 'ID externo de la pasarela' })
  externalId?: string | null;

  @ApiPropertyOptional({ 
    description: 'Pasarela de pago usada',
    enum: ['MERCADOPAGO', 'MODO'],
  })
  gateway?: string | null;

  @ApiPropertyOptional({ description: 'Método de pago' })
  method?: string | null;

  @ApiPropertyOptional({ description: 'Código de respuesta' })
  responseCode?: string | null;
}

/**
 * DTO de respuesta con datos de la transacción.
 */
export class TransactionResponseDto {
  @ApiProperty({ description: 'ID único de la transacción' })
  id!: string;

  @ApiProperty({ description: 'ID del usuario' })
  userId!: string;

  @ApiProperty({ description: 'ID del dispositivo' })
  deviceId!: string;

  @ApiPropertyOptional({ description: 'ID del producto (si aplica)' })
  productId?: string | null;

  @ApiProperty({ description: 'ID de la ubicación' })
  locationId!: string;

  @ApiProperty({ description: 'Monto en centavos' })
  amountCents!: number;

  @ApiProperty({ description: 'Monto formateado en pesos chilenos' })
  amountFormatted!: string;

  @ApiProperty({ description: 'Cantidad de productos' })
  quantity!: number;

  @ApiProperty({ 
    description: 'Estado de la transacción',
    enum: TransactionStatus,
  })
  status!: TransactionStatus;

  @ApiProperty({ 
    description: 'Información del pago',
    type: PaymentInfoDto,
  })
  paymentInfo!: PaymentInfoDto;

  @ApiProperty({ description: 'ID de trazabilidad' })
  traceId!: string;

  @ApiProperty({ description: 'Fecha de creación' })
  createdAt!: Date;

  @ApiProperty({ description: 'Fecha de última actualización' })
  updatedAt!: Date;

  @ApiPropertyOptional({ description: 'Fecha de completado' })
  completedAt?: Date | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSACTION LIST RESPONSE DTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DTO de respuesta para lista de transacciones.
 */
export class TransactionListResponseDto {
  @ApiProperty({
    description: 'Lista de transacciones',
    type: [TransactionResponseDto],
  })
  transactions!: TransactionResponseDto[];

  @ApiProperty({
    description: 'Total de transacciones (sin paginación)',
    example: 100,
  })
  total!: number;

  @ApiProperty({
    description: 'Límite usado',
    example: 50,
  })
  limit!: number;

  @ApiProperty({
    description: 'Offset usado',
    example: 0,
  })
  offset!: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// DAILY SUMMARY DTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DTO para resumen diario de transacciones (Cierre de Caja - CU-14).
 */
export class DailySummaryQueryDto {
  @ApiProperty({
    description: 'ID de la ubicación',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  locationId!: string;

  @ApiProperty({
    description: 'Fecha del resumen (formato ISO)',
    example: '2024-01-15',
  })
  @Type(() => Date)
  @IsDate()
  date!: Date;
}

/**
 * DTO de respuesta para resumen diario.
 */
export class DailySummaryResponseDto {
  @ApiProperty({ description: 'ID de la ubicación' })
  locationId!: string;

  @ApiProperty({ description: 'Fecha del resumen' })
  date!: Date;

  @ApiProperty({ description: 'Total de transacciones' })
  totalTransactions!: number;

  @ApiProperty({ description: 'Monto total en centavos' })
  totalAmountCents!: number;

  @ApiProperty({ description: 'Monto total formateado' })
  totalAmountFormatted!: string;

  @ApiProperty({ 
    description: 'Conteo por estado',
    example: { COMPLETED: 45, FAILED: 3, REFUNDED_HW_FAILURE: 1 },
  })
  byStatus!: Record<string, number>;
}
