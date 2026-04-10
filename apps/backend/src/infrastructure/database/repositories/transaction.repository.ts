/**
 * ============================================================================
 * SMART_RETAIL - Transaction Repository (TypeORM Implementation)
 * ============================================================================
 * Implementación del puerto ITransactionRepository usando TypeORM.
 * 
 * ARQUITECTURA: Capa de INFRAESTRUCTURA 🔵 (adapters/database)
 * 
 * Este repositorio es CRÍTICO para auditoría y reportes.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';

import { ITransactionRepository } from '@application/ports/output/repositories.port';
import { Transaction, TransactionStatus } from '@domain/entities/transaction.entity';
import { Money } from '@domain/value-objects/money.value-object';
import { PaymentGatewayOrm, TransactionOrmEntity, TransactionStatusOrm } from '@infrastructure/database/entities/transaction.orm-entity';

@Injectable()
export class TransactionRepository implements ITransactionRepository {
  private readonly logger = new Logger(TransactionRepository.name);

  constructor(
    @InjectRepository(TransactionOrmEntity)
    private readonly transactionRepo: Repository<TransactionOrmEntity>,
  ) {}

  /**
   * Busca una transacción por ID y la mapea a entidad de dominio.
   * 
   * @param id - UUID de la transacción
   * @returns Transacción de dominio o null si no existe
   */
  async findById(id: string): Promise<Transaction | null> {
    const orm = await this.transactionRepo.findOne({ where: { id } });
    if (!orm) return null;
    return this.toDomain(orm);
  }

  /**
   * Busca una transacción por traceId (para idempotencia).
   * 
   * @param traceId - ID de trazabilidad único
   * @returns Transacción de dominio o null si no existe
   */
  async findByTraceId(traceId: string): Promise<Transaction | null> {
    const orm = await this.transactionRepo.findOne({ where: { traceId } });
    if (!orm) return null;
    return this.toDomain(orm);
  }

  /**
   * Busca transacciones de un usuario.
   * 
   * @param userId - ID del usuario
   * @param limit - Número máximo de resultados
   * @returns Lista de transacciones ordenadas por fecha (más recientes primero)
   */
  async findByUser(userId: string, limit = 50): Promise<Transaction[]> {
    const orms = await this.transactionRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return orms.map((orm: TransactionOrmEntity) => this.toDomain(orm));
  }

  /**
   * Busca transacciones en una ubicación durante un rango de fechas.
   * 
   * @param locationId - ID de la ubicación
   * @param startDate - Fecha de inicio
   * @param endDate - Fecha de fin
   * @returns Lista de transacciones en el rango
   */
  async findByLocationAndDateRange(
    locationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Transaction[]> {
    const orms = await this.transactionRepo.find({
      where: {
        locationId,
        createdAt: Between(startDate, endDate),
      },
      order: { createdAt: 'DESC' },
    });
    return orms.map((orm: TransactionOrmEntity) => this.toDomain(orm));
  }

  /**
   * Busca transacciones pendientes antiguas (para reconciliación).
   * 
   * @param olderThanMinutes - Minutos de antigüedad
   * @returns Lista de transacciones PENDING más viejas que el umbral
   */
  async findStalePending(olderThanMinutes = 5): Promise<Transaction[]> {
    const cutoffDate = new Date();
    cutoffDate.setMinutes(cutoffDate.getMinutes() - olderThanMinutes);

    const orms = await this.transactionRepo
      .createQueryBuilder('t')
      .where('t.status = :status', { status: TransactionStatusOrm.PENDING })
      .andWhere('t.createdAt < :cutoff', { cutoff: cutoffDate })
      .orderBy('t.createdAt', 'ASC')
      .getMany();

    return orms.map((orm: TransactionOrmEntity) => this.toDomain(orm));
  }

  /**
   * Busca una transacción por ID externo de pasarela.
   */
  async findByExternalPaymentId(externalId: string): Promise<Transaction | null> {
    const orm = await this.transactionRepo.findOne({
      where: { externalPaymentId: externalId },
    });
    if (!orm) return null;
    return this.toDomain(orm);
  }

  /**
   * Busca transacciones por criterios.
   */
  async findMany(criteria: {
    userId?: string;
    deviceId?: string;
    locationId?: string;
    status?: TransactionStatus;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<Transaction[]> {
    const qb = this.transactionRepo.createQueryBuilder('t');

    if (criteria.userId) {
      qb.andWhere('t.userId = :userId', { userId: criteria.userId });
    }
    if (criteria.deviceId) {
      qb.andWhere('t.deviceId = :deviceId', { deviceId: criteria.deviceId });
    }
    if (criteria.locationId) {
      qb.andWhere('t.locationId = :locationId', { locationId: criteria.locationId });
    }
    if (criteria.status) {
      qb.andWhere('t.status = :status', { status: criteria.status });
    }
    if (criteria.fromDate) {
      qb.andWhere('t.createdAt >= :fromDate', { fromDate: criteria.fromDate });
    }
    if (criteria.toDate) {
      qb.andWhere('t.createdAt <= :toDate', { toDate: criteria.toDate });
    }

    qb.orderBy('t.createdAt', 'DESC');

    if (criteria.limit) {
      qb.take(criteria.limit);
    }
    if (criteria.offset) {
      qb.skip(criteria.offset);
    }

    const orms = await qb.getMany();
    return orms.map((orm: TransactionOrmEntity) => this.toDomain(orm));
  }

  /**
   * Cuenta transacciones por criterios.
   */
  async count(criteria: {
    userId?: string;
    deviceId?: string;
    locationId?: string;
    status?: TransactionStatus;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<number> {
    const qb = this.transactionRepo.createQueryBuilder('t');

    if (criteria.userId) {
      qb.andWhere('t.userId = :userId', { userId: criteria.userId });
    }
    if (criteria.deviceId) {
      qb.andWhere('t.deviceId = :deviceId', { deviceId: criteria.deviceId });
    }
    if (criteria.locationId) {
      qb.andWhere('t.locationId = :locationId', { locationId: criteria.locationId });
    }
    if (criteria.status) {
      qb.andWhere('t.status = :status', { status: criteria.status });
    }
    if (criteria.fromDate) {
      qb.andWhere('t.createdAt >= :fromDate', { fromDate: criteria.fromDate });
    }
    if (criteria.toDate) {
      qb.andWhere('t.createdAt <= :toDate', { toDate: criteria.toDate });
    }

    return qb.getCount();
  }

  /**
   * Busca transacciones expiradas pendientes.
   */
  async findExpiredPending(olderThanMinutes: number): Promise<Transaction[]> {
    return this.findStalePending(olderThanMinutes);
  }

  /**
   * Obtiene resumen diario de transacciones (para Cierre de Caja).
   */
  async getDailySummary(
    locationId: string,
    date: Date,
  ): Promise<{
    totalTransactions: number;
    totalAmountCents: number;
    byStatus: Record<TransactionStatus, number>;
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Obtener conteo total y monto
    const totals = await this.transactionRepo
      .createQueryBuilder('t')
      .select('COUNT(*)', 'totalTransactions')
      .addSelect('COALESCE(SUM(t.amount_cents), 0)', 'totalAmountCents')
      .where('t.locationId = :locationId', { locationId })
      .andWhere('t.createdAt >= :startOfDay', { startOfDay })
      .andWhere('t.createdAt <= :endOfDay', { endOfDay })
      .getRawOne();

    // Obtener conteo por status
    const statusCounts = await this.transactionRepo
      .createQueryBuilder('t')
      .select('t.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('t.locationId = :locationId', { locationId })
      .andWhere('t.createdAt >= :startOfDay', { startOfDay })
      .andWhere('t.createdAt <= :endOfDay', { endOfDay })
      .groupBy('t.status')
      .getRawMany();

    // Construir Record con todos los status inicializados en 0
    const byStatus: Record<TransactionStatus, number> = {
      [TransactionStatus.PENDING]: 0,
      [TransactionStatus.IN_PROCESS]: 0,
      [TransactionStatus.PAID]: 0,
      [TransactionStatus.COMPLETED]: 0,
      [TransactionStatus.FAILED]: 0,
      [TransactionStatus.REFUNDED_HW_FAILURE]: 0,
      [TransactionStatus.REFUNDED_MANUAL]: 0,
      [TransactionStatus.CANCELLED]: 0,
      [TransactionStatus.EXPIRED]: 0,
    };

    for (const row of statusCounts) {
      const status = row.status as TransactionStatus;
      byStatus[status] = parseInt(row.count, 10) || 0;
    }

    return {
      totalTransactions: parseInt(totals.totalTransactions, 10) || 0,
      totalAmountCents: parseInt(totals.totalAmountCents, 10) || 0,
      byStatus,
    };
  }

  /**
   * Persiste una transacción (crea o actualiza).
   * 
   * @param transaction - Entidad de dominio de la transacción
   * @returns Transacción persistida
   */
  async save(transaction: Transaction): Promise<Transaction> {
    const orm = this.toOrm(transaction);
    const saved = await this.transactionRepo.save(orm);

    this.logger.debug('Transaction saved', {
      id: transaction.id,
      status: transaction.status,
    });

    return this.toDomain(saved);
  }

  /**
   * Mapea entidad ORM a entidad de dominio.
   * 
   * @param orm - Entidad ORM
   * @returns Entidad de dominio
   */
  private toDomain(orm: TransactionOrmEntity): Transaction {
    // Reconstruir metadatos de pago si existen
    let paymentInfo: { externalId: string; gateway: 'MERCADOPAGO' | 'MODO'; method: string } | undefined;
    if (orm.externalPaymentId && orm.paymentGateway) {
      paymentInfo = {
        externalId: orm.externalPaymentId,
        gateway: orm.paymentGateway as 'MERCADOPAGO' | 'MODO',
        method: orm.paymentMethod ?? 'unknown',
      };
    }

    return new Transaction({
      id: orm.id,
      userId: orm.userId,
      deviceId: orm.deviceId,
      productId: orm.productId ?? undefined,
      locationId: orm.locationId,
      amount: Money.fromCents(orm.amountCents),
      quantity: orm.quantity,
      status: orm.status as unknown as TransactionStatus,
      traceId: orm.traceId,
      paymentInfo,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
      completedAt: orm.completedAt ?? undefined,
    });
  }

  /**
   * Mapea entidad de dominio a entidad ORM.
   * 
   * @param domain - Entidad de dominio
   * @returns Entidad ORM
   */
  private toOrm(domain: Transaction): TransactionOrmEntity {
    const orm = new TransactionOrmEntity();
    orm.id = domain.id;
    orm.userId = domain.userId;
    orm.deviceId = domain.deviceId;
    orm.productId = domain.productId ?? null;
    orm.locationId = domain.locationId;
    orm.amountCents = domain.amount.cents;
    orm.quantity = domain.quantity;
    orm.status = domain.status as unknown as TransactionStatusOrm;
    orm.traceId = domain.traceId;
    orm.externalPaymentId = domain.paymentInfo?.externalId ?? null;
    orm.paymentGateway = (domain.paymentInfo?.gateway as PaymentGatewayOrm) ?? null;
    orm.paymentMethod = domain.paymentInfo?.method ?? null;
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    orm.completedAt = domain.completedAt ?? null;
    return orm;
  }
}
