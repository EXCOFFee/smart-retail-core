/**
 * ============================================================================
 * SMART_RETAIL - Transaction Controller
 * ============================================================================
 * Controlador HTTP para endpoints de consulta de transacciones.
 * 
 * ARQUITECTURA: Capa de INTERFACES 🟢 (http/controllers)
 * 
 * NOTA IMPORTANTE: Las transacciones se CREAN a través del flujo de Access
 * (CU-01: Compra de acceso con QR). Este controlador es solo para CONSULTA.
 * 
 * Endpoints:
 * - GET /transactions - Listar transacciones (con filtros)
 * - GET /transactions/:id - Obtener transacción por ID
 * - GET /transactions/my - Mis transacciones (usuario actual)
 * - GET /transactions/summary - Resumen diario (Cierre de Caja - CU-14)
 * 
 * Seguridad:
 * - Todos los endpoints requieren autenticación JWT
 * - Los usuarios normales solo pueden ver sus propias transacciones
 * - Admins y operators pueden ver todas las transacciones de su ubicación
 * ============================================================================
 */

import {
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Inject,
    Logger,
    NotFoundException,
    Param,
    Query,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiTags,
} from '@nestjs/swagger';

import {
    ITransactionRepository,
    TRANSACTION_REPOSITORY,
} from '@application/ports/output/repositories.port';
import { Transaction } from '@domain/entities/transaction.entity';
import { CurrentUser } from '@infrastructure/auth/decorators/current-user.decorator';
import { Roles } from '@infrastructure/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@infrastructure/auth/guards/roles.guard';
import { ErrorResponseDto } from '@interfaces/http/dto/access-response.dto';
import {
    DailySummaryQueryDto,
    DailySummaryResponseDto,
    TransactionListResponseDto,
    TransactionQueryDto,
    TransactionResponseDto,
} from '@interfaces/http/dto/transaction.dto';

/**
 * Interfaz para el usuario del token JWT
 */
interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  locationId?: string;
}

@ApiTags('Transactions')
@ApiBearerAuth()
@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransactionController {
  private readonly logger = new Logger(TransactionController.name);

  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // MY TRANSACTIONS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Obtiene las transacciones del usuario actual.
   * 
   * @param currentUser - Usuario autenticado
   * @param query - Filtros de búsqueda
   * @returns Lista de transacciones del usuario
   */
  @Get('my')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mis transacciones',
    description: 'Obtiene las transacciones del usuario autenticado',
  })
  @ApiOkResponse({
    description: 'Lista de transacciones',
    type: TransactionListResponseDto,
  })
  async getMyTransactions(
    @CurrentUser() currentUser: JwtPayload,
    @Query() query: TransactionQueryDto,
  ): Promise<TransactionListResponseDto> {
    this.logger.log(`Getting transactions for user: ${currentUser.sub}`);

    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const transactions = await this.transactionRepository.findMany({
      userId: currentUser.sub,
      status: query.status,
      fromDate: query.fromDate,
      toDate: query.toDate,
      limit,
      offset,
    });

    const total = await this.transactionRepository.count({
      userId: currentUser.sub,
      status: query.status,
      fromDate: query.fromDate,
      toDate: query.toDate,
    });

    return {
      transactions: transactions.map((t) => this.toResponseDto(t)),
      total,
      limit,
      offset,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIST TRANSACTIONS (ADMIN/OPERATOR)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Lista transacciones con filtros (solo admins y operators).
   * 
   * @param query - Filtros de búsqueda
   * @returns Lista de transacciones
   */
  @Get()
  @Roles('admin', 'operator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar transacciones',
    description: 'Obtiene lista de transacciones con filtros (solo admins/operators)',
  })
  @ApiOkResponse({
    description: 'Lista de transacciones',
    type: TransactionListResponseDto,
  })
  async listTransactions(
    @Query() query: TransactionQueryDto,
  ): Promise<TransactionListResponseDto> {
    this.logger.log('Listing transactions', { query });

    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const transactions = await this.transactionRepository.findMany({
      userId: query.userId,
      deviceId: query.deviceId,
      locationId: query.locationId,
      status: query.status,
      fromDate: query.fromDate,
      toDate: query.toDate,
      limit,
      offset,
    });

    const total = await this.transactionRepository.count({
      userId: query.userId,
      deviceId: query.deviceId,
      locationId: query.locationId,
      status: query.status,
      fromDate: query.fromDate,
      toDate: query.toDate,
    });

    return {
      transactions: transactions.map((t) => this.toResponseDto(t)),
      total,
      limit,
      offset,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET TRANSACTION BY ID
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Obtiene una transacción por su ID.
   * Los usuarios normales solo pueden ver sus propias transacciones.
   * 
   * @param id - UUID de la transacción
   * @param currentUser - Usuario autenticado
   * @returns Datos de la transacción
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener transacción',
    description: 'Obtiene una transacción por su ID. Los usuarios normales solo pueden ver sus propias transacciones.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID de la transacción',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiOkResponse({
    description: 'Datos de la transacción',
    type: TransactionResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Transacción no encontrada',
    type: ErrorResponseDto,
  })
  async getTransaction(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<TransactionResponseDto> {
    const transaction = await this.transactionRepository.findById(id);
    
    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    // Verificar permisos: usuarios normales solo ven sus transacciones
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'operator';
    if (!isAdmin && transaction.userId !== currentUser.sub) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    return this.toResponseDto(transaction);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DAILY SUMMARY (CU-14 - CIERRE DE CAJA)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Obtiene el resumen diario de transacciones para Cierre de Caja (CU-14).
   * 
   * @param query - Ubicación y fecha
   * @returns Resumen del día
   */
  @Get('summary/daily')
  @Roles('admin', 'operator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resumen diario',
    description: 'Obtiene resumen de transacciones para Cierre de Caja (CU-14)',
  })
  @ApiOkResponse({
    description: 'Resumen del día',
    type: DailySummaryResponseDto,
  })
  async getDailySummary(
    @Query() query: DailySummaryQueryDto,
  ): Promise<DailySummaryResponseDto> {
    this.logger.log('Getting daily summary', { 
      locationId: query.locationId, 
      date: query.date,
    });

    const summary = await this.transactionRepository.getDailySummary(
      query.locationId,
      query.date,
    );

    // Convertir Record<TransactionStatus, number> a Record<string, number>
    const byStatusFormatted: Record<string, number> = {};
    for (const [status, count] of Object.entries(summary.byStatus)) {
      byStatusFormatted[status] = count;
    }

    return {
      locationId: query.locationId,
      date: query.date,
      totalTransactions: summary.totalTransactions,
      totalAmountCents: summary.totalAmountCents,
      totalAmountFormatted: `$${(summary.totalAmountCents / 100).toFixed(2)}`,
      byStatus: byStatusFormatted,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Convierte entidad de dominio a DTO de respuesta.
   */
  private toResponseDto(transaction: Transaction): TransactionResponseDto {
    return {
      id: transaction.id,
      userId: transaction.userId,
      deviceId: transaction.deviceId,
      productId: transaction.productId,
      locationId: transaction.locationId,
      amountCents: transaction.amount.cents,
      amountFormatted: `$${transaction.amount.toString()}`,
      quantity: transaction.quantity,
      status: transaction.status,
      paymentInfo: {
        externalId: transaction.paymentInfo.externalId,
        gateway: transaction.paymentInfo.gateway,
        method: transaction.paymentInfo.method,
        responseCode: transaction.paymentInfo.responseCode,
      },
      traceId: transaction.traceId,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      completedAt: transaction.completedAt,
    };
  }
}
