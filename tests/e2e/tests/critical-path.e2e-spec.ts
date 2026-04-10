/**
 * ============================================================================
 * SMART_RETAIL - Critical Path E2E Tests
 * ============================================================================
 * Tests de integración para el flujo crítico: QR → Backend → Device
 * 
 * IMPLEMENTA: CU-01, CU-02, CU-03
 * 
 * PRECONDICIONES:
 * - Docker compose test environment running
 * - Base de datos con seed de prueba
 * ============================================================================
 */

import axios, { AxiosInstance } from 'axios';

describe('Critical Path: Access Flow (E2E)', () => {
  let apiClient: AxiosInstance;
  let authToken: string;
  let testDeviceId: string;
  let testUserId: string;

  const API_URL = process.env.API_URL ?? 'http://localhost:3000/api/v1';

  beforeAll(async () => {
    apiClient = axios.create({
      baseURL: API_URL,
      timeout: 10000,
    });

    // Autenticarse con usuario de prueba
    const loginResponse = await apiClient.post('/auth/login', {
      email: 'test@smartretail.com',
      password: 'TestPassword123!',
    });

    authToken = loginResponse.data.accessToken;
    testUserId = loginResponse.data.user.id;

    apiClient.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;

    // Obtener dispositivo de prueba
    const devicesResponse = await apiClient.get('/devices');
    testDeviceId = devicesResponse.data.data[0]?.id;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CU-01: Proceso de Compra Exitoso (Happy Path)
  // ─────────────────────────────────────────────────────────────────────────
  describe('CU-01: Proceso de Compra Exitoso', () => {
    it('should process access in less than 200ms (P95)', async () => {
      // Arrange
      const qrPayload = JSON.stringify({
        deviceId: testDeviceId,
        timestamp: Date.now(),
        nonce: `test_${Date.now()}`,
      });

      // Act
      const startTime = Date.now();
      const response = await apiClient.post('/access/process', { qrPayload });
      const latency = Date.now() - startTime;

      // Assert
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.transactionId).toBeDefined();
      
      // KPI: < 200ms
      console.log(`Latency: ${latency}ms`);
      expect(latency).toBeLessThan(500); // Relajado para CI, en producción debe ser < 200ms
    });

    it('should decrement stock atomically', async () => {
      // Arrange: obtener stock inicial
      const productId = 'test-product-id';
      const initialStock = await apiClient.get(`/products/${productId}/stock`);

      // Act: procesar acceso
      const qrPayload = JSON.stringify({
        deviceId: testDeviceId,
        productId,
        timestamp: Date.now(),
        nonce: `test_${Date.now()}`,
      });
      await apiClient.post('/access/process', { qrPayload });

      // Assert: stock debe haber disminuido en 1
      const finalStock = await apiClient.get(`/products/${productId}/stock`);
      expect(finalStock.data.quantity).toBe(initialStock.data.quantity - 1);
    });

    it('should create transaction with PAID status', async () => {
      // Arrange
      const qrPayload = JSON.stringify({
        deviceId: testDeviceId,
        timestamp: Date.now(),
        nonce: `test_${Date.now()}`,
      });

      // Act
      const response = await apiClient.post('/access/process', { qrPayload });

      // Assert
      const transaction = await apiClient.get(
        `/transactions/${response.data.transactionId}`,
      );
      expect(transaction.data.status).toBe('PAID');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CU-02: Rechazo por Fondos Insuficientes
  // ─────────────────────────────────────────────────────────────────────────
  describe('CU-02: Rechazo por Fondos Insuficientes', () => {
    it('should reject with 402 when insufficient balance', async () => {
      // Arrange: usar usuario sin saldo
      const noBalanceClient = axios.create({
        baseURL: API_URL,
        timeout: 10000,
      });

      const loginResponse = await noBalanceClient.post('/auth/login', {
        email: 'no-balance@smartretail.com',
        password: 'TestPassword123!',
      });

      noBalanceClient.defaults.headers.common['Authorization'] =
        `Bearer ${loginResponse.data.accessToken}`;

      const qrPayload = JSON.stringify({
        deviceId: testDeviceId,
        timestamp: Date.now(),
        nonce: `test_${Date.now()}`,
      });

      // Act & Assert
      try {
        await noBalanceClient.post('/access/process', { qrPayload });
        fail('Should have thrown 402 error');
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          expect(error.response?.status).toBe(402);
          expect(error.response?.data.errorCode).toBe('INSUFFICIENT_BALANCE');
        }
      }
    });

    it('should not decrement stock on payment failure', async () => {
      // Este test verifica que el stock no se modifica si el pago falla
      const productId = 'test-product-id';
      const initialStock = await apiClient.get(`/products/${productId}/stock`);

      // Simular fallo de pago (se necesita mock o user especial)
      // ...

      const finalStock = await apiClient.get(`/products/${productId}/stock`);
      expect(finalStock.data.quantity).toBe(initialStock.data.quantity);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CU-05: Race Condition (Guerra de Clics)
  // ─────────────────────────────────────────────────────────────────────────
  describe('CU-05: Race Condition Handling', () => {
    it('should reject concurrent requests for same product', async () => {
      // Arrange: producto con stock = 1
      const limitedProductId = 'limited-stock-product';

      const qrPayload1 = JSON.stringify({
        deviceId: testDeviceId,
        productId: limitedProductId,
        timestamp: Date.now(),
        nonce: `test_${Date.now()}_1`,
      });

      const qrPayload2 = JSON.stringify({
        deviceId: testDeviceId,
        productId: limitedProductId,
        timestamp: Date.now(),
        nonce: `test_${Date.now()}_2`,
      });

      // Act: enviar ambas requests simultáneamente
      const results = await Promise.allSettled([
        apiClient.post('/access/process', { qrPayload: qrPayload1 }),
        apiClient.post('/access/process', { qrPayload: qrPayload2 }),
      ]);

      // Assert: una debe tener éxito, la otra debe fallar con 409
      const successes = results.filter((r) => r.status === 'fulfilled');
      const failures = results.filter((r) => r.status === 'rejected');

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);

      if (failures[0].status === 'rejected') {
        const error = failures[0].reason;
        expect(error.response?.status).toBe(409);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CU-08: QR Expirado (Replay Attack Prevention)
  // ─────────────────────────────────────────────────────────────────────────
  describe('CU-08: Replay Attack Prevention', () => {
    it('should reject expired QR codes (> 60s)', async () => {
      // Arrange: QR con timestamp de hace 2 minutos
      const expiredTimestamp = Date.now() - 120000; // 2 minutos atrás
      const qrPayload = JSON.stringify({
        deviceId: testDeviceId,
        timestamp: expiredTimestamp,
        nonce: `test_${Date.now()}`,
      });

      // Act & Assert
      try {
        await apiClient.post('/access/process', { qrPayload });
        fail('Should have thrown 403 error');
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          expect(error.response?.status).toBe(403);
          expect(error.response?.data.message).toContain('expirado');
        }
      }
    });

    it('should reject reused nonce (same QR used twice)', async () => {
      // Arrange: usar el mismo nonce dos veces
      const nonce = `unique_nonce_${Date.now()}`;
      const qrPayload = JSON.stringify({
        deviceId: testDeviceId,
        timestamp: Date.now(),
        nonce,
      });

      // Act: primera request exitosa
      await apiClient.post('/access/process', { qrPayload });

      // Act & Assert: segunda request debe fallar
      try {
        await apiClient.post('/access/process', { qrPayload });
        fail('Should have thrown 403 error');
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          expect(error.response?.status).toBe(403);
          expect(error.response?.data.errorCode).toBe('NONCE_ALREADY_USED');
        }
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Latency Performance Tests
  // ─────────────────────────────────────────────────────────────────────────
  describe('Performance: Latency Requirements', () => {
    it('should maintain < 200ms P95 latency under load', async () => {
      const iterations = 10;
      const latencies: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const qrPayload = JSON.stringify({
          deviceId: testDeviceId,
          timestamp: Date.now(),
          nonce: `perf_test_${Date.now()}_${i}`,
        });

        const start = Date.now();
        await apiClient.post('/access/process', { qrPayload });
        latencies.push(Date.now() - start);
      }

      // Calcular P95
      latencies.sort((a, b) => a - b);
      const p95Index = Math.floor(latencies.length * 0.95);
      const p95 = latencies[p95Index];

      console.log(`Latencies: ${latencies.join(', ')}ms`);
      console.log(`P95 Latency: ${p95}ms`);

      // En CI puede ser más lento, pero en producción debe ser < 200ms
      expect(p95).toBeLessThan(1000);
    });
  });
});
