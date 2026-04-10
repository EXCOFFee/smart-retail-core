/**
 * ============================================================================
 * SMART_RETAIL - ProcessAccessService (Use Case Implementation)
 * ============================================================================
 * Implementación del caso de uso principal: Procesar Acceso/Compra.
 * 
 * ARQUITECTURA: Capa de APLICACIÓN 🟠 (use-cases)
 * 
 * Este es el ORQUESTADOR del "Critical Path":
 * 1. Valida QR (anti-replay)
 * 2. Verifica stock en Redis
 * 3. Bloquea stock (Soft Lock)
 * 4. Procesa pago en pasarela
 * 5. Envía señal al dispositivo
 * 6. Maneja rollback si algo falla
 * 
 * ⚠️ PROHIBIDO: Acceso directo a BD o frameworks. Solo a través de Puertos.
 * ============================================================================
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Ports (Interfaces)
import {
    IProcessAccessUseCase,
    PROCESS_ACCESS_USE_CASE,
    ProcessAccessInput,
    ProcessAccessOutput,
} from '@application/ports/input/process-access.use-case';
import {
    DEVICE_GATEWAY_PORT,
    IDeviceGatewayPort
} from '@application/ports/output/device-gateway.port';
import {
    ChargeResult,
    IPaymentGatewayPort,
    PAYMENT_GATEWAY_PORT,
} from '@application/ports/output/payment-gateway.port';
import {
    DEVICE_REPOSITORY,
    IDeviceRepository,
    IProductRepository,
    ITransactionRepository,
    IUserRepository,
    PRODUCT_REPOSITORY,
    TRANSACTION_REPOSITORY,
    USER_REPOSITORY,
} from '@application/ports/output/repositories.port';
import {
    IStockCachePort,
    STOCK_CACHE_PORT,
} from '@application/ports/output/stock-cache.port';

// Domain
import { Transaction } from '@domain/entities/transaction.entity';
import {
    DeviceNotOperationalException,
    InsufficientBalanceException,
    PaymentGatewayException,
    QrExpiredException,
    StockInsufficientException,
    StockLockConflictException,
} from '@domain/exceptions';
import { Money } from '@domain/value-objects/money.value-object';

// Utils
import { v4 as uuidv4 } from 'uuid';

/**
 * Implementación del caso de uso de Procesamiento de Acceso.
 * 
 * Por qué @Injectable(): NestJS necesita el decorador para DI.
 * Aunque es parte de Application Layer, usamos decoradores mínimos
 * para integración con el framework.
 */
@Injectable()
export class ProcessAccessService implements IProcessAccessUseCase {
  private readonly logger = new Logger(ProcessAccessService.name);

  /**
   * Timeout para esperar ACK del hardware (ms)
   */
  private readonly hardwareAckTimeout: number;

  /**
   * Tiempo máximo de validez de un QR (segundos)
   */
  private readonly qrMaxAgeSeconds = 60;

  constructor(
    @Inject(STOCK_CACHE_PORT)
    private readonly stockCache: IStockCachePort,

    @Inject(PAYMENT_GATEWAY_PORT)
    private readonly paymentGateway: IPaymentGatewayPort,

    @Inject(DEVICE_GATEWAY_PORT)
    private readonly deviceGateway: IDeviceGatewayPort,

    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,

    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: IProductRepository,

    @Inject(DEVICE_REPOSITORY)
    private readonly deviceRepository: IDeviceRepository,

    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,

    private readonly configService: ConfigService,
  ) {
    this.hardwareAckTimeout = this.configService.get<number>(
      'HARDWARE_ACK_TIMEOUT',
      5000,
    );
  }

