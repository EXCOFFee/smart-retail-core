/**
 * ============================================================================
 * SMART_RETAIL - Refresh Token Service
 * ============================================================================
 * Servicio para gestión de Refresh Tokens.
 * 
 * ARQUITECTURA: Capa de APLICACIÓN 🟠 (services)
 * 
 * IMPLEMENTA: DA-02 (Refresh Token, TTL 7 días, almacenado en Redis)
 * 
 * FLUJO DE REFRESH:
 * 1. Cliente envía Refresh Token expirado/próximo a expirar
 * 2. RefreshTokenService valida el token contra Redis
 * 3. Si válido, genera nuevo par AccessToken + RefreshToken
 * 4. Invalida el Refresh Token anterior (rotación)
 * 5. Retorna nuevos tokens al cliente
 * 
 * SEGURIDAD:
 * - Refresh Tokens son opacos (no JWT) - UUID aleatorio
 * - Se almacenan hasheados en Redis
 * - Rotación en cada uso (impide reuso)
 * - Revocación explícita en logout
 * ============================================================================
 */

import {
    Injectable,
    Logger,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { Redis } from 'ioredis';

import { JwtPayload } from '@infrastructure/auth/strategies/jwt.strategy';

/**
 * Resultado de la generación de tokens
 */
export interface TokenPair {
  /** Access Token JWT (15min TTL) */
  accessToken: string;
  /** Refresh Token opaco (7 días TTL) */
  refreshToken: string;
  /** Timestamp de expiración del Access Token */
  accessTokenExpiresAt: Date;
  /** Timestamp de expiración del Refresh Token */
  refreshTokenExpiresAt: Date;
}

/**
 * Datos almacenados para el Refresh Token en Redis
 */
interface StoredRefreshToken {
  userId: string;
  email: string;
  role: string;
  locationId: string;
  issuedAt: number;
  expiresAt: number;
  /** Token anterior (para detectar reutilización) */
  previousTokenHash?: string;
}

/**
 * Prefijos de claves Redis para tokens
 */
const REDIS_KEYS = {
  /** Refresh token: rt:{hashedToken} */
  REFRESH_TOKEN: 'rt',
  /** Tokens revocados por usuario: revoked:{userId} */
  REVOKED: 'revoked',
} as const;

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);
  private readonly redis: Redis;

  /** TTL del Access Token en segundos (15 minutos) */
  private readonly accessTokenTtl: number;

  /** TTL del Refresh Token en segundos (7 días) */
  private readonly refreshTokenTtl: number;

  /** Clave privada para firmar JWTs */
  private readonly jwtPrivateKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    this.redis = new Redis({
      host: this.configService.getOrThrow<string>('REDIS_HOST'),
      port: this.configService.getOrThrow<number>('REDIS_PORT'),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      db: this.configService.get<number>('REDIS_DB', 0),
      // Configuración resiliente para Railway
      connectTimeout: 5000,
      commandTimeout: 2000,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });

    this.accessTokenTtl = this.configService.get<number>(
      'JWT_ACCESS_TOKEN_TTL',
      15 * 60, // 15 minutos
    );

    this.refreshTokenTtl = this.configService.get<number>(
      'JWT_REFRESH_TOKEN_TTL',
      7 * 24 * 60 * 60, // 7 días
    );

    this.jwtPrivateKey = this.configService.getOrThrow<string>('JWT_PRIVATE_KEY');
  }

  /**
   * Genera un nuevo par de tokens para un usuario.
   * 
   * Usado después de login exitoso o refresh.
   * 
   * @param userId - ID del usuario
   * @param email - Email del usuario
   * @param role - Rol del usuario
   * @param locationId - ID de la ubicación del usuario
   * @returns Par de tokens (access + refresh)
   */
  async generateTokens(
    userId: string,
    email: string,
    role: 'consumer' | 'merchant' | 'operator' | 'admin',
    locationId: string,
  ): Promise<TokenPair> {
    const now = Math.floor(Date.now() / 1000);

    // Generar Access Token JWT
    const accessTokenPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: userId,
      email,
      role,
      locationId,
    };

    const accessToken = this.jwtService.sign(accessTokenPayload, {
      privateKey: this.jwtPrivateKey,
      algorithm: 'RS256',
      expiresIn: this.accessTokenTtl,
    });

    // Generar Refresh Token opaco
    const refreshToken = this.generateOpaqueToken();
    const refreshTokenHash = this.hashToken(refreshToken);

    // Almacenar Refresh Token en Redis
    const storedData: StoredRefreshToken = {
      userId,
      email,
      role,
      locationId,
      issuedAt: now,
      expiresAt: now + this.refreshTokenTtl,
    };

    await this.redis.setex(
      `${REDIS_KEYS.REFRESH_TOKEN}:${refreshTokenHash}`,
      this.refreshTokenTtl,
      JSON.stringify(storedData),
    );

    this.logger.debug(`Generated token pair for user ${userId}`);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: new Date((now + this.accessTokenTtl) * 1000),
      refreshTokenExpiresAt: new Date((now + this.refreshTokenTtl) * 1000),
    };
  }

  /**
   * Renueva tokens usando un Refresh Token válido.
   * 
   * SEGURIDAD: Implementa rotación de tokens.
   * El Refresh Token usado se invalida y se genera uno nuevo.
   * 
   * @param refreshToken - Refresh Token actual
   * @returns Nuevo par de tokens
   * @throws UnauthorizedException si el token es inválido o expirado
   */
  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(refreshToken);
    const key = `${REDIS_KEYS.REFRESH_TOKEN}:${tokenHash}`;

    // Obtener datos del token
    const storedDataJson = await this.redis.get(key);

    if (!storedDataJson) {
      this.logger.warn('Refresh token not found or expired');
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const storedData: StoredRefreshToken = JSON.parse(storedDataJson);

    // Verificar expiración explícita
    const now = Math.floor(Date.now() / 1000);
    if (storedData.expiresAt < now) {
      await this.redis.del(key);
      throw new UnauthorizedException('Refresh token has expired');
    }

    // ROTACIÓN: Invalidar el token usado
    await this.redis.del(key);

    // Generar nuevo par de tokens
    const newTokens = await this.generateTokens(
      storedData.userId,
      storedData.email,
      storedData.role as 'consumer' | 'merchant' | 'operator' | 'admin',
      storedData.locationId,
    );

    this.logger.debug(`Rotated tokens for user ${storedData.userId}`);

    return newTokens;
  }

  /**
   * Revoca un Refresh Token (logout).
   * 
   * @param refreshToken - Token a revocar
   */
  async revokeToken(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const key = `${REDIS_KEYS.REFRESH_TOKEN}:${tokenHash}`;

    await this.redis.del(key);
    this.logger.debug('Refresh token revoked');
  }

  /**
   * Revoca todos los Refresh Tokens de un usuario (logout de todas las sesiones).
   * 
   * Por qué: Permite al usuario cerrar sesión en todos los dispositivos.
   * 
   * @param userId - ID del usuario
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    // Buscar todos los tokens del usuario usando SCAN
    const pattern = `${REDIS_KEYS.REFRESH_TOKEN}:*`;
    let cursor = '0';
    const keysToDelete: string[] = [];

    do {
      const [newCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = newCursor;

      // Verificar cada clave para ver si pertenece al usuario
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const stored: StoredRefreshToken = JSON.parse(data);
          if (stored.userId === userId) {
            keysToDelete.push(key);
          }
        }
      }
    } while (cursor !== '0');

    // Eliminar todos los tokens encontrados
    if (keysToDelete.length > 0) {
      await this.redis.del(...keysToDelete);
      this.logger.log(
        `Revoked ${keysToDelete.length} tokens for user ${userId}`,
      );
    }
  }

  /**
   * Genera un token opaco aleatorio.
   * 
   * Por qué 32 bytes: 256 bits de entropía, suficiente para seguridad.
   * Base64 URL-safe para uso en URLs/headers.
   */
  private generateOpaqueToken(): string {
    return randomBytes(32).toString('base64url');
  }

  /**
   * Hashea un token para almacenamiento seguro.
   * 
   * Por qué SHA-256: No reversible, permite verificar sin exponer el original.
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
