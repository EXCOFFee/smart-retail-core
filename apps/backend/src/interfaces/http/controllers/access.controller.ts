/**
 * ============================================================================
 * SMART_RETAIL - Access Controller
 * ============================================================================
 * Controlador HTTP para endpoints de acceso/compra.
 * 
 * ARQUITECTURA: Capa de INTERFACES 🟢 (http/controllers)
 * 
 * Este controlador es el PUNTO DE ENTRADA del Critical Path.
 * Su única responsabilidad es:
 * 1. Validar request (via ValidationPipe)
 * 2. Transformar DTO a Input del Use Case
 * 3. Invocar Use Case
 * 4. Transformar Output a Response DTO
 * 
 * seguridad:
 * - Rate limiting CRITICAL (10 req/min, bloqueo 5 min)
 * - JWT Guard para autenticación
 * 
 * ⚠️ PROHIBIDO: Lógica de negocio aquí. Solo transformación y delegación.
 * ============================================================================
 */

import {
    Body,
    Controller,
    Headers,
    HttpCode,
    HttpStatus,
    Inject,
    Logger,
    Post,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiHeader,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { v4 as uuidv4 } from 'uuid';

import {
    IProcessAccessUseCase,
    PROCESS_ACCESS_USE_CASE,
    ProcessAccessInput,
} from '@application/ports/input/process-access.use-case';
import {
    RATE_LIMIT_CONFIGS,
    RateLimit,
    RateLimitGuard,
} from '@infrastructure/guards/rate-limit.guard';
import { AccessRequestDto } from '@interfaces/http/dto/access-request.dto';
import {
    AccessResponseDto,
    ErrorResponseDto,
} from '@interfaces/http/dto/access-response.dto';

@ApiTags('Access')
@ApiBearerAuth()
@Controller('access')
@UseGuards(RateLimitGuard)
export class AccessController {
  private readonly logger = new Logger(AccessController.name);

  constructor(
    @Inject(PROCESS_ACCESS_USE_CASE)
    private readonly processAccessUseCase: IProcessAccessUseCase,
  ) {}

  /**
   * Procesa una solicitud de acceso/compra.
   * 
   * Este endpoint recibe el escaneo del QR desde la app móvil
   * y ejecuta el flujo completo de validación.
   * 
   * @param dto - Datos de la solicitud de acceso
   * @param requestTraceId - Trace ID opcional del header
   * @returns Resultado del procesamiento
   */
  @Post('request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Solicitar acceso/compra',
    description: `
Ejecuta el flujo de validación del "Critical Path" (CU-01):
1. Valida QR (anti-replay)
2. Verifica stock disponible
3. Bloquea stock temporalmente
4. Procesa pago en pasarela
5. Envía señal al dispositivo IoT
6. Confirma transacción

**Latencia objetivo: < 200ms**
    `,
  })
  @ApiHeader({
    name: 'X-Trace-Id',
    description: 'ID de trazabilidad para correlación de logs',
    required: false,
    example: 'trace-12345-abcde',
  })
  @ApiResponse({
    status: 200,
    description: 'Acceso procesado exitosamente',
    type: AccessResponseDto,
  })
  @ApiResponse({
    status: 402,
    description: 'Pago rechazado o saldo insuficiente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'QR expirado o inválido',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Stock insuficiente o conflicto de bloqueo',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit excedido',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 503,
    description: 'Dispositivo no disponible',
    type: ErrorResponseDto,
  })
  @RateLimit(RATE_LIMIT_CONFIGS.CRITICAL)
  async requestAccess(
    @Body() dto: AccessRequestDto,
    @Headers('X-Trace-Id') requestTraceId?: string,
  ): Promise<AccessResponseDto> {
    // Generar trace ID si no viene en el header
    const traceId = requestTraceId ?? uuidv4();

    this.logger.log('Access request received', {
      traceId,
      userId: dto.userId,
      deviceId: dto.deviceId,
      productId: dto.productId,
    });

    // Transformar DTO a Input del Use Case
    const input: ProcessAccessInput = {
      userId: dto.userId,
      deviceId: dto.deviceId,
      productId: dto.productId,
      quantity: dto.quantity ?? 1,
      traceId,
      qrPayload: dto.qrPayload
        ? {
            timestamp: new Date(dto.qrPayload.timestamp),
            nonce: dto.qrPayload.nonce,
          }
        : undefined,
    };

    // Ejecutar Use Case
    const output = await this.processAccessUseCase.execute(input);

    // Transformar Output a Response DTO
    const response: AccessResponseDto = {
      transactionId: output.transactionId,
      status: output.status,
      message: output.message,
      amountCharged: output.amountCharged,
      processingTimeMs: output.processingTimeMs,
    };

    this.logger.log('Access request completed', {
      traceId,
      transactionId: output.transactionId,
      status: output.status,
      processingTimeMs: output.processingTimeMs,
    });

    return response;
  }
}
