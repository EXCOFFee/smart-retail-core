/**
 * ============================================================================
 * SMART_RETAIL - Product DTOs
 * ============================================================================
 * DTOs para operaciones CRUD de productos.
 * 
 * ARQUITECTURA: Capa de INTERFACES 🟢 (http/dto)
 * 
 * IMPLEMENTA:
 * - Validación estricta de entrada
 * - Optimistic Locking para actualización de stock
 * - Documentación Swagger completa
 * 
 * REGLA 8: Todos los valores monetarios en centavos (enteros)
 * ============================================================================
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsPositive,
    IsString,
    IsUUID,
    Max,
    MaxLength,
    Min,
    MinLength,
} from 'class-validator';

import { ProductStatus } from '@domain/entities/product.entity';

// ─────────────────────────────────────────────────────────────────────────────
// CREATE PRODUCT DTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DTO para creación de producto.
 */
export class CreateProductDto {
  @ApiProperty({
    description: 'SKU (Stock Keeping Unit) - Código único del producto',
    example: 'PROD-001',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty({ message: 'El SKU es requerido' })
  @MinLength(2, { message: 'El SKU debe tener al menos 2 caracteres' })
  @MaxLength(50, { message: 'El SKU no puede exceder 50 caracteres' })
  sku!: string;

  @ApiProperty({
    description: 'Nombre del producto',
    example: 'Café Espresso',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name!: string;

  @ApiPropertyOptional({
    description: 'Descripción del producto',
    example: 'Café espresso italiano de alta calidad',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'La descripción no puede exceder 500 caracteres' })
  description?: string;

  @ApiProperty({
    description: 'Precio en centavos (REGLA 8: sin decimales)',
    example: 150000,
    minimum: 0,
  })
  @IsInt({ message: 'El precio debe ser un número entero (centavos)' })
  @Min(0, { message: 'El precio no puede ser negativo' })
  @Type(() => Number)
  priceCents!: number;

  @ApiProperty({
    description: 'Cantidad en stock',
    example: 100,
    minimum: 0,
  })
  @IsInt({ message: 'El stock debe ser un número entero' })
  @Min(0, { message: 'El stock no puede ser negativo' })
  @Type(() => Number)
  stockQuantity!: number;

  @ApiPropertyOptional({
    description: 'Umbral para alerta de stock bajo',
    example: 10,
    default: 10,
    minimum: 0,
  })
  @IsInt({ message: 'El umbral debe ser un número entero' })
  @Min(0, { message: 'El umbral no puede ser negativo' })
  @IsOptional()
  @Type(() => Number)
  lowStockThreshold?: number;

  @ApiProperty({
    description: 'ID de la ubicación/sucursal',
    example: '550e8400-e29b-41d4-a716-446655440001',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'El locationId debe ser un UUID válido' })
  locationId!: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE PRODUCT DTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DTO para actualización parcial de producto.
 * Extiende CreateProductDto con campos opcionales.
 */
export class UpdateProductDto extends PartialType(CreateProductDto) {
  @ApiPropertyOptional({
    description: 'Estado del producto',
    enum: ProductStatus,
    example: 'ACTIVE',
  })
  @IsEnum(ProductStatus, { message: 'El estado debe ser un valor válido' })
  @IsOptional()
  status?: ProductStatus;

  @ApiPropertyOptional({
    description: 'Si el producto está activo',
    example: true,
  })
  @IsBoolean({ message: 'isActive debe ser un booleano' })
  @IsOptional()
  isActive?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE STOCK DTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DTO para actualización de stock con Optimistic Locking.
 * 
 * El expectedVersion previene condiciones de carrera:
 * Si otro proceso modificó el producto, la versión habrá cambiado
 * y la operación fallará con error 409 Conflict.
 */
export class UpdateStockDto {
  @ApiProperty({
    description: 'Nueva cantidad de stock',
    example: 50,
    minimum: 0,
  })
  @IsInt({ message: 'El stock debe ser un número entero' })
  @Min(0, { message: 'El stock no puede ser negativo' })
  @Type(() => Number)
  stockQuantity!: number;

  @ApiProperty({
    description: 'Versión esperada del producto (para Optimistic Locking)',
    example: 5,
    minimum: 1,
  })
  @IsInt({ message: 'La versión debe ser un número entero' })
  @IsPositive({ message: 'La versión debe ser positiva' })
  @Type(() => Number)
  expectedVersion!: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT RESPONSE DTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DTO de respuesta con datos del producto.
 */
export class ProductResponseDto {
  @ApiProperty({
    description: 'ID único del producto',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'SKU del producto',
    example: 'PROD-001',
  })
  sku!: string;

  @ApiProperty({
    description: 'Nombre del producto',
    example: 'Café Espresso',
  })
  name!: string;

  @ApiPropertyOptional({
    description: 'Descripción del producto',
    example: 'Café espresso italiano de alta calidad',
  })
  description?: string;

  @ApiProperty({
    description: 'Precio en centavos',
    example: 150000,
  })
  priceCents!: number;

  @ApiProperty({
    description: 'Precio formateado',
    example: '1500.00',
  })
  priceFormatted!: string;

  @ApiProperty({
    description: 'Cantidad en stock',
    example: 100,
  })
  stockQuantity!: number;

  @ApiProperty({
    description: 'Umbral de stock bajo',
    example: 10,
  })
  lowStockThreshold!: number;

  @ApiProperty({
    description: 'Si el stock está bajo el umbral',
    example: false,
  })
  isLowStock!: boolean;

  @ApiProperty({
    description: 'ID de la ubicación',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  locationId!: string;

  @ApiProperty({
    description: 'Estado del producto',
    enum: ProductStatus,
    example: 'ACTIVE',
  })
  status!: ProductStatus;

  @ApiProperty({
    description: 'Si el producto está activo',
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({
    description: 'Versión del producto (para Optimistic Locking)',
    example: 1,
  })
  version!: number;

  @ApiProperty({
    description: 'Fecha de creación',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Fecha de última actualización',
    example: '2024-01-15T10:30:00.000Z',
  })
  updatedAt!: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT LIST RESPONSE DTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DTO de respuesta para lista de productos.
 */
export class ProductListResponseDto {
  @ApiProperty({
    description: 'Lista de productos',
    type: [ProductResponseDto],
  })
  products!: ProductResponseDto[];

  @ApiProperty({
    description: 'Total de productos (sin paginación)',
    example: 50,
  })
  total!: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT QUERY DTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DTO para filtrar productos en consultas.
 */
export class ProductQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por ubicación',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID('4', { message: 'El locationId debe ser un UUID válido' })
  @IsOptional()
  locationId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por SKU (búsqueda parcial)',
    example: 'PROD',
  })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado',
    enum: ProductStatus,
    example: 'ACTIVE',
  })
  @IsEnum(ProductStatus, { message: 'El estado debe ser un valor válido' })
  @IsOptional()
  status?: ProductStatus;

  @ApiPropertyOptional({
    description: 'Filtrar por stock mínimo (solo productos con stock >= este valor)',
    example: 5,
    minimum: 0,
  })
  @IsInt({ message: 'minStock debe ser un número entero' })
  @Min(0, { message: 'minStock no puede ser negativo' })
  @IsOptional()
  @Type(() => Number)
  minStock?: number;

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
