/**
 * Tests para env.validation.ts
 */

import { envValidationSchema } from '@infrastructure/config/env.validation';

describe('Environment Validation Schema', () => {
  const validEnv = {
    NODE_ENV: 'development',
    PORT: 3000,
    API_PREFIX: 'api/v1',
    DB_HOST: 'localhost',
    DB_PORT: 5432,
    DB_USERNAME: 'smartRetail',
    DB_PASSWORD: 'secret',
    DB_DATABASE: 'smart_retail_db',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    JWT_PRIVATE_KEY: 'private-key',
    JWT_PUBLIC_KEY: 'public-key',
  };

  describe('valid configurations', () => {
    it('should accept valid development environment', () => {
      const result = envValidationSchema.validate(validEnv);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid production environment', () => {
      const prodEnv = {
        ...validEnv,
        NODE_ENV: 'production',
        MP_ACCESS_TOKEN: 'mp-token-abc123',
      };
      const result = envValidationSchema.validate(prodEnv);
      expect(result.error).toBeUndefined();
    });

    it('should accept test environment', () => {
      const testEnv = { ...validEnv, NODE_ENV: 'test' };
      const result = envValidationSchema.validate(testEnv);
      expect(result.error).toBeUndefined();
    });
  });

  describe('default values', () => {
    it('should default NODE_ENV to development', () => {
      const env = { ...validEnv };
      delete (env as Record<string, unknown>).NODE_ENV;
      const result = envValidationSchema.validate(env);
      expect(result.value.NODE_ENV).toBe('development');
    });

    it('should default PORT to 3000', () => {
      const env = { ...validEnv };
      delete (env as Record<string, unknown>).PORT;
      const result = envValidationSchema.validate(env);
      expect(result.value.PORT).toBe(3000);
    });

    it('should default DB_PORT to 5432', () => {
      const env = { ...validEnv };
      delete (env as Record<string, unknown>).DB_PORT;
      const result = envValidationSchema.validate(env);
      expect(result.value.DB_PORT).toBe(5432);
    });

    it('should default REDIS_PORT to 6379', () => {
      const env = { ...validEnv };
      delete (env as Record<string, unknown>).REDIS_PORT;
      const result = envValidationSchema.validate(env);
      expect(result.value.REDIS_PORT).toBe(6379);
    });

    it('should default JWT_ACCESS_TOKEN_TTL to 900 (15 min)', () => {
      const result = envValidationSchema.validate(validEnv);
      expect(result.value.JWT_ACCESS_TOKEN_TTL).toBe(900);
    });

    it('should default JWT_REFRESH_TOKEN_TTL to 604800 (7 days)', () => {
      const result = envValidationSchema.validate(validEnv);
      expect(result.value.JWT_REFRESH_TOKEN_TTL).toBe(604800);
    });

    it('should default BASE_CURRENCY to ARS', () => {
      const result = envValidationSchema.validate(validEnv);
      expect(result.value.BASE_CURRENCY).toBe('ARS');
    });

    it('should default REDIS_STOCK_LOCK_TTL to 30', () => {
      const result = envValidationSchema.validate(validEnv);
      expect(result.value.REDIS_STOCK_LOCK_TTL).toBe(30);
    });

    it('should default PAYMENT_GATEWAY_TIMEOUT to 5000', () => {
      const result = envValidationSchema.validate(validEnv);
      expect(result.value.PAYMENT_GATEWAY_TIMEOUT).toBe(5000);
    });

    it('should default LOG_LEVEL to debug', () => {
      const result = envValidationSchema.validate(validEnv);
      expect(result.value.LOG_LEVEL).toBe('debug');
    });
  });

  describe('required fields validation', () => {
    it('should fail if DB_HOST is missing', () => {
      const env = { ...validEnv };
      delete (env as Record<string, unknown>).DB_HOST;
      const result = envValidationSchema.validate(env);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('DB_HOST');
    });

    it('should fail if DB_USERNAME is missing', () => {
      const env = { ...validEnv };
      delete (env as Record<string, unknown>).DB_USERNAME;
      const result = envValidationSchema.validate(env);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('DB_USERNAME');
    });

    it('should fail if DB_PASSWORD is missing', () => {
      const env = { ...validEnv };
      delete (env as Record<string, unknown>).DB_PASSWORD;
      const result = envValidationSchema.validate(env);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('DB_PASSWORD');
    });

    it('should fail if DB_DATABASE is missing', () => {
      const env = { ...validEnv };
      delete (env as Record<string, unknown>).DB_DATABASE;
      const result = envValidationSchema.validate(env);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('DB_DATABASE');
    });

    it('should fail if REDIS_HOST is missing', () => {
      const env = { ...validEnv };
      delete (env as Record<string, unknown>).REDIS_HOST;
      const result = envValidationSchema.validate(env);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('REDIS_HOST');
    });

    it('should fail if JWT_PRIVATE_KEY is missing', () => {
      const env = { ...validEnv };
      delete (env as Record<string, unknown>).JWT_PRIVATE_KEY;
      const result = envValidationSchema.validate(env);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('JWT_PRIVATE_KEY');
    });

    it('should fail if JWT_PUBLIC_KEY is missing', () => {
      const env = { ...validEnv };
      delete (env as Record<string, unknown>).JWT_PUBLIC_KEY;
      const result = envValidationSchema.validate(env);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('JWT_PUBLIC_KEY');
    });
  });

  describe('production-specific validation', () => {
    it('should require MP_ACCESS_TOKEN in production', () => {
      const prodEnv = { ...validEnv, NODE_ENV: 'production' };
      const result = envValidationSchema.validate(prodEnv);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('MP_ACCESS_TOKEN');
    });

    it('should allow missing MP_ACCESS_TOKEN in development', () => {
      const devEnv = { ...validEnv, NODE_ENV: 'development' };
      const result = envValidationSchema.validate(devEnv);
      expect(result.error).toBeUndefined();
    });
  });

  describe('value constraints', () => {
    it('should reject invalid NODE_ENV values', () => {
      const env = { ...validEnv, NODE_ENV: 'staging' };
      const result = envValidationSchema.validate(env);
      expect(result.error).toBeDefined();
    });

    it('should reject invalid PORT (out of range)', () => {
      const env = { ...validEnv, PORT: 99999 };
      const result = envValidationSchema.validate(env);
      expect(result.error).toBeDefined();
    });

    it('should reject REDIS_DB > 15', () => {
      const env = { ...validEnv, REDIS_DB: 16 };
      const result = envValidationSchema.validate(env);
      expect(result.error).toBeDefined();
    });

    it('should reject REDIS_STOCK_LOCK_TTL < 5', () => {
      const env = { ...validEnv, REDIS_STOCK_LOCK_TTL: 2 };
      const result = envValidationSchema.validate(env);
      expect(result.error).toBeDefined();
    });

    it('should reject REDIS_STOCK_LOCK_TTL > 120', () => {
      const env = { ...validEnv, REDIS_STOCK_LOCK_TTL: 150 };
      const result = envValidationSchema.validate(env);
      expect(result.error).toBeDefined();
    });

    it('should reject JWT_ACCESS_TOKEN_TTL < 60', () => {
      const env = { ...validEnv, JWT_ACCESS_TOKEN_TTL: 30 };
      const result = envValidationSchema.validate(env);
      expect(result.error).toBeDefined();
    });

    it('should reject JWT_REFRESH_TOKEN_TTL < 3600', () => {
      const env = { ...validEnv, JWT_REFRESH_TOKEN_TTL: 1000 };
      const result = envValidationSchema.validate(env);
      expect(result.error).toBeDefined();
    });

    it('should reject invalid LOG_LEVEL', () => {
      const env = { ...validEnv, LOG_LEVEL: 'trace' };
      const result = envValidationSchema.validate(env);
      expect(result.error).toBeDefined();
    });

    it('should accept all valid LOG_LEVEL values', () => {
      const levels = ['error', 'warn', 'log', 'debug', 'verbose'];
      for (const level of levels) {
        const env = { ...validEnv, LOG_LEVEL: level };
        const result = envValidationSchema.validate(env);
        expect(result.error).toBeUndefined();
      }
    });
  });

  describe('optional fields', () => {
    it('should allow empty REDIS_PASSWORD', () => {
      const env = { ...validEnv, REDIS_PASSWORD: '' };
      const result = envValidationSchema.validate(env);
      expect(result.error).toBeUndefined();
    });

    it('should allow valid MODO_API_URL', () => {
      const env = { ...validEnv, MODO_API_URL: 'https://api.modo.com.ar' };
      const result = envValidationSchema.validate(env);
      expect(result.error).toBeUndefined();
    });
  });
});
