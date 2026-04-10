/**
 * ============================================================================
 * SMART_RETAIL - Public Route Decorator
 * ============================================================================
 * Decorador para marcar rutas como públicas (sin autenticación requerida).
 * 
 * ARQUITECTURA: Capa de INFRAESTRUCTURA 🔵 (auth/decorators)
 * 
 * USO:
 * @Public()
 * @Get('health')
 * async healthCheck() { ... }
 * ============================================================================
 */

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca una ruta como pública (no requiere autenticación JWT).
 * 
 * Por defecto, todas las rutas requieren autenticación.
 * Este decorador es la excepción explícita.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