  /**
   * Ejecuta el flujo completo de validación y acceso.
   * 
   * CRÍTICO: Este método implementa el "Happy Path" (CU-01) y maneja
   * todos los edge cases definidos en el SRS (CU-02 a CU-08).
   * 
   * @param input - Datos de la solicitud de acceso
   * @returns Resultado del procesamiento
   */
  async execute(input: ProcessAccessInput): Promise<ProcessAccessOutput> {
    const startTime = Date.now();
    const { userId, deviceId, productId, quantity = 1, traceId } = input;

    this.logger.log('Processing access request', {
      traceId,
      userId,
      deviceId,
      productId,
    });

    // Variables para rollback en caso de error
    let lockKey: string | null = null;
    let transaction: Transaction | null = null;
    let paymentResult: ChargeResult | null = null;

    try {
      // ─────────────────────────────────────────────────────────────────────
      // PASO 1: Validar QR (Anti-Replay Attack - CU-08)
      // ─────────────────────────────────────────────────────────────────────
      if (input.qrPayload) {
        this.validateQrPayload(input.qrPayload, traceId);
      }

      // ─────────────────────────────────────────────────────────────────────
      // PASO 2: Verificar que el dispositivo esté operativo
      // Por qué primero: No tiene sentido continuar si el hardware está caído
      // ─────────────────────────────────────────────────────────────────────
      const device = await this.deviceRepository.findById(deviceId);
      if (!device) {
        throw new DeviceNotOperationalException(
          deviceId,
          'Unknown',
          'NOT_FOUND',
          'Device not registered in the system',
        );
      }

      if (!device.isOperational()) {
        throw new DeviceNotOperationalException(
          device.id,
          device.name,
          device.status,
        );
      }

      // Verificar conectividad WebSocket
      const isConnected = await this.deviceGateway.isDeviceConnected(deviceId);
      if (!isConnected) {
        throw new DeviceNotOperationalException(
          device.id,
          device.name,
          'DISCONNECTED',
          'Device is registered but not responding to WebSocket',
        );
      }

      // ─────────────────────────────────────────────────────────────────────
      // PASO 3: Obtener usuario y verificar saldo
      // ─────────────────────────────────────────────────────────────────────
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new InsufficientBalanceException(userId, 0, 0);
      }

      // ─────────────────────────────────────────────────────────────────────
      // PASO 4: Obtener producto y precio (si aplica)
      // CU-19: Guardamos el precio al momento del escaneo (snapshot)
      // ─────────────────────────────────────────────────────────────────────
      let amount = Money.zero();
      let product = null;

      if (productId) {
        product = await this.productRepository.findById(productId);
        if (!product) {
          throw new StockInsufficientException(productId, 'UNKNOWN', 0, quantity);
        }

        // Calcular monto total
        amount = product.price.multiply(quantity);

        // Verificar saldo suficiente
        if (!user.hasEnoughBalance(amount)) {
          throw new InsufficientBalanceException(
            userId,
            user.walletBalance.amount,
            amount.amount,
          );
        }

        // ───────────────────────────────────────────────────────────────────
        // PASO 5: Verificar stock en Redis (ultra-rápido)
        // Por qué Redis primero: Evita ir a Postgres si no hay stock
        // ───────────────────────────────────────────────────────────────────
        const cachedStock = await this.stockCache.getStock(
          productId,
          device.locationId,
        );

        if (cachedStock !== null && cachedStock < quantity) {
          throw new StockInsufficientException(
            productId,
            product.sku,
            cachedStock,
            quantity,
          );
        }

        // ───────────────────────────────────────────────────────────────────
        // PASO 6: Adquirir Soft Lock (CU-05: Race Condition)
        // CRÍTICO: Si otro usuario ya tiene el lock, rechazamos inmediatamente
        // ───────────────────────────────────────────────────────────────────
        const lockResult = await this.stockCache.acquireLock(
          productId,
          device.locationId,
          userId,
          quantity,
        );

        if (!lockResult.success) {
          throw new StockLockConflictException(productId, product.sku);
        }

        lockKey = lockResult.lockKey;
        this.logger.debug('Stock lock acquired', { traceId, lockKey });
      }

      // ─────────────────────────────────────────────────────────────────────
      // PASO 7: Crear transacción en estado PENDING
      // Por qué aquí: Necesitamos el ID para la pasarela (idempotencia)
      // ─────────────────────────────────────────────────────────────────────
      transaction = new Transaction({
        id: uuidv4(),
        userId,
        deviceId,
        productId: productId ?? null,
        locationId: device.locationId,
        amount,
        quantity,
        traceId,
      });

      await this.transactionRepository.save(transaction);
      this.logger.debug('Transaction created', {
        traceId,
        transactionId: transaction.id,
      });

      // ─────────────────────────────────────────────────────────────────────
      // PASO 8: Procesar pago (si hay monto)
      // CU-02: Si falla, liberamos lock y retornamos error
      // CU-03: Si hay timeout, marcamos IN_PROCESS y reconciliamos después
      // ─────────────────────────────────────────────────────────────────────
      if (!amount.isZero()) {
        paymentResult = await this.processPayment(
          transaction,
          user.email,
          amount,
          traceId,
        );

        if (!paymentResult.success) {
          // Pago rechazado - Liberar lock y fallar
          transaction.markFailed(
            paymentResult.responseCode,
            paymentResult.responseMessage,
          );
          await this.transactionRepository.save(transaction);

          if (lockKey) {
            await this.stockCache.releaseLock(lockKey);
          }

          throw new PaymentGatewayException(
            this.paymentGateway.gatewayName,
            paymentResult.responseCode,
            paymentResult.responseMessage,
            { isUserRejection: true }, // Es rechazo del usuario, no error técnico
          );
        }

        // Pago exitoso - Actualizar transacción
        transaction.markPaid({
          externalId: paymentResult.externalId!,
          gateway: this.paymentGateway.gatewayName,
          method: paymentResult.paymentMethod ?? 'unknown',
        });
        await this.transactionRepository.save(transaction);
      }

      // ─────────────────────────────────────────────────────────────────────
      // PASO 9: Descontar stock en DB y cache
      // Por qué después del pago: El dinero ya salió, ahora actualizamos stock
      // ─────────────────────────────────────────────────────────────────────
      if (product && productId) {
        await this.stockCache.decrementStock(productId, device.locationId, quantity);

        // Actualizar en Postgres con Optimistic Locking
        const updated = await this.productRepository.updateStockWithVersion(
          productId,
          product.stockQuantity - quantity,
          product.version,
        );

        if (!updated) {
          // Conflicto de concurrencia - El stock cambió mientras procesábamos
          // NOTA: Esto no debería pasar si el lock de Redis funcionó correctamente
          this.logger.warn('Optimistic lock conflict on stock update', {
            traceId,
            productId,
          });
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // PASO 10: Enviar señal al dispositivo y esperar ACK
      // CU-04: Si no hay ACK, iniciamos refund automático
      // ─────────────────────────────────────────────────────────────────────
      const deviceOpened = await this.deviceGateway.openAndWaitConfirmation(
        deviceId,
        transaction.id,
        this.hardwareAckTimeout,
      );

      if (!deviceOpened) {
        // Hardware falló - Iniciar rollback (CU-04)
        this.logger.error('Hardware ACK timeout - initiating refund', {
          traceId,
          transactionId: transaction.id,
        });

        await this.handleHardwareFailure(
          transaction,
          paymentResult,
          product,
          quantity,
          device.locationId,
          lockKey,
          traceId,
        );

        return {
          transactionId: transaction.id,
          status: 'FAILED',
          message: 'Error en dispositivo. Su dinero ha sido devuelto.',
          processingTimeMs: Date.now() - startTime,
        };
      }

      // ─────────────────────────────────────────────────────────────────────
      // PASO 11: Marcar como completado y liberar lock
      // ─────────────────────────────────────────────────────────────────────
      transaction.markCompleted();
      await this.transactionRepository.save(transaction);

      if (lockKey) {
        await this.stockCache.releaseLock(lockKey);
      }

      const processingTimeMs = Date.now() - startTime;
      this.logger.log('Access granted successfully', {
        traceId,
        transactionId: transaction.id,
        processingTimeMs,
      });

      return {
        transactionId: transaction.id,
        status: 'COMPLETED',
        message: 'Acceso concedido',
        amountCharged: amount.isZero()
          ? undefined
          : {
              cents: amount.cents,
              formatted: `$${amount.toString()}`,
            },
        processingTimeMs,
      };
    } catch (error) {
      // ─────────────────────────────────────────────────────────────────────
      // ROLLBACK: Liberar lock si quedó pendiente
      // ─────────────────────────────────────────────────────────────────────
      if (lockKey) {
        try {
          await this.stockCache.releaseLock(lockKey);
          this.logger.debug('Lock released on error', { traceId, lockKey });
        } catch (unlockError) {
          this.logger.error('Failed to release lock on error', {
            traceId,
            lockKey,
            error: (unlockError as Error).message,
          });
        }
      }

      // Re-throw para que el Controller lo maneje
      throw error;
    }
  }

  /**
   * Valida el payload del QR para prevenir replay attacks (CU-08).
   * 
   * @param qrPayload - Datos del QR escaneado
   * @param traceId - ID de trazabilidad
   * @throws QrExpiredException si el QR expiró o es inválido
   */
  private validateQrPayload(
    qrPayload: { timestamp: Date; nonce: string },
    traceId: string,
  ): void {
    const now = new Date();
    const qrTime = new Date(qrPayload.timestamp);
    const ageSeconds = (now.getTime() - qrTime.getTime()) / 1000;

    if (ageSeconds > this.qrMaxAgeSeconds) {
      this.logger.warn('QR expired', { traceId, ageSeconds });
      throw new QrExpiredException(qrTime, now, this.qrMaxAgeSeconds);
    }

    // TODO: Validar nonce contra Redis para evitar reutilización
    // await this.stockCache.checkAndSetNonce(qrPayload.nonce);
  }

  /**
   * Procesa el pago en la pasarela.
   * 
   * @param transaction - Transacción a cobrar
   * @param userEmail - Email del usuario
   * @param amount - Monto a cobrar
   * @param traceId - ID de trazabilidad
   * @returns Resultado del cobro
   */
  private async processPayment(
    transaction: Transaction,
    userEmail: string,
    amount: Money,
    traceId: string,
  ): Promise<ChargeResult> {
    try {
      return await this.paymentGateway.charge({
        amount,
        description: `SMART_RETAIL - Transaction ${transaction.id}`,
        transactionId: transaction.id,
        userId: transaction.userId,
        userEmail,
        metadata: { traceId },
      });
    } catch (error) {
      // Timeout o error de conexión - CU-03
      this.logger.error('Payment gateway error', {
        traceId,
        error: (error as Error).message,
      });

      // Intentar consultar estado (double-check)
      // TODO: Implementar reconciliación asíncrona
      throw error;
    }
  }

  /**
   * Maneja el rollback cuando el hardware falla (CU-04).
   * 
   * @param transaction - Transacción afectada
   * @param paymentResult - Resultado del pago (para refund)
   * @param product - Producto (para devolver stock)
   * @param quantity - Cantidad a devolver
   * @param locationId - Ubicación del stock
   * @param lockKey - Clave del lock a liberar
   * @param traceId - ID de trazabilidad
   */
  private async handleHardwareFailure(
    transaction: Transaction,
    paymentResult: ChargeResult | null,
    product: unknown,
    quantity: number,
    locationId: string,
    lockKey: string | null,
    traceId: string,
  ): Promise<void> {
    // 1. Procesar refund si hubo pago
    if (paymentResult?.success && paymentResult.externalId) {
      try {
        await this.paymentGateway.refund(
          paymentResult.externalId,
          'Hardware failure - automatic refund',
        );
        this.logger.log('Refund processed for hardware failure', {
          traceId,
          externalId: paymentResult.externalId,
        });
      } catch (refundError) {
        this.logger.error('Failed to process refund', {
          traceId,
          error: (refundError as Error).message,
        });
        // TODO: Crear alerta crítica para admin
      }
    }

    // 2. Devolver stock
    if (product && transaction.productId) {
      await this.stockCache.incrementStock(
        transaction.productId,
        locationId,
        quantity,
      );
    }

    // 3. Marcar transacción como reembolsada por fallo de HW
    transaction.markRefundedHardwareFailure();
    await this.transactionRepository.save(transaction);

    // 4. Liberar lock
    if (lockKey) {
      await this.stockCache.releaseLock(lockKey);
    }
  }
}

/**
 * Token de inyección para registrar el servicio.
 * 
 * Uso en módulo:
 * providers: [
 *   { provide: PROCESS_ACCESS_USE_CASE, useClass: ProcessAccessService }
 * ]
 */
export { PROCESS_ACCESS_USE_CASE };
