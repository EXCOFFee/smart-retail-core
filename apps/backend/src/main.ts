/**
 * ============================================================================
 * SMART_RETAIL - Entry Point (main.ts)
 * ============================================================================
 * Punto de entrada de la aplicación NestJS.
 * 
 * ARQUITECTURA: Este archivo pertenece a la capa de INFRAESTRUCTURA.
 * Es el único lugar donde se acoplan los frameworks externos (NestJS, Express).
 * ============================================================================
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    // Habilitamos logging detallado para debugging en desarrollo
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');

  // ─────────────────────────────────────────────────────────────────────────
  // GLOBAL PREFIX: Todas las rutas empezarán con /api/v1
  // Por qué: Facilita el versionado de la API y la configuración de proxies
  // ─────────────────────────────────────────────────────────────────────────
  app.setGlobalPrefix(apiPrefix);

  // ─────────────────────────────────────────────────────────────────────────
  // VALIDATION PIPE GLOBAL (Paranoia de Validación)
  // Por qué: Rechazamos CUALQUIER dato que no cumpla con los DTOs.
  // Esto es nuestra primera línea de defensa contra datos maliciosos.
  // ─────────────────────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Elimina propiedades no definidas en el DTO
      forbidNonWhitelisted: true, // Lanza error si hay props extras
      transform: true, // Transforma payloads a instancias de DTO
      transformOptions: {
        enableImplicitConversion: false, // Conversión explícita solamente
      },
    }),
  );

  // ─────────────────────────────────────────────────────────────────────────
  // CORS: Configuración para desarrollo
  // IMPORTANTE: En producción, restringir a dominios específicos
  // ─────────────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: configService.get<string>('NODE_ENV') === 'development' 
      ? true 
      : ['https://admin.smartretail.com'], // Producción: solo dominios permitidos
    credentials: true,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SWAGGER/OPENAPI: Documentación viva de la API
  // Por qué: Mandatorio según AGENTS.md - La documentación debe estar
  // siempre actualizada y accesible para desarrolladores y QA.
  // ─────────────────────────────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('SMART_RETAIL API')
    .setDescription(
      'API de la Aduana de Control Ciberfísica - Smart Retail & Logistics',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Ingresa el Access Token JWT',
      },
      'access-token',
    )
    .addTag('Health', 'Endpoints de salud del sistema')
    .addTag('Auth', 'Autenticación y autorización')
    .addTag('Access', 'Control de acceso (Scan & Go)')
    .addTag('Products', 'Gestión de productos y stock')
    .addTag('Devices', 'Gestión de dispositivos IoT')
    .addTag('Transactions', 'Historial de transacciones')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Mantiene el token en el navegador
    },
  });

  await app.listen(port);

  logger.log(`🚀 SMART_RETAIL Backend corriendo en: http://localhost:${port}`);
  logger.log(`📚 Swagger disponible en: http://localhost:${port}/docs`);
  logger.log(`🌍 Entorno: ${configService.get<string>('NODE_ENV')}`);
}

bootstrap();
