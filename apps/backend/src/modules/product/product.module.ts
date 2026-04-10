/**
 * ============================================================================
 * SMART_RETAIL - Product Module
 * ============================================================================
 * Módulo de gestión de productos.
 * 
 * ARQUITECTURA: Módulo de NEGOCIO (composición de capas)
 * 
 * Este módulo:
 * 1. Registra el ProductController (CRUD de productos)
 * 2. Configura el repositorio de productos
 * 3. Exporta repositorio para uso en otros módulos
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Infrastructure - Database
import { ProductOrmEntity } from '@infrastructure/database/entities/product.orm-entity';
import { ProductRepository } from '@infrastructure/database/repositories/product.repository';

// Ports (tokens)
import { PRODUCT_REPOSITORY } from '@application/ports/output/repositories.port';

// Interfaces - HTTP
import { ProductController } from '@interfaces/http/controllers/product.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductOrmEntity]),
  ],
  controllers: [ProductController],
  providers: [
    // Repository
    {
      provide: PRODUCT_REPOSITORY,
      useClass: ProductRepository,
    },
  ],
  exports: [
    PRODUCT_REPOSITORY,
  ],
})
export class ProductModule {}
