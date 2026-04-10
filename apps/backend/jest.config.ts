/**
 * ============================================================================
 * SMART_RETAIL - Jest Configuration
 * ============================================================================
 * Configuración para testing con Jest.
 * ============================================================================
 */

import type { Config } from 'jest';

const config: Config = {
  // Use ts-jest for TypeScript transpilation
  preset: 'ts-jest',

  // Test environment
  testEnvironment: 'node',

  // Root directory for tests
  rootDir: '.',

  // Test file patterns
  testMatch: [
    '<rootDir>/test/**/*.spec.ts',
    '<rootDir>/test/**/*.test.ts',
  ],

  // Module path aliases (must match tsconfig.json paths)
  moduleNameMapper: {
    '^@domain/(.*)$': '<rootDir>/src/domain/$1',
    '^@application/(.*)$': '<rootDir>/src/application/$1',
    '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
    '^@interfaces/(.*)$': '<rootDir>/src/interfaces/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
  },

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.ts',
    // Excluir archivos de test
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    // Excluir módulos NestJS (se prueban en integration)
    '!src/**/*.module.ts',
    '!src/main.ts',
    '!src/**/*.d.ts',
    // Excluir barrel exports (solo re-exportan, sin lógica)
    '!src/**/index.ts',
    // Excluir ORM entities (declarativas, se prueban en integration)
    '!src/infrastructure/database/entities/*.orm-entity.ts',
    // Excluir migrations (se prueban en integration/e2e)
    '!src/infrastructure/database/migrations/*.ts',
  ],

  // Coverage thresholds
  // NOTE: Temporarily lowered for MVP phase. Target is 80%+ for production.
  coverageThreshold: {
    global: {
      branches: 15,
      functions: 10,
      lines: 15,
      statements: 15,
    },
  },

  // Coverage output
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'lcov', 'html'],

  // Transform settings for ts-jest
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],

  // Verbose output
  verbose: true,

  // Test timeout (5 seconds)
  testTimeout: 5000,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,
};

export default config;
