/**
 * Tests para typeorm.config.ts
 */

import { ConfigService } from '@nestjs/config';

import { typeOrmConfigFactory } from '@infrastructure/config/typeorm.config';

describe('TypeORM Config Factory', () => {
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const values: Record<string, unknown> = {
          DB_HOST: 'db.example.com',
          DB_PORT: 5432,
          DB_USERNAME: 'testuser',
          DB_PASSWORD: 'testpass',
          DB_DATABASE: 'testdb',
          DB_SYNCHRONIZE: false,
          DB_LOGGING: false,
        };
        return values[key] ?? defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;
  });

  describe('typeOrmConfigFactory', () => {
    it('should return PostgreSQL configuration', () => {
      const config = typeOrmConfigFactory(configService);

      expect(config.type).toBe('postgres');
    });

    it('should use ConfigService values', () => {
      const config = typeOrmConfigFactory(configService) as Record<string, unknown>;

      expect(config.host).toBe('db.example.com');
      expect(config.port).toBe(5432);
      expect(config.username).toBe('testuser');
      expect(config.password).toBe('testpass');
      expect(config.database).toBe('testdb');
    });

    it('should set synchronize from config', () => {
      const config = typeOrmConfigFactory(configService) as Record<string, unknown>;

      expect(config.synchronize).toBe(false);
    });

    it('should set logging from config', () => {
      const config = typeOrmConfigFactory(configService) as Record<string, unknown>;

      expect(config.logging).toBe(false);
    });

    it('should include entities glob pattern', () => {
      const config = typeOrmConfigFactory(configService) as Record<string, unknown>;

      expect(config.entities).toBeDefined();
      expect(Array.isArray(config.entities)).toBe(true);
      expect((config.entities as string[])[0]).toContain('.entity');
    });

    it('should include migrations glob pattern', () => {
      const config = typeOrmConfigFactory(configService) as Record<string, unknown>;

      expect(config.migrations).toBeDefined();
      expect(Array.isArray(config.migrations)).toBe(true);
    });

    it('should configure connection pool', () => {
      const config = typeOrmConfigFactory(configService) as Record<string, unknown>;

      expect(config.extra).toBeDefined();
      expect((config.extra as Record<string, unknown>).max).toBe(20);
      expect((config.extra as Record<string, unknown>).idleTimeoutMillis).toBe(30000);
      expect((config.extra as Record<string, unknown>).connectionTimeoutMillis).toBe(5000);
    });

    it('should use default values when config missing', () => {
      const sparseConfigService = {
        get: jest.fn((key: string, defaultValue?: unknown) => {
          if (key === 'DB_SYNCHRONIZE') return defaultValue;
          if (key === 'DB_LOGGING') return defaultValue;
          return null;
        }),
      } as unknown as jest.Mocked<ConfigService>;

      const config = typeOrmConfigFactory(sparseConfigService) as Record<string, unknown>;

      expect(config.synchronize).toBe(false);
      expect(config.logging).toBe(false);
    });
  });

  describe('development vs production', () => {
    it('should never synchronize in production-like config', () => {
      configService.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'DB_SYNCHRONIZE') return false;
        return defaultValue;
      });

      const config = typeOrmConfigFactory(configService) as Record<string, unknown>;

      expect(config.synchronize).toBe(false);
    });

    it('should allow synchronize in development', () => {
      configService.get.mockImplementation((key: string) => {
        const values: Record<string, unknown> = {
          DB_HOST: 'localhost',
          DB_PORT: 5432,
          DB_USERNAME: 'dev',
          DB_PASSWORD: 'dev',
          DB_DATABASE: 'dev_db',
          DB_SYNCHRONIZE: true,
          DB_LOGGING: true,
        };
        return values[key];
      });

      const config = typeOrmConfigFactory(configService) as Record<string, unknown>;

      expect(config.synchronize).toBe(true);
      expect(config.logging).toBe(true);
    });
  });
});

describe('AppDataSource', () => {
  it('should be exported', async () => {
    // Dynamic import to test export
    const module = await import('@infrastructure/config/typeorm.config');
    expect(module.AppDataSource).toBeDefined();
    expect(module.AppDataSource.options.type).toBe('postgres');
  });

  it('should have synchronize false', async () => {
    const module = await import('@infrastructure/config/typeorm.config');
    expect(module.AppDataSource.options.synchronize).toBe(false);
  });

  it('should have logging enabled for CLI', async () => {
    const module = await import('@infrastructure/config/typeorm.config');
    expect(module.AppDataSource.options.logging).toBe(true);
  });
});
