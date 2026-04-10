/**
 * ============================================================================
 * SMART_RETAIL - Transaction Module
 * ============================================================================
 * Módulo de consulta de transacciones.
 * 
 * ARQUITECTURA: Módulo de NEGOCIO (composición de capas)
 * 
 * NOTA: Las transacciones se CREAN a través del AccessModule (CU-01).
 * Este módulo es principalmente para CONSULTA y reportes.
 * 
 * Este módulo:
 * 1. Registra el TransactionController (consulta de transacciones)
 * 2. Configura el repositorio de transacciones
 * 3. Exporta repositorio para uso en otros módulos (access, reports)
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Infrastructure - Database
import { TransactionOrmEntity } from '@infrastructure/database/entities/transaction.orm-entity';
import { TransactionRepository } from '@infrastructure/database/repositories/transaction.repository';

// Ports (tokens)
import { TRANSACTION_REPOSITORY } from '@application/ports/output/repositories.port';

// Interfaces - HTTP
import { TransactionController } from '@interfaces/http/controllers/transaction.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([TransactionOrmEntity]),
  ],
  controllers: [TransactionController],
  providers: [
    // Repository
    {
      provide: TRANSACTION_REPOSITORY,
      useClass: TransactionRepository,
    },
  ],
  exports: [
    TRANSACTION_REPOSITORY,
  ],
})
export class TransactionModule {}
