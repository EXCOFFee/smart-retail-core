/**
 * ============================================================================
 * SMART_RETAIL - User DTOs
 * ============================================================================
 * DTOs para operaciones CRUD de usuarios.
 * 
 * ARQUITECTURA: Capa de INTERFACES 🟢 (http/dto)
 * 
 * IMPLEMENTA:
 * - Validación estricta de entrada
 * - Operaciones de billetera virtual
 * - Documentación Swagger completa
 * 
 * REGLA 8: Todos los valores monetarios en centavos (enteros)
 * ============================================================================
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsEmail,
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

import { UserRole } from '@domain/entities/user.entity';

// ─────────────────────────────────────────────────────────────────────────────
// CREATE USER DTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Roles válidos para creación de usuario.
 */
export enum CreateUserRoleDto {
  CONSUMER = 'consumer',
  MERCHANT = 'merchant',
  OPERATOR = 'operator',
  ADMIN = 'admin',
}

/**
 * DTO para creación de usuario por admin.
 */
export class CreateUserDto {
  @ApiProperty({
    description: 'Email del usuario',
    example: 'nuevo.usuario@smartretail.cl',
    format: 'email',
  })
  @IsEmail({}, { message: 'El email debe tener un formato válido' })
  @IsNotEmpty({ message: 'El email es requerido' })
  @MaxLength(255, { message: 'El email no puede exceder 255 caracteres' })
  email!: string;

  @ApiProperty({
    description: 'Contraseña del usuario',
    example: 'Password123!',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(128, { message: 'La contraseña no puede exceder 128 caracteres' })
  password!: string;

  @ApiProperty({
    description: 'Nombre completo del usuario',
    example: 'Juan Pérez García',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre completo es requerido' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  fullName!: string;

  @ApiProperty({
    description: 'Rol del usuario',
    enum: CreateUserRoleDto,
    example: 'consumer',
  })
  @IsEnum(CreateUserRoleDto, { message: 'El rol debe ser un valor válido' })
  role!: CreateUserRoleDto;

  @ApiProperty({
    description: 'ID de la ubicación/sucursal',
    example: '550e8400-e29b-41d4-a716-446655440001',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'El locationId debe ser un UUID válido' })
  locationId!: string;

  @ApiPropertyOptional({
    description: 'Saldo inicial de la billetera en centavos',
    example: 100000,
    default: 0,
    minimum: 0,
  })
  @IsInt({ message: 'El saldo inicial debe ser un número entero (centavos)' })
  @Min(0, { message: 'El saldo inicial no puede ser negativo' })
  @IsOptional()
  @Type(() => Number)
  initialBalanceCents?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE USER DTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DTO para actualización parcial de usuario.
 */
export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'Nombre completo del usuario',
    example: 'Juan Pablo Pérez García',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({
    description: 'Rol del usuario',
    enum: CreateUserRoleDto,
    example: 'operator',
  })
  @IsEnum(CreateUserRoleDto, { message: 'El rol debe ser un valor válido' })
  @IsOptional()
  role?: CreateUserRoleDto;

  @ApiPropertyOptional({
    description: 'Si el usuario está activo',
    example: true,
  })
  @IsBoolean({ message: 'isActive debe ser un booleano' })
  @IsOptional()
  isActive?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// WALLET OPERATION DTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Operaciones válidas de billetera.
 */
export enum WalletOperationType {
  ADD = 'add',
  DEDUCT = 'deduct',
}

/**
 * DTO para operaciones de billetera virtual.
 */
export class WalletOperationDto {
  @ApiProperty({
    description: 'Tipo de operación',
    enum: WalletOperationType,
    example: 'add',
  })
  @IsEnum(WalletOperationType, { message: 'La operación debe ser "add" o "deduct"' })
  operation!: WalletOperationType;

  @ApiProperty({
    description: 'Monto de la operación en centavos',
    example: 50000,
    minimum: 1,
  })
  @IsInt({ message: 'El monto debe ser un número entero (centavos)' })
  @IsPositive({ message: 'El monto debe ser positivo' })
  @Type(() => Number)
  amountCents!: number;

  @ApiPropertyOptional({
    description: 'Razón de la operación',
    example: 'Recarga manual por admin',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255, { message: 'La razón no puede exceder 255 caracteres' })
  @IsOptional()
  reason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// USER RESPONSE DTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DTO de respuesta con datos del usuario.
 */
export class UserResponseDto {
  @ApiProperty({
    description: 'ID único del usuario',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'Email del usuario',
    example: 'usuario@smartretail.cl',
  })
  email!: string;

  @ApiProperty({
    description: 'Nombre completo del usuario',
    example: 'Juan Pérez García',
  })
  fullName!: string;

  @ApiProperty({
    description: 'Rol del usuario',
    example: 'consumer',
  })
  role!: UserRole;

  @ApiProperty({
    description: 'Saldo de la billetera en centavos',
    example: 150000,
  })
  walletBalanceCents!: number;

  @ApiProperty({
    description: 'Saldo formateado',
    example: '1500.00',
  })
  walletBalanceFormatted!: string;

  @ApiProperty({
    description: 'ID de la ubicación',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  locationId!: string;

  @ApiProperty({
    description: 'Si el usuario está activo',
    example: true,
  })
  isActive!: boolean;

  @ApiPropertyOptional({
    description: 'Último inicio de sesión',
    example: '2024-01-15T10:30:00.000Z',
  })
  lastLoginAt?: Date;

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
// USER LIST RESPONSE DTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DTO de respuesta para lista de usuarios.
 */
export class UserListResponseDto {
  @ApiProperty({
    description: 'Lista de usuarios',
    type: [UserResponseDto],
  })
  users!: UserResponseDto[];

  @ApiProperty({
    description: 'Total de usuarios (sin paginación)',
    example: 50,
  })
  total!: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// USER QUERY DTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DTO para filtrar usuarios en consultas.
 */
export class UserQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por ubicación',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID('4', { message: 'El locationId debe ser un UUID válido' })
  @IsOptional()
  locationId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por rol',
    enum: CreateUserRoleDto,
    example: 'consumer',
  })
  @IsEnum(CreateUserRoleDto, { message: 'El rol debe ser un valor válido' })
  @IsOptional()
  role?: CreateUserRoleDto;

  @ApiPropertyOptional({
    description: 'Filtrar por estado activo',
    example: true,
  })
  @IsBoolean({ message: 'isActive debe ser un booleano' })
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;

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
