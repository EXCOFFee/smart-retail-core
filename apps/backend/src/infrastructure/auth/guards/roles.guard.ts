/**
 * ============================================================================
 * SMART_RETAIL - Roles Guard
 * ============================================================================
 * Guard de autorización basado en roles.
 * 
 * ARQUITECTURA: Capa de INFRAESTRUCTURA 🔵 (auth/guards)
 * 
 * USO:
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('admin', 'operator')
 * async adminEndpoint() { ... }
 * ============================================================================
 */

import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../strategies/jwt.strategy';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /**
   * Verifica si el usuario tiene los roles requeridos.
   * 
   * @param context - Contexto de ejecución
   * @returns true si el usuario tiene al menos uno de los roles requeridos
   * @throws ForbiddenException si no tiene permisos
   */
  canActivate(context: ExecutionContext): boolean {
    // Obtener roles requeridos del decorador @Roles()
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si no hay roles requeridos, permitir acceso
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Obtener usuario del request (adjuntado por JwtAuthGuard)
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Verificar si el usuario tiene alguno de los roles requeridos
    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Requires one of the following roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
