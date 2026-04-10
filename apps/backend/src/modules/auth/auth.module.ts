/**
 * ============================================================================
 * SMART_RETAIL - Auth Module
 * ============================================================================
 * Módulo de autenticación y autorización.
 * 
 * ARQUITECTURA: Capa de MÓDULOS 🟣
 * 
 * PROVEE:
 * - JwtStrategy para validación de Access Tokens
 * - JwtAuthGuard para proteger rutas
 * - RolesGuard para autorización basada en roles
 * - RefreshTokenService para gestión de tokens
 * ============================================================================
 */

import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { RefreshTokenService } from '@application/services/refresh-token.service';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@infrastructure/auth/guards/roles.guard';
import { JwtStrategy } from '@infrastructure/auth/strategies/jwt.strategy';

/**
 * Módulo global de autenticación.
 * 
 * Por qué Global: Los guards y decoradores se usan en toda la aplicación.
 * Evita tener que importar AuthModule en cada módulo.
 */
@Global()
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        privateKey: configService.getOrThrow<string>('JWT_PRIVATE_KEY'),
        publicKey: configService.getOrThrow<string>('JWT_PUBLIC_KEY'),
        signOptions: {
          algorithm: 'RS256',
          expiresIn: configService.get<number>('JWT_ACCESS_TOKEN_TTL', 900), // 15min default
        },
      }),
    }),
  ],
  providers: [
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    RefreshTokenService,
  ],
  exports: [
    JwtAuthGuard,
    RolesGuard,
    RefreshTokenService,
    JwtModule,
    PassportModule,
  ],
})
export class AuthModule {}
