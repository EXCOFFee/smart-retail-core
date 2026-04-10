/**
 * ============================================================================
 * SMART_RETAIL - Domain Exception Filter (Global)
 * ============================================================================
 * Filtro de excepciones que mapea DomainException a respuestas HTTP.
 * 
 * ARQUITECTURA: Capa de INTERFACES 🟢 (http/filters)
 * 
 * Este filtro intercepta todas las excepciones y:
 * 1. Si es DomainException -> Mapea a HTTP con código apropiado
 * 2. Si es HttpException -> Deja pasar (manejo estándar de NestJS)
 * 3. Si es desconocida -> Retorna 500 con mensaje genérico
 * 
 * ⚠️ CRÍTICO: Nunca exponer detalles internos en producción.
 * ============================================================================
 */

import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import {
    DeviceNotOperationalException,
    DomainException,
    InsufficientBalanceException,
    PaymentGatewayException,
    QrExpiredException,
    SecurityBreachException,
    StockInsufficientException,
    StockLockConflictException,
} from '@domain/exceptions';

/**
 * Estructura de respuesta de error estándar.
 */
interface ErrorResponse {
  statusCode: number;
  message: string;
  errorCode: string;
  details?: Record<string, unknown>;
  traceId: string;
  timestamp: string;
  path: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  private readonly isDevelopment: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isDevelopment =
      this.configService.get<string>('NODE_ENV', 'development') === 'development';
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Obtener o generar trace ID
    const traceId =
      (request.headers['x-trace-id'] as string) ??
      (request.headers['x-request-id'] as string) ??
      uuidv4();

    // Procesar la excepción
    const errorResponse = this.buildErrorResponse(exception, traceId, request.url);

    // Log según severidad
    if (errorResponse.statusCode >= 500) {
      this.logger.error('Server error', {
        traceId,
        errorCode: errorResponse.errorCode,
        message: errorResponse.message,
        stack: exception instanceof Error ? exception.stack : undefined,
        path: request.url,
        method: request.method,
      });
    } else {
      this.logger.warn('Client error', {
        traceId,
        errorCode: errorResponse.errorCode,
        message: errorResponse.message,
        path: request.url,
        method: request.method,
      });
    }

    // Enviar respuesta
    response.status(errorResponse.statusCode).json(errorResponse);
  }

  /**
   * Construye la respuesta de error según el tipo de excepción.
   */
  private buildErrorResponse(
    exception: unknown,
    traceId: string,
    path: string,
  ): ErrorResponse {
    const timestamp = new Date().toISOString();

    // ─────────────────────────────────────────────────────────────────────
    // 1. Excepciones de Dominio (mapeo explícito)
    // ─────────────────────────────────────────────────────────────────────
    if (exception instanceof DomainException) {
      return this.handleDomainException(exception, traceId, path, timestamp);
    }

    // ─────────────────────────────────────────────────────────────────────
    // 2. HttpException de NestJS (pass-through)
    // ─────────────────────────────────────────────────────────────────────
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      let message: string;
      let details: Record<string, unknown> | undefined;

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp.message as string) ?? exception.message;
        
        // Para errores de validación, incluir detalles
        if (Array.isArray(resp.message)) {
          message = 'Error de validación';
          details = { validationErrors: resp.message };
        }
      } else {
        message = exception.message;
      }

      return {
        statusCode: status,
        message,
        errorCode: this.httpStatusToErrorCode(status),
        details,
        traceId,
        timestamp,
        path,
      };
    }

    // ─────────────────────────────────────────────────────────────────────
    // 3. Error genérico / desconocido
    // ─────────────────────────────────────────────────────────────────────
    const message = this.isDevelopment
      ? exception instanceof Error
        ? exception.message
        : 'Unknown error'
      : 'Error interno del servidor';

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message,
      errorCode: 'INTERNAL_SERVER_ERROR',
      details: this.isDevelopment && exception instanceof Error
        ? { stack: exception.stack?.split('\n').slice(0, 5) }
        : undefined,
      traceId,
      timestamp,
      path,
    };
  }

  /**
   * Maneja excepciones de dominio mapeando a códigos HTTP específicos.
   */
  private handleDomainException(
    exception: DomainException,
    traceId: string,
    path: string,
    timestamp: string,
  ): ErrorResponse {
    let statusCode: number;
    let details: Record<string, unknown> | undefined;

    // Mapeo de excepciones de dominio a HTTP
    if (exception instanceof InsufficientBalanceException) {
      statusCode = HttpStatus.PAYMENT_REQUIRED; // 402
      details = {
        userId: exception.userId,
        currentBalance: exception.currentBalance,
        requiredAmount: exception.requiredAmount,
      };
    } else if (exception instanceof StockInsufficientException) {
      statusCode = HttpStatus.CONFLICT; // 409
      details = {
        productId: exception.productId,
        productSku: exception.productSku,
        availableStock: exception.availableStock,
        requestedQuantity: exception.requestedQuantity,
      };
    } else if (exception instanceof StockLockConflictException) {
      statusCode = HttpStatus.CONFLICT; // 409
      details = {
        productId: exception.productId,
        productSku: exception.productSku,
      };
    } else if (exception instanceof DeviceNotOperationalException) {
      statusCode = HttpStatus.SERVICE_UNAVAILABLE; // 503
      details = {
        deviceId: exception.deviceId,
        deviceName: exception.deviceName,
        deviceStatus: exception.deviceStatus,
      };
    } else if (exception instanceof PaymentGatewayException) {
      // Diferenciar entre rechazo del usuario y error técnico
      statusCode = exception.isUserDeclined
        ? HttpStatus.PAYMENT_REQUIRED // 402
        : HttpStatus.BAD_GATEWAY; // 502
      details = {
        gateway: exception.gatewayName,
        responseCode: exception.responseCode,
        isRetryable: !exception.isUserDeclined,
      };
    } else if (exception instanceof QrExpiredException) {
      statusCode = HttpStatus.FORBIDDEN; // 403
      details = {
        generatedAt: exception.generatedAt.toISOString(),
        validatedAt: exception.validatedAt.toISOString(),
        maxAgeSeconds: exception.maxAgeSeconds,
      };
    } else if (exception instanceof SecurityBreachException) {
      statusCode = HttpStatus.FORBIDDEN; // 403
      // No incluir detalles sensibles en security breaches
      details = undefined;
    } else {
      // DomainException genérica
      statusCode = HttpStatus.UNPROCESSABLE_ENTITY; // 422
    }

    return {
      statusCode,
      message: exception.message,
      errorCode: exception.code,
      details,
      traceId,
      timestamp,
      path,
    };
  }

  /**
   * Convierte código HTTP a código de error interno.
   */
  private httpStatusToErrorCode(status: number): string {
    const mapping: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
    };
    return mapping[status] ?? `HTTP_${status}`;
  }
}
