/**
 * ============================================================================
 * SMART_RETAIL - Tasks Module
 * ============================================================================
 * Módulo que registra todas las tareas programadas (Cron Jobs) del sistema.
 * 
 * ARQUITECTURA: Este módulo pertenece a INFRAESTRUCTURA 🔴
 * - Las tareas programadas son adaptadores que inician procesos
 * - Requiere acceso a repositorios y entidades de la base de datos
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entidades necesarias
import { AuditLogOrmEntity } from '@infrastructure/database/entities/audit-log.orm-entity';
import { DeviceOrmEntity } from '@infrastructure/database/entities/device.orm-entity';
import { TransactionOrmEntity } from '@infrastructure/database/entities/transaction.orm-entity';

// Repositorios
import { TRANSACTION_REPOSITORY } from '@application/ports/output/repositories.port';
import { TransactionRepository } from '@infrastructure/database/repositories/transaction.repository';

// Tasks
import { DailyReportTask } from './daily-report.task';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TransactionOrmEntity,
      DeviceOrmEntity,
      AuditLogOrmEntity,
    ]),
  ],
  providers: [
    // Repositorios necesarios para las tasks
    {
      provide: TRANSACTION_REPOSITORY,
      useClass: TransactionRepository,
    },
    // Tareas programadas
    DailyReportTask,
  ],
  exports: [DailyReportTask],
})
export class TasksModule {}
