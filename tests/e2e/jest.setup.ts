/**
 * ============================================================================
 * SMART_RETAIL - E2E Test Setup
 * ============================================================================
 * Configuración inicial para tests de integración.
 * ============================================================================
 */

import { execSync } from 'child_process';

// Timeout global para tests E2E
jest.setTimeout(30000);

// Variables de entorno para tests
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 
  'postgresql://smartRetail:smart_retail_test@localhost:5433/smart_retail_test';
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? 
  'redis://localhost:6380';
process.env.JWT_SECRET = 'test-secret-key-for-e2e-tests-only';

/**
 * Setup global antes de todos los tests.
 */
beforeAll(async () => {
  console.log('🚀 Iniciando entorno de tests E2E...');
  
  // Verificar que los contenedores de test estén corriendo
  try {
    execSync('docker compose -f docker-compose.test.yml ps', {
      stdio: 'pipe',
    });
  } catch {
    console.warn('⚠️ Contenedores de test no detectados. Ejecuta: pnpm test:e2e:setup');
  }
});

/**
 * Cleanup global después de todos los tests.
 */
afterAll(async () => {
  console.log('🧹 Limpiando entorno de tests E2E...');
});
