/**
 * ============================================================================
 * SMART_RETAIL - Device Module
 * ============================================================================
 * Módulo de gestión de dispositivos IoT.
 * 
 * ARQUITECTURA: Módulo de NEGOCIO (composición de capas)
 * 
 * Este módulo:
 * 1. Registra el DeviceController
 * 2. Configura el Use Case de Provisioning
 * 3. Exporta repositorio para uso en otros módulos
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Application
import {
    DEVICE_PROVISION_USE_CASE,
    DeviceProvisionService,
} from '@application/use-cases/device-provision.service';

// Infrastructure - Database
import { DeviceOrmEntity } from '@infrastructure/database/entities/device.orm-entity';
import { DeviceRepository } from '@infrastructure/database/repositories/device.repository';

// Ports (tokens)
import { DEVICE_REPOSITORY } from '@application/ports/output/repositories.port';

// Interfaces - HTTP
import { DeviceController } from '@interfaces/http/controllers/device.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeviceOrmEntity]),
  ],
  controllers: [DeviceController],
  providers: [
    // Repository
    {
      provide: DEVICE_REPOSITORY,
      useClass: DeviceRepository,
    },
    // Use Case
    {
      provide: DEVICE_PROVISION_USE_CASE,
      useClass: DeviceProvisionService,
    },
  ],
  exports: [
    DEVICE_REPOSITORY,
    DEVICE_PROVISION_USE_CASE,
  ],
})
export class DeviceModule {}
