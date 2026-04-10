/**
 * ============================================================================
 * SMART_RETAIL - Auth Service
 * ============================================================================
 * Servicio de aplicación para autenticación y autorización.
 * 
 * ARQUITECTURA: Capa de APLICACIÓN 🟠 (services)
 * 
 * IMPLEMENTA:
 * - Login con validación de credenciales
 * - Registro de nuevos usuarios
 * - Renovación de tokens
 * - Logout (revocación de tokens)
 * - Cambio de contraseña
 * 
 * SEGURIDAD:
 * - Password hashing con SHA-256 (TODO: migrar a bcrypt)
 * - JWT RS256 para Access Tokens
 * - Refresh Tokens opacos en Redis
 * ============================================================================
 */

import {
    BadRequestException,
    ConflictException,
    Inject,
    Injectable,
    Logger,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';

import {
    IUserRepository,
    USER_REPOSITORY,
} from '@application/ports/output/repositories.port';
import {
    RefreshTokenService,
    TokenPair,
} from '@application/services/refresh-token.service';
import { User, UserRole } from '@domain/entities/user.entity';
import { Money } from '@domain/value-objects/money.value-object';

/**
 * DTO interno para registro de usuario
 */
interface RegisterUserDto {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  locationId: string;
}

/**
 * Resultado de autenticación exitosa
 */
interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
  };
}

/**
 * Perfil del usuario
 */
interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  walletBalanceCents: number;
  walletBalanceFormatted: string;
  locationId: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Autentica un usuario con email y contraseña.
   * 
   * @param email - Email del usuario
   * @param password - Contraseña en texto plano
   * @returns Tokens y datos del usuario
   * @throws UnauthorizedException si las credenciales son inválidas
   */
  async login(email: string, password: string): Promise<AuthResult> {
    this.logger.log(`Login attempt for: ${email}`);

    // Buscar usuario por email
    const user = await this.userRepository.findByEmail(email.toLowerCase().trim());

    if (!user) {
      this.logger.warn(`Login failed: user not found - ${email}`);
      // Mensaje genérico por seguridad
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Verificar que el usuario está activo
    if (!user.isActive) {
      this.logger.warn(`Login failed: user inactive - ${email}`);
      throw new UnauthorizedException('Usuario desactivado');
    }

    // Verificar contraseña
    const passwordHash = this.hashPassword(password);
    if (passwordHash !== user.passwordHash) {
      this.logger.warn(`Login failed: wrong password - ${email}`);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Generar tokens
    const tokens = await this.refreshTokenService.generateTokens(
      user.id,
      user.email,
      user.role,
      user.locationId,
    );

    // Actualizar lastLoginAt
    const updatedUser = new User({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      passwordHash: user.passwordHash,
      role: user.role,
      walletBalance: user.walletBalance,
      locationId: user.locationId,
      isActive: user.isActive,
      lastLoginAt: new Date(),
      createdAt: user.createdAt,
      updatedAt: new Date(),
    });
    await this.userRepository.save(updatedUser);

    this.logger.log(`Login successful: ${email}`);

    return this.buildAuthResult(user, tokens);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REGISTER
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Registra un nuevo usuario en el sistema.
   * 
   * @param dto - Datos del nuevo usuario
   * @returns Tokens y datos del usuario creado
   * @throws ConflictException si el email ya existe
   */
  async register(dto: RegisterUserDto): Promise<AuthResult> {
    this.logger.log(`Registration attempt for: ${dto.email}`);

    const normalizedEmail = dto.email.toLowerCase().trim();

    // Verificar que el email no existe
    const existingUser = await this.userRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      this.logger.warn(`Registration failed: email exists - ${normalizedEmail}`);
      throw new ConflictException('El email ya está registrado');
    }

    // Crear nuevo usuario
    const userId = randomUUID();
    const passwordHash = this.hashPassword(dto.password);

    const user = new User({
      id: userId,
      email: normalizedEmail,
      fullName: dto.fullName.trim(),
      passwordHash,
      role: dto.role,
      walletBalance: Money.zero(),
      locationId: dto.locationId,
      isActive: true,
      lastLoginAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await this.userRepository.save(user);

    // Generar tokens
    const tokens = await this.refreshTokenService.generateTokens(
      user.id,
      user.email,
      user.role,
      user.locationId,
    );

    this.logger.log(`Registration successful: ${normalizedEmail}`);

    return this.buildAuthResult(user, tokens);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REFRESH TOKEN
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Renueva los tokens usando un Refresh Token válido.
   * 
   * @param refreshToken - Refresh Token actual
   * @returns Nuevos tokens
   * @throws UnauthorizedException si el token es inválido
   */
  async refreshToken(refreshToken: string): Promise<AuthResult> {
    this.logger.debug('Token refresh attempt');

    // RefreshTokenService maneja la validación y rotación
    const tokens = await this.refreshTokenService.refreshTokens(refreshToken);

    // Decodificar el nuevo access token para obtener datos del usuario
    // Nota: El payload ya fue validado por RefreshTokenService
    const payload = this.decodeAccessToken(tokens.accessToken);

    if (!payload) {
      throw new UnauthorizedException('Error al procesar tokens');
    }

    // Obtener usuario actualizado
    const user = await this.userRepository.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    this.logger.debug(`Token refresh successful for user: ${user.id}`);

    return this.buildAuthResult(user, tokens);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Cierra sesión del usuario, revocando tokens.
   * 
   * @param userId - ID del usuario
   * @param refreshToken - Token específico a revocar (opcional)
   */
  async logout(userId: string, refreshToken?: string): Promise<void> {
    this.logger.log(`Logout for user: ${userId}`);

    if (refreshToken) {
      // Revocar solo el token específico
      await this.refreshTokenService.revokeToken(refreshToken);
    } else {
      // Revocar todos los tokens del usuario
      await this.refreshTokenService.revokeAllUserTokens(userId);
    }

    this.logger.log(`Logout successful for user: ${userId}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CHANGE PASSWORD
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Cambia la contraseña del usuario.
   * 
   * @param userId - ID del usuario
   * @param currentPassword - Contraseña actual
   * @param newPassword - Nueva contraseña
   * @throws UnauthorizedException si la contraseña actual es incorrecta
   * @throws BadRequestException si la nueva contraseña es igual a la actual
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    this.logger.log(`Password change for user: ${userId}`);

    // Buscar usuario
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Verificar contraseña actual
    const currentHash = this.hashPassword(currentPassword);
    if (currentHash !== user.passwordHash) {
      this.logger.warn(`Password change failed: wrong current password - ${userId}`);
      throw new UnauthorizedException('Contraseña actual incorrecta');
    }

    // Verificar que la nueva contraseña sea diferente
    const newHash = this.hashPassword(newPassword);
    if (newHash === user.passwordHash) {
      throw new BadRequestException(
        'La nueva contraseña debe ser diferente a la actual',
      );
    }

    // Actualizar contraseña usando el método de dominio
    user.updatePassword(newHash);
    await this.userRepository.save(user);

    // Revocar todos los refresh tokens (forzar re-login)
    await this.refreshTokenService.revokeAllUserTokens(userId);

    this.logger.log(`Password changed successfully for user: ${userId}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET PROFILE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Obtiene el perfil del usuario.
   * 
   * @param userId - ID del usuario
   * @returns Datos del perfil
   * @throws NotFoundException si el usuario no existe
   */
  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      walletBalanceCents: user.walletBalance.cents,
      walletBalanceFormatted: user.walletBalance.toString(),
      locationId: user.locationId,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE METHODS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Hashea una contraseña con SHA-256.
   * 
   * TODO: Migrar a bcrypt para mayor seguridad.
   * SHA-256 es rápido (malo para passwords) y no tiene salt.
   * 
   * @param password - Contraseña en texto plano
   * @returns Hash SHA-256 en hexadecimal
   */
  private hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex');
  }

  /**
   * Construye el resultado de autenticación.
   * 
   * @param user - Usuario autenticado
   * @param tokens - Par de tokens generados
   * @returns AuthResult con todos los datos
   */
  private buildAuthResult(user: User, tokens: TokenPair): AuthResult {
    // Calcular expiresIn en segundos desde accessTokenExpiresAt
    const expiresIn = Math.floor(
      (tokens.accessTokenExpiresAt.getTime() - Date.now()) / 1000,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  /**
   * Decodifica un Access Token JWT (sin verificar firma).
   * 
   * Usado internamente para extraer el payload después de que
   * RefreshTokenService ya validó el token.
   * 
   * @param accessToken - Token JWT
   * @returns Payload decodificado o null
   */
  private decodeAccessToken(
    accessToken: string,
  ): { sub: string; email: string; role: UserRole; locationId: string } | null {
    try {
      const parts = accessToken.split('.');
      if (parts.length !== 3) return null;

      const payloadBase64 = parts[1];
      const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
      const payload = JSON.parse(payloadJson);

      return {
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
        locationId: payload.locationId,
      };
    } catch {
      return null;
    }
  }
}
