/**
 * ============================================================================
 * SMART_RETAIL - User Module
 * ============================================================================
 * Módulo de gestión de usuarios.
 * 
 * ARQUITECTURA: Módulo de NEGOCIO (composición de capas)
 * 
 * Este módulo:
 * 1. Registra el UserController (CRUD de usuarios)
 * 2. Configura el repositorio de usuarios
 * 3. Exporta repositorio para uso en otros módulos (auth, transactions)
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Infrastructure - Database
import { UserOrmEntity } from '@infrastructure/database/entities/user.orm-entity';
import { UserRepository } from '@infrastructure/database/repositories/user.repository';

// Ports (tokens)
import { USER_REPOSITORY } from '@application/ports/output/repositories.port';

// Interfaces - HTTP
import { UserController } from '@interfaces/http/controllers/user.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserOrmEntity]),
  ],
  controllers: [UserController],
  providers: [
    // Repository
    {
      provide: USER_REPOSITORY,
      useClass: UserRepository,
    },
  ],
  exports: [
    USER_REPOSITORY,
  ],
})
export class UserModule {}
