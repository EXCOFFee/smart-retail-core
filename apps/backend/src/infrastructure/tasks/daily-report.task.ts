/**
 * ============================================================================
 * SMART_RETAIL - Daily Report Task (Reporte Z)
 * ============================================================================
 * Cron Job que se ejecuta a las 00:00 (medianoche) para calcular el
 * resumen de ventas del día anterior por ubicación.
 * 
 * ARQUITECTURA: Capa de INFRAESTRUCTURA 🔴
 * - Los Cron Jobs son adaptadores que inician procesos programados
 * - Puede usar repositorios directamente ya que es un proceso de sistema
 * 
 * REFERENCIA: CU-14 - Cierre de Caja (Reporte Z)
 * ============================================================================
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
    ITransactionRepository,
    TRANSACTION_REPOSITORY,
} from '@application/ports/output/repositories.port';
import {
    AuditEventType,
    AuditLogOrmEntity,
    AuditSeverity,
} from '@infrastructure/database/entities/audit-log.orm-entity';
import { DeviceOrmEntity } from '@infrastructure/database/entities/device.orm-entity';

/**
 * Estructura del resumen diario
 */
interface DailySummary {
  locationId: string;
  date: Date;
  totalTransactions: number;
  totalAmountCents: number;
  totalAmountFormatted: string;
  byStatus: Record<string, number>;
}

@Injectable()
export class DailyReportTask {
  private readonly logger = new Logger(DailyReportTask.name);

  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,

    @InjectRepository(DeviceOrmEntity)
    private readonly deviceRepo: Repository<DeviceOrmEntity>,

    @InjectRepository(AuditLogOrmEntity)
    private readonly auditLogRepo: Repository<AuditLogOrmEntity>,
  ) {}

  /**
   * Cron Job: Ejecuta el Reporte Z a las 00:00 cada día.
   * 
   * Por qué 00:00: Captura todas las transacciones del día que acaba de terminar.
   * El reporte es del día ANTERIOR (yesterday).
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'daily-report-z',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  async handleDailyReport(): Promise<void> {
    const startTime = Date.now();
    this.logger.log('🔄 Iniciando Reporte Z (Cierre de Caja)...');

    try {
      // Obtener el día de ayer
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(12, 0, 0, 0); // Mediodía para evitar problemas de timezone

      // Obtener todas las ubicaciones únicas desde los dispositivos
      const locationIds = await this.getUniqueLocationIds();

      if (locationIds.length === 0) {
        this.logger.warn('⚠️ No hay ubicaciones con dispositivos activos');
        return;
      }

      this.logger.log(`📍 Procesando ${locationIds.length} ubicación(es)...`);

      const summaries: DailySummary[] = [];

      for (const locationId of locationIds) {
        try {
          const summary = await this.generateSummaryForLocation(
            locationId,
            yesterday,
          );
          summaries.push(summary);

          // Guardar en audit log
          await this.saveToAuditLog(summary);
        } catch (error) {
          this.logger.error(
            `Error procesando ubicación ${locationId}: ${(error as Error).message}`,
          );
        }
      }

      const totalRevenue = summaries.reduce(
        (sum, s) => sum + s.totalAmountCents,
        0,
      );
      const totalTx = summaries.reduce(
        (sum, s) => sum + s.totalTransactions,
        0,
      );

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Reporte Z completado en ${duration}ms | ` +
          `Ubicaciones: ${locationIds.length} | ` +
          `Transacciones: ${totalTx} | ` +
          `Total: $${(totalRevenue / 100).toFixed(2)}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error en Reporte Z: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Obtiene los IDs únicos de ubicaciones desde los dispositivos activos.
   */
  private async getUniqueLocationIds(): Promise<string[]> {
    const result = await this.deviceRepo
      .createQueryBuilder('d')
      .select('DISTINCT d.locationId', 'locationId')
      .where('d.status = :status', { status: 'active' })
      .andWhere('d.locationId IS NOT NULL')
      .getRawMany<{ locationId: string }>();

    return result.map((r) => r.locationId);
  }

  /**
   * Genera el resumen para una ubicación específica.
   */
  private async generateSummaryForLocation(
    locationId: string,
    date: Date,
  ): Promise<DailySummary> {
    const summary = await this.transactionRepository.getDailySummary(
      locationId,
      date,
    );

    return {
      locationId,
      date,
      totalTransactions: summary.totalTransactions,
      totalAmountCents: summary.totalAmountCents,
      totalAmountFormatted: `$${(summary.totalAmountCents / 100).toFixed(2)}`,
      byStatus: summary.byStatus as unknown as Record<string, number>,
    };
  }

  /**
   * Guarda el resumen en la tabla de audit logs.
   */
  private async saveToAuditLog(summary: DailySummary): Promise<void> {
    const auditLog = this.auditLogRepo.create({
      eventType: AuditEventType.SYSTEM_STARTUP, // Re-usar, o agregar DAILY_REPORT en el enum
      severity: AuditSeverity.INFO,
      entityType: 'daily_report',
      entityId: summary.locationId,
      actorId: null,
      actorType: 'system',
      description: `Reporte Z - ${summary.date.toISOString().split('T')[0]} - ${summary.totalAmountFormatted}`,
      payload: {
        type: 'DAILY_REPORT_Z',
        reportDate: summary.date.toISOString().split('T')[0],
        locationId: summary.locationId,
        totalTransactions: summary.totalTransactions,
        totalAmountCents: summary.totalAmountCents,
        totalAmountFormatted: summary.totalAmountFormatted,
        byStatus: summary.byStatus,
      },
    });

    await this.auditLogRepo.save(auditLog);

    this.logger.debug(
      `📝 Audit log guardado para ubicación ${summary.locationId}`,
    );
  }
}
