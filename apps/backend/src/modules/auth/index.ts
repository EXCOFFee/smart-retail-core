/**
 * ============================================================================
 * SMART_RETAIL - Auth Barrel Export
 * ============================================================================
 */

// Guards
export { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
export { RolesGuard } from '@infrastructure/auth/guards/roles.guard';

// Decorators
export { CurrentUser } from '@infrastructure/auth/decorators/current-user.decorator';
export { IS_PUBLIC_KEY, Public } from '@infrastructure/auth/decorators/public.decorator';
export { ROLES_KEY, Roles } from '@infrastructure/auth/decorators/roles.decorator';

// Strategy & Types
export { AuthenticatedUser, JwtPayload, JwtStrategy } from '@infrastructure/auth/strategies/jwt.strategy';

// Services
export { RefreshTokenService, TokenPair } from '@application/services/refresh-token.service';

// Module
export { AuthModule } from '@modules/auth/auth.module';
