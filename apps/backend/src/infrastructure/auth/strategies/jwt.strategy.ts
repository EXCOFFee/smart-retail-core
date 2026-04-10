/**
 * ============================================================================
 * SMART_RETAIL - JWT Strategy (Passport)
 * ============================================================================
 * Estrategia de autenticación JWT para Passport.
 * 
 * ARQUITECTURA: Capa de INFRAESTRUCTURA 🔵 (auth/strategies)
 * 
 * IMPLEMENTA: DA-02 (Access Token RS256, TTL 15min)
 * 
 * FLUJO:
 * 1. Request llega con header "Authorization: Bearer <token>"
 * 2. Passport extrae el token y lo pasa a JwtStrategy
 * 3. JwtStrategy verifica firma RS256 y expiración
 * 4. Si válido, validate() retorna el payload al Guard
 * 5. Guard adjunta el usuario a request.user
 * ============================================================================
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

/**
 * Payload del Access Token JWT.
 * 
 * Por qué mínimo: Solo lo esencial para autorización rápida.
 * Datos adicionales se obtienen del DB si es necesario.
 */
export interface JwtPayload {
  /** Subject - User ID (UUID) */
  sub: string;

  /** Email del usuario */
  email: string;

  /** Rol del usuario */
  role: 'consumer' | 'merchant' | 'operator' | 'admin';

  /** Location ID al que pertenece el usuario */
  locationId: string;

  /** Issued At - timestamp de emisión */
  iat: number;

  /** Expiration - timestamp de expiración */
  exp: number;
}

/**
 * Usuario autenticado adjunto a request.user
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'consumer' | 'merchant' | 'operator' | 'admin';
  locationId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    const publicKey = configService.getOrThrow<string>('JWT_PUBLIC_KEY');

    super({
      // Extrae token del header Authorization: Bearer <token>
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // No ignorar expiración - tokens expirados son rechazados
      ignoreExpiration: false,

      // Clave pública RS256 para verificar firma
      // Por qué RS256: Permite verificar sin exponer la clave privada
      secretOrKey: publicKey,

      // Algoritmo esperado - rechaza otros para prevenir ataques
      algorithms: ['RS256'],
    });
  }

  /**
   * Valida el payload del JWT.
   * 
   * Este método es llamado DESPUÉS de que Passport verifica la firma
   * y expiración. Aquí podemos hacer validaciones adicionales.
   * 
   * @param payload - Payload decodificado del JWT
   * @returns Usuario autenticado para adjuntar a request.user
   * @throws UnauthorizedException si el payload es inválido
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // Validación básica del payload
    if (!payload.sub || !payload.email || !payload.role) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // En producción, aquí podríamos:
    // 1. Verificar que el usuario existe en DB
    // 2. Verificar que no está desactivado
    // 3. Verificar que el token no está en blacklist (logout)
    // Por ahora, confiamos en el token si la firma es válida

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      locationId: payload.locationId,
    };
  }
}
