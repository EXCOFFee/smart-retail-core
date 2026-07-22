/**
 * ============================================================================
 * SMART_RETAIL - Validación de Variables de Entorno
 * ============================================================================
 * Define el esquema de validación para todas las variables de entorno.
 * 
 * Por qué: Fail Fast - Si falta una variable crítica, la aplicación
 * NO debe iniciar. Es mejor fallar en el arranque que en runtime.
 * ============================================================================
 */

import * as Joi from 'joi';

/**
 * Esquema de validación Joi para variables de entorno.
 * 
 * NOTA: Usamos Joi aquí (no class-validator) porque ConfigModule
 * de NestJS tiene integración nativa con Joi para validación temprana.
 */
export const envValidationSchema = Joi.object({
  // ─────────────────────────────────────────────────────────────────────
  // GENERAL
  // ─────────────────────────────────────────────────────────────────────
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  
  PORT: Joi.number().port().default(3000),
  
  API_PREFIX: Joi.string().default('api/v1'),

  // ─────────────────────────────────────────────────────────────────────
  // DATABASE (PostgreSQL) - OBLIGATORIO
  // ─────────────────────────────────────────────────────────────────────
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),
  DB_SYNCHRONIZE: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(false),

  // ─────────────────────────────────────────────────────────────────────
  // REDIS - OBLIGATORIO (latencia <200ms requiere cache)
  // ─────────────────────────────────────────────────────────────────────
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  REDIS_DB: Joi.number().min(0).max(15).default(0),
  REDIS_STOCK_LOCK_TTL: Joi.number().min(5).max(120).default(30),

  // ─────────────────────────────────────────────────────────────────────
  // JWT - OBLIGATORIO para autenticación
  // ─────────────────────────────────────────────────────────────────────
  JWT_PRIVATE_KEY: Joi.string().required(),
  JWT_PUBLIC_KEY: Joi.string().required(),
  JWT_ACCESS_TOKEN_TTL: Joi.number().min(60).default(900), // 15 min
  JWT_REFRESH_TOKEN_TTL: Joi.number().min(3600).default(604800), // 7 días

  // ─────────────────────────────────────────────────────────────────────
  // HASHING DE PASSWORDS (bcrypt)
  // ─────────────────────────────────────────────────────────────────────
  // Cost factor de bcrypt. 12 es un buen default para producción; subir si
  // el hardware lo permite. Rango 10-15 para evitar valores inseguros o
  // absurdamente lentos.
  BCRYPT_COST: Joi.number().min(10).max(15).default(12),

  // ─────────────────────────────────────────────────────────────────────
  // GATEWAYS EXTERNOS (pago + hardware)
  // ─────────────────────────────────────────────────────────────────────
  // 'live'  → usa los adapters reales (MercadoPago / WebSocket).
  // 'mock'  → usa dobles en memoria (dev/test, sin credenciales).
  // Si no se define: 'live' en producción, 'mock' fuera de producción.
  // 'mock' está PROHIBIDO en producción (se rechaza al arrancar).
  GATEWAY_MODE: Joi.string().valid('live', 'mock').optional(),

  // ─────────────────────────────────────────────────────────────────────
  // PASARELAS DE PAGO - Requeridas en producción (modo 'live')
  // ─────────────────────────────────────────────────────────────────────
  // Nombres alineados 1:1 con lo que leen los adapters (MercadoPagoAdapter /
  // ModoAdapter). Con estas variables bien cargadas, GATEWAY_MODE=live funciona.
  //
  // MercadoPago (pasarela primaria)
  MERCADOPAGO_ACCESS_TOKEN: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  MERCADOPAGO_API_URL: Joi.string().uri().optional(),
  MERCADOPAGO_PUBLIC_KEY: Joi.string().optional(),
  MERCADOPAGO_WEBHOOK_SECRET: Joi.string().optional(),

  // MODO (pasarela alternativa)
  MODO_API_URL: Joi.string().uri().optional(),
  MODO_API_KEY: Joi.string().optional(),
  MODO_API_SECRET: Joi.string().optional(),
  MODO_STORE_ID: Joi.string().optional(),

  // ─────────────────────────────────────────────────────────────────────
  // MONEDA
  // ─────────────────────────────────────────────────────────────────────
  BASE_CURRENCY: Joi.string().length(3).uppercase().default('ARS'),

  // ─────────────────────────────────────────────────────────────────────
  // TIMEOUTS
  // ─────────────────────────────────────────────────────────────────────
  PAYMENT_GATEWAY_TIMEOUT: Joi.number().min(1000).max(30000).default(5000),
  HARDWARE_ACK_TIMEOUT: Joi.number().min(1000).max(30000).default(5000),

  // ─────────────────────────────────────────────────────────────────────
  // LOGGING
  // ─────────────────────────────────────────────────────────────────────
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'log', 'debug', 'verbose')
    .default('debug'),
});
