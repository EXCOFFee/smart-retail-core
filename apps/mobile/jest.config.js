/**
 * ============================================================================
 * SMART_RETAIL Mobile - Jest Configuration
 * ============================================================================
 * Configuración para tests unitarios de lógica pura (stores, services).
 * 
 * Por qué testEnvironment node: Los tests de lógica pura no necesitan DOM.
 * Los tests de componentes React Native requieren configuración especial
 * con Expo, por eso se testea la lógica de forma aislada.
 * ============================================================================
 */

module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/*.test.ts',
    '**/*.test.tsx',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@stores/(.*)$': '<rootDir>/src/stores/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/stores/**/*.ts',
    'src/services/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/android/',
    '/ios/',
    '\\.test\\.tsx$', // Component tests require special Expo setup
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
