/**
 * ============================================================================
 * SMART_RETAIL - JWT Auth Guard
 * ============================================================================
 * Guard de autenticación JWT para proteger rutas.
 * 
 * ARQUITECTURA: Capa de INFRAESTRUCTURA 🔵 (auth/guards)
 * 
 * USO:
 * @UseGuards(JwtAuthGuard)
 * async protectedEndpoint(@CurrentUser() user: AuthenticatedUser) { ... }
 * ============================================================================
 */

import {
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  /**
   * Determina si la ruta puede ser activada.
   * 
   * Primero verifica si la ruta está marcada como pública (@Public()).
   * Si es pública, permite acceso sin autenticación.
   * Si no es pública, delega a Passport para validar el JWT.
   */
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Verificar si la ruta está marcada como pública
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Delegar a Passport para validación JWT
    return super.canActivate(context);
  }

  /**
   * Maneja el resultado de la autenticación.
   * 
   * Si la autenticación falla, lanza UnauthorizedException con mensaje claro.
   * 
   * Por qué tipado estricto: Regla 1 de agent.md prohíbe `any`.
   * Usamos tipos específicos para los parámetros de Passport.
   * 
   * @param err - Error de autenticación (si hubo)
   * @param user - Usuario autenticado (si éxito)
   * @param info - Información adicional de Passport (JWT errors)
   */
  handleRequest<TUser = unknown>(
    err: Error | null,
    user: TUser | false,
    info: { name?: string; message?: string } | undefined,
  ): TUser {
    if (err || !user) {
      // Mensajes específicos según el tipo de error
      let message = 'Authentication required';

      if (info?.name === 'TokenExpiredError') {
        message = 'Token has expired';
      } else if (info?.name === 'JsonWebTokenError') {
        message = 'Invalid token';
      } else if (info?.message) {
        message = info.message;
      }

      throw new UnauthorizedException(message);
    }

    return user;
  }
}
