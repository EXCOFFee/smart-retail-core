/**
 * ============================================================================
 * SMART_RETAIL - Auth DTOs
 * ============================================================================
 * DTOs para operaciones de autenticación y autorización.
 * 
 * ARQUITECTURA: Capa de INTERFACES 🟢 (http/dto)
 * 
 * IMPLEMENTA:
 * - DA-02: JWT RS256 con Refresh Tokens
 * - Validación estricta de entrada
 * - Documentación Swagger completa
 * ============================================================================
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsEmail,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    MinLength,
} from 'class-validator';

import { UserRole } from '@domain/entities/user.entity';

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN DTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DTO para login de usuario.
 */
export class LoginDto {
  @ApiProperty({
    description: 'Email del usuario',
    example: 'usuario@smartretail.cl',
    format: 'email',
  })
  @IsEmail({}, { message: 'El email debe tener un formato válido' })
  @IsNotEmpty({ message: 'El email es requerido' })
  @MaxLength(255, { message: 'El email no puede exceder 255 caracteres' })
  email!: string;

  @ApiProperty({
    description: 'Contraseña del usuario',
    example: 'MiPassword123!',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(128, { message: 'La contraseña no puede exceder 128 caracteres' })
  password!: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER DTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Roles válidos para registro (enum para validación).
 */
export enum RegisterRoleDto {
  CONSUMER = 'consumer',
  MERCHANT = 'merchant',
  OPERATOR = 'operator',
  ADMIN = 'admin',
}

/**
 * DTO para registro de nuevo usuario.
 */
export class RegisterDto {
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
    example: 'MiPassword123!',
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
    enum: RegisterRoleDto,
    example: 'consumer',
  })
  @IsEnum(RegisterRoleDto, { message: 'El rol debe ser un valor válido' })
  role!: RegisterRoleDto;

  @ApiProperty({
    description: 'ID de la ubicación/sucursal',
    example: '550e8400-e29b-41d4-a716-446655440001',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'El locationId debe ser un UUID válido' })
  locationId!: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// REFRESH TOKEN DTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DTO para renovación de tokens.
 */
export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh Token actual',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty({ message: 'El refresh token es requerido' })
  refreshToken!: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGOUT DTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DTO para logout (opcional: especificar token a revocar).
 */
export class LogoutDto {
  @ApiPropertyOptional({
    description: 'Refresh Token a revocar (si no se especifica, se revocan todos)',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsOptional()
  refreshToken?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE PASSWORD DTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DTO para cambio de contraseña.
 */
export class ChangePasswordDto {
  @ApiProperty({
    description: 'Contraseña actual',
    example: 'MiPasswordActual123!',
  })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña actual es requerida' })
  currentPassword!: string;

  @ApiProperty({
    description: 'Nueva contraseña',
    example: 'MiNuevaPassword123!',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty({ message: 'La nueva contraseña es requerida' })
  @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres' })
  @MaxLength(128, { message: 'La nueva contraseña no puede exceder 128 caracteres' })
  newPassword!: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH RESPONSE DTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Información del usuario en la respuesta de auth.
 */
export class AuthUserDto {
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
}

/**
 * DTO de respuesta para operaciones de autenticación.
 */
export class AuthResponseDto {
  @ApiProperty({
    description: 'Access Token JWT (RS256, 15 min TTL)',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'Refresh Token (7 días TTL)',
    example: 'dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...',
  })
  refreshToken!: string;

  @ApiProperty({
    description: 'Tiempo de expiración del Access Token en segundos',
    example: 900,
  })
  expiresIn!: number;

  @ApiProperty({
    description: 'Información del usuario autenticado',
    type: AuthUserDto,
  })
  user!: AuthUserDto;
}

// ─────────────────────────────────────────────────────────────────────────────
// USER PROFILE RESPONSE DTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DTO de respuesta para el perfil del usuario actual.
 */
export class UserProfileResponseDto {
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
