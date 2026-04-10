/**
 * ============================================================================
 * SMART_RETAIL - App Module (Root Module)
 * ============================================================================
 * Módulo raíz que orquesta todos los módulos de la aplicación.
 * 
 * ARQUITECTURA: Este archivo es el "compositor" que une las capas:
 * - Importa módulos de Infraestructura (Config, TypeORM, Redis)
 * - Registra proveedores que conectan Puertos con Adaptadores
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

// Módulos de Infraestructura
import { HealthModule } from '@infrastructure/modules/health.module';
import { TasksModule } from '@infrastructure/tasks/tasks.module';

// Módulos de Dominio
import { AccessModule } from '@modules/access';
import { AuthModule } from '@modules/auth';
import { DeviceModule } from '@modules/device/device.module';
import { ProductModule } from '@modules/product';
import { TransactionModule } from '@modules/transaction';
import { UserModule } from '@modules/user';

// Guards globales
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';

// Configuración de TypeORM (se carga desde config)
import { typeOrmConfigFactory } from '@infrastructure/config/typeorm.config';

// Validación de variables de entorno
import { envValidationSchema } from '@infrastructure/config/env.validation';

// Filtros globales
import { GlobalExceptionFilter } from '@interfaces/http/filters';

@Module({
  imports: [
    // ─────────────────────────────────────────────────────────────────────
    // CONFIG MODULE: Carga y valida variables de entorno
    // Por qué: Centralizamos la configuración y fallamos temprano si
    // falta alguna variable crítica (Fail Fast principle).
    // ─────────────────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true, // Disponible en toda la app sin reimportar
      envFilePath: ['.env.local', '.env'], // .env.local tiene prioridad
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false, // Muestra TODOS los errores, no solo el primero
      },
    }),

    // ─────────────────────────────────────────────────────────────────────
    // SCHEDULE MODULE: Tareas programadas (Cron Jobs)
    // Por qué: Reporte Z a las 00:00 (CU-14 - Cierre de Caja)
    // ─────────────────────────────────────────────────────────────────────
    ScheduleModule.forRoot(),

    // ─────────────────────────────────────────────────────────────────────
    // TYPEORM MODULE: Conexión a PostgreSQL
    // Por qué: Usamos forRootAsync para poder inyectar ConfigService
    // y obtener las credenciales de las variables de entorno.
    // ─────────────────────────────────────────────────────────────────────
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: typeOrmConfigFactory,
    }),

    // ─────────────────────────────────────────────────────────────────────
    // MÓDULOS DE DOMINIO/APLICACIÓN
    // Cada módulo encapsula una bounded context del sistema
    // ─────────────────────────────────────────────────────────────────────
    AuthModule, // Autenticación JWT RS256 - GLOBAL
    HealthModule,
    TasksModule, // Cron Jobs (Reporte Z - CU-14)
    AccessModule, // Critical Path - CU-01
    DeviceModule, // CU-10 - Provisioning de dispositivos
    ProductModule, // CRUD de productos
    TransactionModule, // Consulta de transacciones
    UserModule, // Gestión de usuarios
  ],
  controllers: [],
  providers: [
    // ─────────────────────────────────────────────────────────────────────
    // GUARDS GLOBALES
    // Por qué: JwtAuthGuard aplicado globalmente, @Public() para excepciones
    // ─────────────────────────────────────────────────────────────────────
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // ─────────────────────────────────────────────────────────────────────
    // FILTROS GLOBALES
    // Por qué APP_FILTER: Permite inyectar dependencias (ConfigService)
    // ─────────────────────────────────────────────────────────────────────
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
