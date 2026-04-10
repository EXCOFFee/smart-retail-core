/**
 * ============================================================================
 * SMART_RETAIL - Roles Decorator
 * ============================================================================
 * Decorador para especificar roles requeridos en una ruta.
 * 
 * ARQUITECTURA: Capa de INFRAESTRUCTURA 🔵 (auth/decorators)
 * 
 * USO:
 * @Roles('admin', 'operator')
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * async adminEndpoint() { ... }
 * ============================================================================
 */

import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Especifica los roles requeridos para acceder a una ruta.
 * 
 * El usuario debe tener AL MENOS UNO de los roles especificados.
 * 
 * @param roles - Lista de roles permitidos
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
