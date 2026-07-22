/**
 * ============================================================================
 * SMART_RETAIL - Configuración de TypeORM
 * ============================================================================
 * Factory function para configurar la conexión a PostgreSQL.
 * 
 * Por qué usamos factory: Permite inyectar ConfigService para obtener
 * las credenciales de forma segura desde variables de entorno.
 * ============================================================================
 */

import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

// El CLI de TypeORM (migraciones) corre FUERA de NestJS, así que no hay
// ConfigModule que cargue el .env. Cargamos las mismas variables que la app,
// con la misma precedencia (.env.local antes que .env). dotenv no pisa
// variables ya presentes en el entorno (p. ej. las que inyecta el CI).
// En tests (NODE_ENV=test) NO cargamos ningún .env para mantener el entorno
// de test hermético.
if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: '.env.local' });
  dotenv.config({ path: '.env' });
}

/**
 * Factory function para NestJS TypeOrmModule.forRootAsync()
 * 
 * @param configService - Servicio de configuración inyectado
 * @returns Opciones de conexión TypeORM
 */
export const typeOrmConfigFactory = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get<string>('DB_HOST'),
  port: configService.get<number>('DB_PORT'),
  username: configService.get<string>('DB_USERNAME'),
  password: configService.get<string>('DB_PASSWORD'),
  database: configService.get<string>('DB_DATABASE'),

  // ─────────────────────────────────────────────────────────────────────
  // ENTIDADES: Glob de las entidades ORM.
  // CRÍTICO: el patrón matchea *.orm-entity.ts (infraestructura), NO los
  // *.entity.ts de dominio (clases puras sin decoradores). Apuntar al glob
  // equivocado hacía que TypeORM no encontrara la metadata en runtime
  // ("No metadata for UserOrmEntity was found").
  // ─────────────────────────────────────────────────────────────────────
  entities: [__dirname + '/../../**/*.orm-entity{.ts,.js}'],

  // ─────────────────────────────────────────────────────────────────────
  // MIGRACIONES: Solo se ejecutan manualmente
  // Por qué: Control total sobre cambios en producción
  // ─────────────────────────────────────────────────────────────────────
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],

  // ─────────────────────────────────────────────────────────────────────
  // SYNCHRONIZE: JAMÁS en producción
  // Por qué: Puede borrar datos si el modelo cambia. Solo para desarrollo.
  // ─────────────────────────────────────────────────────────────────────
  synchronize: configService.get<boolean>('DB_SYNCHRONIZE', false),

  // ─────────────────────────────────────────────────────────────────────
  // LOGGING: Útil para debugging, desactivar en producción
  // ─────────────────────────────────────────────────────────────────────
  logging: configService.get<boolean>('DB_LOGGING', false),

  // ─────────────────────────────────────────────────────────────────────
  // POOL: Configuración del pool de conexiones
  // Por qué: Optimiza el uso de conexiones en alta concurrencia
  // ─────────────────────────────────────────────────────────────────────
  extra: {
    max: 20, // Máximo de conexiones en el pool
    idleTimeoutMillis: 30000, // Tiempo máximo de conexión idle
    connectionTimeoutMillis: 5000, // Timeout para obtener conexión
  },
});

/**
 * DataSource para CLI de TypeORM (migraciones)
 * 
 * Por qué export separado: El CLI de TypeORM necesita un DataSource
 * directo, no puede usar el factory de NestJS.
 * 
 * Uso: pnpm typeorm migration:generate -d src/infrastructure/config/typeorm.config.ts
 */
const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'smartRetail',
  // SECURITY: No hardcodear password - debe venir de Fly.io secrets
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || 'smart_retail_db',
  entities: [__dirname + '/../../**/*.orm-entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: true,
};

export const AppDataSource = new DataSource(dataSourceOptions);
