/**
 * ============================================================================
 * SMART_RETAIL - Critical Path E2E Tests (With Mocks)
 * ============================================================================
 * Tests de integración para el flujo crítico: QR → Backend → Device
 * 
 * IMPLEMENTA: CU-01, CU-02, CU-05, CU-08, CU-18
 * 
 * ESTRATEGIA:
 * - Usa MockServer para simular el backend
 * - Usa MockWebSocketGateway para simular IoT
 * - Tests aislados y repetibles sin dependencias externas
 * ============================================================================
 */

import axios, { AxiosInstance } from 'axios';

import { mockServer } from '../mocks/server';

// ─────────────────────────────────────────────────────────────────────────────
// TEST SETUP
// ─────────────────────────────────────────────────────────────────────────────

describe('Critical Path: Access Flow (E2E with Mocks)', () => {
  let apiClient: AxiosInstance;
  let authToken: string;
  let testDeviceId: string;

  const MOCK_API_URL = 'http://localhost:3001/api/v1';

  beforeAll(async () => {
    // Iniciar servidor mock
    await mockServer.start();

    apiClient = axios.create({
      baseURL: MOCK_API_URL,
      timeout: 10000,
      validateStatus: () => true, // No lanzar en errores HTTP
    });

    // Autenticarse con usuario de prueba
    const loginResponse = await apiClient.post('/auth/login', {
      email: 'test@smartretail.com',
      password: 'TestPassword123!',
    });

    expect(loginResponse.status).toBe(200);
    authToken = loginResponse.data.accessToken;

    apiClient.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;

    // Obtener dispositivo de prueba
    const devicesResponse = await apiClient.get('/devices');
    testDeviceId = devicesResponse.data.data[0]?.id ?? 'device-001';
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  beforeEach(() => {
    // Resetear estado entre tests
    mockServer.reset();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CU-01: Proceso de Compra Exitoso (Happy Path)
  // ─────────────────────────────────────────────────────────────────────────
  describe('CU-01: Proceso de Compra Exitoso', () => {
    it('should process access successfully and return transaction ID', async () => {
      // Arrange
      const qrPayload = JSON.stringify({
        deviceId: testDeviceId,
        productId: 'product-001',
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
      expect(response.data.deviceCommand).toBe('OPEN');

      // Log latency para análisis
      console.log(`[CU-01] Latency: ${latency}ms`);
    });

    it('should decrement stock atomically after successful purchase', async () => {
      // Arrange: obtener stock inicial
      const productId = 'product-001';
      const initialStockResponse = await apiClient.get(`/products/${productId}/stock`);
      const initialStock = initialStockResponse.data.quantity;

      // Act: procesar acceso
      const qrPayload = JSON.stringify({
        deviceId: testDeviceId,
        productId,
        timestamp: Date.now(),
        nonce: `stock_test_${Date.now()}`,
      });
      const accessResponse = await apiClient.post('/access/process', { qrPayload });
      expect(accessResponse.status).toBe(200);

      // Assert: stock debe haber disminuido en 1
      const finalStockResponse = await apiClient.get(`/products/${productId}/stock`);
      expect(finalStockResponse.data.quantity).toBe(initialStock - 1);
    });

    it('should create transaction with PAID status', async () => {
      // Arrange
      const qrPayload = JSON.stringify({
        deviceId: testDeviceId,
        timestamp: Date.now(),
        nonce: `txn_status_${Date.now()}`,
      });

      // Act
      const response = await apiClient.post('/access/process', { qrPayload });
      expect(response.status).toBe(200);

      // Assert
      const transactionResponse = await apiClient.get(
        `/transactions/${response.data.transactionId}`,
      );
      expect(transactionResponse.status).toBe(200);
      expect(transactionResponse.data.status).toBe('PAID');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CU-02: Rechazo por Fondos Insuficientes
  // ─────────────────────────────────────────────────────────────────────────
  describe('CU-02: Rechazo por Fondos Insuficientes', () => {
    it('should reject with 402 when user has insufficient balance', async () => {
      // Arrange: login con usuario sin saldo
      const noBalanceClient = axios.create({
        baseURL: MOCK_API_URL,
        timeout: 10000,
        validateStatus: () => true,
      });

      const loginResponse = await noBalanceClient.post('/auth/login', {
        email: 'nobalance@smartretail.com',
        password: 'TestPassword123!',
      });

      expect(loginResponse.status).toBe(200);
      noBalanceClient.defaults.headers.common['Authorization'] =
        `Bearer ${loginResponse.data.accessToken}`;

      const qrPayload = JSON.stringify({
        deviceId: testDeviceId,
        timestamp: Date.now(),
        nonce: `no_balance_${Date.now()}`,
      });

      // Act
      const response = await noBalanceClient.post('/access/process', { qrPayload });

      // Assert
      expect(response.status).toBe(402);
      expect(response.data.message).toContain('insuficiente');
    });

    it('should not decrement stock on payment failure', async () => {
      // Arrange
      const productId = 'product-001';
      const initialStockResponse = await apiClient.get(`/products/${productId}/stock`);
      const initialStock = initialStockResponse.data.quantity;

      // Login con usuario sin saldo
      const noBalanceClient = axios.create({
        baseURL: MOCK_API_URL,
        timeout: 10000,
        validateStatus: () => true,
      });

      await noBalanceClient.post('/auth/login', {
        email: 'nobalance@smartretail.com',
        password: 'TestPassword123!',
      }).then((res) => {
        noBalanceClient.defaults.headers.common['Authorization'] =
          `Bearer ${res.data.accessToken}`;
      });

      const qrPayload = JSON.stringify({
        deviceId: testDeviceId,
        productId,
        timestamp: Date.now(),
        nonce: `no_stock_change_${Date.now()}`,
      });

      // Act: intentar compra (fallará)
      await noBalanceClient.post('/access/process', { qrPayload });

      // Assert: stock debe permanecer igual
      const finalStockResponse = await apiClient.get(`/products/${productId}/stock`);
      expect(finalStockResponse.data.quantity).toBe(initialStock);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CU-05: Race Condition (Guerra de Clics)
  // ─────────────────────────────────────────────────────────────────────────
  describe('CU-05: Race Condition Handling', () => {
    it('should reject concurrent requests for last unit of product', async () => {
      // Arrange: producto con stock = 1
      const limitedProductId = 'product-002';

      const qrPayload1 = JSON.stringify({
        deviceId: testDeviceId,
        productId: limitedProductId,
        timestamp: Date.now(),
        nonce: `race_1_${Date.now()}`,
      });

      const qrPayload2 = JSON.stringify({
        deviceId: testDeviceId,
        productId: limitedProductId,
        timestamp: Date.now(),
        nonce: `race_2_${Date.now()}`,
      });

      // Act: enviar ambas requests simultáneamente
      const [result1, result2] = await Promise.all([
        apiClient.post('/access/process', { qrPayload: qrPayload1 }),
        apiClient.post('/access/process', { qrPayload: qrPayload2 }),
      ]);

      // Assert: una debe tener éxito, la otra debe fallar con 409
      const statuses = [result1.status, result2.status].sort();
      
      expect(statuses).toContain(200);
      expect(statuses).toContain(409);

      // Verificar mensaje de error
      const failedResult = result1.status === 409 ? result1 : result2;
      expect(failedResult.data.message).toContain('en proceso de compra');
    });

    it('should handle sequential requests correctly after lock release', async () => {
      // Arrange
      const productId = 'product-001';

      // Primera compra exitosa
      const qrPayload1 = JSON.stringify({
        deviceId: testDeviceId,
        productId,
        timestamp: Date.now(),
        nonce: `seq_1_${Date.now()}`,
      });

      const response1 = await apiClient.post('/access/process', { qrPayload: qrPayload1 });
      expect(response1.status).toBe(200);

      // Segunda compra también debe ser exitosa (lock liberado)
      const qrPayload2 = JSON.stringify({
        deviceId: testDeviceId,
        productId,
        timestamp: Date.now(),
        nonce: `seq_2_${Date.now()}`,
      });

      const response2 = await apiClient.post('/access/process', { qrPayload: qrPayload2 });
      expect(response2.status).toBe(200);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CU-08: QR Expirado (Replay Attack Prevention)
  // ─────────────────────────────────────────────────────────────────────────
  describe('CU-08: Replay Attack Prevention', () => {
    it('should reject expired QR codes (> 60s old)', async () => {
      // Arrange: QR con timestamp de hace 2 minutos
      const expiredTimestamp = Date.now() - 120000;
      const qrPayload = JSON.stringify({
        deviceId: testDeviceId,
        timestamp: expiredTimestamp,
        nonce: `expired_${Date.now()}`,
      });

      // Act
      const response = await apiClient.post('/access/process', { qrPayload });

      // Assert
      expect(response.status).toBe(403);
      expect(response.data.message).toContain('Expirado');
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
      const response1 = await apiClient.post('/access/process', { qrPayload });
      expect(response1.status).toBe(200);

      // Para el segundo request, necesitamos un timestamp nuevo pero mismo nonce
      const qrPayload2 = JSON.stringify({
        deviceId: testDeviceId,
        timestamp: Date.now(),
        nonce, // Mismo nonce
      });

      // Act: segunda request debe fallar
      const response2 = await apiClient.post('/access/process', { qrPayload: qrPayload2 });

      // Assert
      expect(response2.status).toBe(403);
      expect(response2.data.message).toContain('ya utilizado');
    });

    it('should accept QR with valid timestamp (< 60s)', async () => {
      // Arrange: QR con timestamp reciente
      const recentTimestamp = Date.now() - 30000; // 30 segundos atrás
      const qrPayload = JSON.stringify({
        deviceId: testDeviceId,
        timestamp: recentTimestamp,
        nonce: `recent_${Date.now()}`,
      });

      // Act
      const response = await apiClient.post('/access/process', { qrPayload });

      // Assert
      expect(response.status).toBe(200);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CU-03: Sin Stock
  // ─────────────────────────────────────────────────────────────────────────
  describe('CU-03: Out of Stock Handling', () => {
    it('should reject with 409 when product has no stock', async () => {
      // Arrange: producto sin stock
      const noStockProductId = 'product-003';
      const qrPayload = JSON.stringify({
        deviceId: testDeviceId,
        productId: noStockProductId,
        timestamp: Date.now(),
        nonce: `no_stock_${Date.now()}`,
      });

      // Act
      const response = await apiClient.post('/access/process', { qrPayload });

      // Assert
      expect(response.status).toBe(409);
      expect(response.data.message).toContain('stock');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Device Status Tests
  // ─────────────────────────────────────────────────────────────────────────
  describe('Device Status Validation', () => {
    it('should reject access to offline device', async () => {
      // Arrange: usar dispositivo offline
      const offlineDeviceId = 'device-002';
      const qrPayload = JSON.stringify({
        deviceId: offlineDeviceId,
        timestamp: Date.now(),
        nonce: `offline_device_${Date.now()}`,
      });

      // Act
      const response = await apiClient.post('/access/process', { qrPayload });

      // Assert
      expect(response.status).toBe(503);
      expect(response.data.message).toContain('no disponible');
    });

    it('should reject access to unknown device', async () => {
      // Arrange: dispositivo inexistente
      const unknownDeviceId = 'device-unknown';
      const qrPayload = JSON.stringify({
        deviceId: unknownDeviceId,
        timestamp: Date.now(),
        nonce: `unknown_device_${Date.now()}`,
      });

      // Act
      const response = await apiClient.post('/access/process', { qrPayload });

      // Assert
      expect(response.status).toBe(404);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Authentication Tests
  // ─────────────────────────────────────────────────────────────────────────
  describe('Authentication Validation', () => {
    it('should reject unauthenticated requests', async () => {
      // Arrange: cliente sin token
      const unauthClient = axios.create({
        baseURL: MOCK_API_URL,
        timeout: 10000,
        validateStatus: () => true,
      });

      const qrPayload = JSON.stringify({
        deviceId: testDeviceId,
        timestamp: Date.now(),
        nonce: `unauth_${Date.now()}`,
      });

      // Act
      const response = await unauthClient.post('/access/process', { qrPayload });

      // Assert
      expect(response.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      // Arrange: cliente con token inválido
      const invalidTokenClient = axios.create({
        baseURL: MOCK_API_URL,
        timeout: 10000,
        validateStatus: () => true,
        headers: {
          Authorization: 'Bearer invalid_token_12345',
        },
      });

      const qrPayload = JSON.stringify({
        deviceId: testDeviceId,
        timestamp: Date.now(),
        nonce: `invalid_token_${Date.now()}`,
      });

      // Act
      const response = await invalidTokenClient.post('/access/process', { qrPayload });

      // Assert
      expect(response.status).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Health Check
  // ─────────────────────────────────────────────────────────────────────────
  describe('Health Check Endpoint', () => {
    it('should return healthy status', async () => {
      // Act
      const response = await apiClient.get('/health');

      // Assert
      expect(response.status).toBe(200);
      expect(response.data.status).toBe('ok');
      expect(response.data.version).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Performance: Latency Requirements
  // ─────────────────────────────────────────────────────────────────────────
  describe('Performance: Latency Requirements', () => {
    it('should maintain acceptable latency under sequential load', async () => {
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

      // Calcular estadísticas
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      latencies.sort((a, b) => a - b);
      const p95Index = Math.floor(latencies.length * 0.95);
      const p95 = latencies[p95Index];

      console.log(`[Performance] Latencies: ${latencies.join(', ')}ms`);
      console.log(`[Performance] Average: ${avg.toFixed(2)}ms`);
      console.log(`[Performance] P95: ${p95}ms`);

      // Mock server debería responder muy rápido
      expect(avg).toBeLessThan(100);
      expect(p95).toBeLessThan(200);
    });
  });
});
