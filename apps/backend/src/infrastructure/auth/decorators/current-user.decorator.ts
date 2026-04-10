/**
 * ============================================================================
 * SMART_RETAIL - Current User Decorator
 * ============================================================================
 * Decorador para extraer el usuario autenticado del request.
 * 
 * ARQUITECTURA: Capa de INFRAESTRUCTURA 🔵 (auth/decorators)
 * 
 * USO:
 * @Get('profile')
 * @UseGuards(JwtAuthGuard)
 * async getProfile(@CurrentUser() user: AuthenticatedUser) {
 *   return user;
 * }
 * 
 * // También soporta extracción de propiedades específicas:
 * @Get('location')
 * async getLocation(@CurrentUser('locationId') locationId: string) {
 *   return { locationId };
 * }
 * ============================================================================
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { AuthenticatedUser } from '../strategies/jwt.strategy';

/**
 * Extrae el usuario autenticado del request.
 * 
 * @param data - Propiedad específica a extraer (opcional)
 * @param ctx - Contexto de ejecución
 * @returns Usuario completo o propiedad específica
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    if (!user) {
      return undefined;
    }

    // Si se especifica una propiedad, retornar solo esa
    if (data) {
      return user[data];
    }

    return user;
  },
);
