/**
 * ============================================================================
 * SMART_RETAIL - Rate Limiting Guard
 * ============================================================================
 * Guard de rate limiting para proteger endpoints críticos contra abuso.
 * 
 * IMPLEMENTA: CU-16 (Auditoría de Eventos Sospechosos)
 * 
 * ESTRATEGIA:
 * - Token bucket por IP/Usuario
 * - Límites diferentes por endpoint
 * - Bloqueo temporal ante abuso
 * ============================================================================
 */

import {
    CanActivate,
    ExecutionContext,
    HttpException,
    HttpStatus,
    Injectable,
    Logger,
    SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Número máximo de requests permitidos */
  limit: number;
  /** Ventana de tiempo en segundos */
  windowSeconds: number;
  /** Mensaje de error personalizado */
  message?: string;
  /** Si bloquear temporalmente después de exceder el límite */
  blockOnExceed?: boolean;
  /** Tiempo de bloqueo en segundos */
  blockDurationSeconds?: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
  blocked: boolean;
  blockedUntil: number;
}

// Configuraciones predefinidas para diferentes niveles de criticidad
export const RATE_LIMIT_CONFIGS = {
  /** Endpoints críticos (pago, acceso) */
  CRITICAL: {
    limit: 10,
    windowSeconds: 60,
    blockOnExceed: true,
    blockDurationSeconds: 300, // 5 minutos
    message: 'Demasiados intentos. Por favor espere antes de reintentar.',
  },
  /** Endpoints normales de API */
  STANDARD: {
    limit: 100,
    windowSeconds: 60,
    blockOnExceed: false,
    message: 'Rate limit excedido. Intente de nuevo más tarde.',
  },
  /** Endpoints de autenticación */
  AUTH: {
    limit: 5,
    windowSeconds: 60,
    blockOnExceed: true,
    blockDurationSeconds: 900, // 15 minutos
    message: 'Demasiados intentos de autenticación. Cuenta bloqueada temporalmente.',
  },
  /** Endpoints de lectura (más permisivos) */
  READ: {
    limit: 200,
    windowSeconds: 60,
    blockOnExceed: false,
    message: 'Rate limit de lectura excedido.',
  },
} as const;

export const RATE_LIMIT_KEY = 'rate_limit';

// ─────────────────────────────────────────────────────────────────────────────
// DECORADOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decorador para aplicar rate limiting a endpoints.
 * 
 * @example
 * ```typescript
 * @RateLimit(RATE_LIMIT_CONFIGS.CRITICAL)
 * @Post('access/process')
 * async processAccess() { ... }
 * ```
 */
export const RateLimit = (config: RateLimitConfig) =>
  SetMetadata(RATE_LIMIT_KEY, config);

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY STORE (MVP)
// Por qué: Para MVP usamos memoria. En producción, usar Redis para clusters.
// ─────────────────────────────────────────────────────────────────────────────

export class RateLimitStore {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Limpiar entradas expiradas cada minuto
    // .unref() permite que Node.js termine aunque el interval esté activo
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    this.cleanupInterval.unref();
  }

  get(key: string): RateLimitEntry | undefined {
    return this.store.get(key);
  }

  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      // Eliminar si expiró y no está bloqueado
      if (entry.resetAt < now && !entry.blocked) {
        this.store.delete(key);
      }
      // Eliminar si el bloqueo expiró
      if (entry.blocked && entry.blockedUntil < now) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

// Singleton del store
export const rateLimitStore = new RateLimitStore();

// ─────────────────────────────────────────────────────────────────────────────
// GUARD
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const config = this.reflector.get<RateLimitConfig>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );

    // Si no hay config, permitir (no hay rate limit)
    if (!config) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const key = this.getKey(request);
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    // Verificar si está bloqueado
    if (entry?.blocked) {
      if (entry.blockedUntil > now) {
        const remainingSeconds = Math.ceil((entry.blockedUntil - now) / 1000);
        this.logger.warn(
          `Blocked request from ${key}, remaining: ${remainingSeconds}s`,
        );
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: config.message ?? 'Rate limit excedido',
            retryAfter: remainingSeconds,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      } else {
        // Bloqueo expiró, resetear
        entry = undefined;
        rateLimitStore.delete(key);
      }
    }

    // Si no hay entrada o expiró, crear nueva
    if (!entry || entry.resetAt < now) {
      entry = {
        count: 1,
        resetAt: now + config.windowSeconds * 1000,
        blocked: false,
        blockedUntil: 0,
      };
      rateLimitStore.set(key, entry);
      return true;
    }

    // Incrementar contador
    entry.count++;

    // Verificar si excedió el límite
    if (entry.count > config.limit) {
      // Aplicar bloqueo si está configurado
      if (config.blockOnExceed && config.blockDurationSeconds) {
        entry.blocked = true;
        entry.blockedUntil = now + config.blockDurationSeconds * 1000;
        
        this.logger.warn(
          `Rate limit exceeded and blocked: ${key}, blocked for ${config.blockDurationSeconds}s`,
        );
      }

      const remainingSeconds = config.blockOnExceed && config.blockDurationSeconds
        ? config.blockDurationSeconds
        : Math.ceil((entry.resetAt - now) / 1000);

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: config.message ?? 'Rate limit excedido',
          retryAfter: remainingSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  /**
   * Genera una clave única para el rate limit.
   * Combina IP + User ID (si autenticado) + Endpoint.
   */
  private getKey(request: Request): string {
    const ip = this.getClientIp(request);
    const userId = (request as Request & { user?: { id: string } }).user?.id ?? 'anonymous';
    const endpoint = `${request.method}:${request.path}`;
    
    return `${ip}:${userId}:${endpoint}`;
  }

  /**
   * Obtiene la IP real del cliente (considerando proxies).
   */
  private getClientIp(request: Request): string {
    // X-Forwarded-For puede tener múltiples IPs si hay varios proxies
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor.split(',')[0];
      return ips?.trim() ?? request.ip ?? 'unknown';
    }
    
    return request.ip ?? request.socket.remoteAddress ?? 'unknown';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERCEPTOR PARA HEADERS
// ─────────────────────────────────────────────────────────────────────────────

import {
    CallHandler,
    Injectable as InterceptorInjectable,
    NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@InterceptorInjectable()
export class RateLimitHeadersInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      tap(() => {
        const config = this.reflector.get<RateLimitConfig>(
          RATE_LIMIT_KEY,
          context.getHandler(),
        );

        if (!config) return;

        const response = context.switchToHttp().getResponse();
        const request = context.switchToHttp().getRequest<Request>();
        
        const ip = request.ip ?? 'unknown';
        const userId = (request as Request & { user?: { id: string } }).user?.id ?? 'anonymous';
        const endpoint = `${request.method}:${request.path}`;
        const key = `${ip}:${userId}:${endpoint}`;
        
        const entry = rateLimitStore.get(key);
        
        if (entry) {
          const remaining = Math.max(0, config.limit - entry.count);
          const resetSeconds = Math.ceil((entry.resetAt - Date.now()) / 1000);
          
          response.setHeader('X-RateLimit-Limit', config.limit);
          response.setHeader('X-RateLimit-Remaining', remaining);
          response.setHeader('X-RateLimit-Reset', resetSeconds);
        }
      }),
    );
  }
}
