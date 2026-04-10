/**
 * ============================================================================
 * SMART_RETAIL - E2E Test Configuration
 * ============================================================================
 * Configuración de Jest para tests de integración end-to-end.
 * 
 * INCLUYE:
 * - Tests del critical path con mocks
 * - Tests del IoT WebSocket gateway
 * - Configuración para tests aislados (sin dependencias externas)
 * ============================================================================
 */

import type { Config } from 'jest';

const config: Config = {
  displayName: 'e2e',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.e2e-spec.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../../apps/backend/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testTimeout: 30000, // 30 segundos para tests de integración
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  
  // Configuración adicional para mocks
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  
  // Ordenar tests: primero los con mocks (más rápidos)
  testSequencer: '<rootDir>/testSequencer.js',
  
  // Cobertura
  collectCoverageFrom: [
    '<rootDir>/mocks/**/*.ts',
    '!<rootDir>/mocks/**/*.d.ts',
  ],
};

export default config;
