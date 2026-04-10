/**
 * ============================================================================
 * SMART_RETAIL - Payment Gateway Timeout E2E Tests (CU-03)
 * ============================================================================
 * Tests para simular y manejar timeouts de pasarelas de pago.
 * 
 * ESCENARIO REAL: Un día Mercado Pago está lento o caído.
 * - El usuario escanea el QR y la petición queda colgada
 * - El stock se bloquea con un lock
 * - Si no manejamos el timeout, el lock queda huérfano para siempre
 * 
 * SOLUCIÓN IMPLEMENTADA:
 * - Timeout configurable en la pasarela
 * - Rollback automático cuando detectamos timeout
 * - Limpieza periódica de locks huérfanos
 * - Información clara al usuario sobre qué hacer
 * ============================================================================
 */

import axios, { AxiosInstance } from 'axios';

import { mockServer } from '../mocks/server';

describe('CU-03: Payment Gateway Timeout Handling', () => {
  let apiClient: AxiosInstance;
  let authToken: string;

  const MOCK_API_URL = 'http://localhost:3001/api/v1';

  beforeAll(async () => {
    await mockServer.start();

    apiClient = axios.create({
      baseURL: MOCK_API_URL,
      timeout: 60000, // 60s para permitir delays en tests
      validateStatus: () => true,
    });

    // Autenticarse
    const loginResponse = await apiClient.post('/auth/login', {
      email: 'test@smartretail.com',
      password: 'TestPassword123!',
    });

    authToken = loginResponse.data.accessToken;
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  beforeEach(() => {
    mockServer.reset();
  });

  describe('Timeout de Pasarela de Pagos', () => {
    it('should return 504 when payment gateway times out', async () => {
      /**
       * ESCENARIO: Mercado Pago no responde en el tiempo esperado.
       * 
       * COMPORTAMIENTO ESPERADO:
       * - Respuesta 504 Gateway Timeout
       * - Mensaje claro sobre el problema
       * - Lock liberado para que el usuario pueda reintentar
       */
      
      // Configurar timeout en la pasarela
      mockServer.setBehavior({ paymentGatewayTimeout: true });

      const qrPayload = JSON.stringify({
        deviceId: 'device-001',
        productId: 'product-001',
        timestamp: Date.now(),
        nonce: `timeout_test_${Date.now()}`,
      });

      const response = await apiClient.post('/access/process', { qrPayload });

      expect(response.status).toBe(504);
      expect(response.data.message).toContain('Tiempo de espera agotado');
      expect(response.data.lockReleased).toBe(true); // Lock liberado para reintentar
      expect(response.data.retryAfterSeconds).toBeDefined();
    });

    it('should automatically rollback stock lock on timeout', async () => {
      /**
       * ESCENARIO: El timeout ocurre después de adquirir el lock.
       * 
       * COMPORTAMIENTO ESPERADO:
       * - El lock debe ser liberado automáticamente
       * - El stock no debe quedar bloqueado
       * - Otro usuario puede intentar comprar inmediatamente
       */
      
      mockServer.setBehavior({ paymentGatewayTimeout: true });

      // Primer intento: timeout
      const qrPayload1 = JSON.stringify({
        deviceId: 'device-001',
        productId: 'product-002', // Solo 1 unidad en stock
        timestamp: Date.now(),
        nonce: `timeout_rollback_1_${Date.now()}`,
      });

      const response1 = await apiClient.post('/access/process', { qrPayload1 });
      expect(response1.status).toBe(504);

      // Resetear comportamiento normal
      mockServer.setBehavior({ paymentGatewayTimeout: false });

      // Segundo intento: debería poder comprar porque el lock se liberó
      const qrPayload2 = JSON.stringify({
        deviceId: 'device-001',
        productId: 'product-002',
        timestamp: Date.now(),
        nonce: `timeout_rollback_2_${Date.now()}`,
      });

      const response2 = await apiClient.post('/access/process', { qrPayload: qrPayload2 });
      
      // Debería ser exitoso o al menos no estar bloqueado
      expect(response2.status).not.toBe(409); // No "en proceso por otro usuario"
    });

    it('should return transaction ID even on timeout for tracking', async () => {
      /**
       * Por qué: El usuario necesita un ID para poder verificar
       * el estado de su transacción más tarde si la pasarela
       * finalmente procesó el pago.
       */
      
      mockServer.setBehavior({ paymentGatewayTimeout: true });

      const qrPayload = JSON.stringify({
        deviceId: 'device-001',
        timestamp: Date.now(),
        nonce: `timeout_tracking_${Date.now()}`,
      });

      const response = await apiClient.post('/access/process', { qrPayload });

      expect(response.status).toBe(504);
      expect(response.data.transactionId).toBeDefined();
      expect(response.data.transactionId).toMatch(/^txn-/);
    });
  });

  describe('Error de Red en Pasarela', () => {
    it('should return 502 when payment gateway is unreachable', async () => {
      /**
       * ESCENARIO: La pasarela de pagos no está accesible (caída, DNS, etc.)
       */
      
      mockServer.setBehavior({ paymentGatewayNetworkError: true });

      const qrPayload = JSON.stringify({
        deviceId: 'device-001',
        timestamp: Date.now(),
        nonce: `network_error_${Date.now()}`,
      });

      const response = await apiClient.post('/access/process', { qrPayload });

      expect(response.status).toBe(502);
      expect(response.data.message).toContain('Error de conexión');
      expect(response.data.shouldRetry).toBe(true);
    });

    it('should suggest retry for network errors', async () => {
      mockServer.setBehavior({ paymentGatewayNetworkError: true });

      const qrPayload = JSON.stringify({
        deviceId: 'device-001',
        timestamp: Date.now(),
        nonce: `network_retry_${Date.now()}`,
      });

      const response = await apiClient.post('/access/process', { qrPayload });

      expect(response.data.shouldRetry).toBe(true);
      expect(response.data.retryAfterSeconds).toBe(5); // Retry rápido para errores de red
    });
  });

  describe('Respuesta Parcial de Pasarela', () => {
    it('should handle ambiguous gateway response', async () => {
      /**
       * ESCENARIO: La pasarela responde pero el estado es ambiguo.
       * Ejemplo: "La transacción puede haber sido procesada, verifique más tarde"
       * 
       * Este es el caso más peligroso: el pago puede haberse cobrado
       * pero no tenemos confirmación.
       */
      
      mockServer.setBehavior({ paymentGatewayPartialResponse: true });

      const qrPayload = JSON.stringify({
        deviceId: 'device-001',
        timestamp: Date.now(),
        nonce: `partial_response_${Date.now()}`,
      });

      const response = await apiClient.post('/access/process', { qrPayload });

      expect(response.status).toBe(502);
      expect(response.data.message).toContain('pasarela de pagos');
      expect(response.data.shouldRetry).toBe(true);
    });
  });

  describe('Latencia Alta (sin timeout)', () => {
    it('should complete successfully with high latency', async () => {
      /**
       * ESCENARIO: La pasarela está lenta pero responde.
       * No debería fallar, solo tomar más tiempo.
       */
      
      // 1 segundo de delay (pero no timeout)
      mockServer.setBehavior({ paymentGatewayDelayMs: 1000 });

      const qrPayload = JSON.stringify({
        deviceId: 'device-001',
        timestamp: Date.now(),
        nonce: `high_latency_${Date.now()}`,
      });

      const startTime = Date.now();
      const response = await apiClient.post('/access/process', { qrPayload });
      const elapsed = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(elapsed).toBeGreaterThanOrEqual(1000); // Al menos 1 segundo de delay
    });
  });

  describe('Limpieza de Locks Huérfanos', () => {
    it('should clean up orphaned locks after timeout', async () => {
      /**
       * ESCENARIO: Un lock quedó huérfano por alguna razón.
       * El sistema debe limpiarlo automáticamente.
       * 
       * Nota: En este test verificamos que la función existe y funciona.
       * En producción, esto se ejecuta en background.
       */
      
      // Desactivar auto-rollback para crear un lock huérfano
      mockServer.setBehavior({ 
        paymentGatewayTimeout: true,
        autoRollbackOnTimeout: false,
        timeoutThresholdMs: 100, // Muy corto para el test
      });

      const qrPayload = JSON.stringify({
        deviceId: 'device-001',
        productId: 'product-002',
        timestamp: Date.now(),
        nonce: `orphan_lock_${Date.now()}`,
      });

      await apiClient.post('/access/process', { qrPayload });

      // Verificar que hay una transacción pendiente
      const pendingBefore = mockServer.getPendingTransactions();
      expect(pendingBefore.length).toBeGreaterThan(0);

      // Esperar a que expire el lock
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Forzar limpieza
      mockServer.forceCleanupOrphanedLocks();

      // Verificar que se limpió
      const pendingAfter = mockServer.getPendingTransactions();
      expect(pendingAfter.length).toBe(0);
    });
  });

  describe('Información al Usuario', () => {
    it('should provide clear retry guidance on timeout', async () => {
      mockServer.setBehavior({ paymentGatewayTimeout: true });

      const qrPayload = JSON.stringify({
        deviceId: 'device-001',
        timestamp: Date.now(),
        nonce: `user_info_${Date.now()}`,
      });

      const response = await apiClient.post('/access/process', { qrPayload });

      // La respuesta debe incluir toda la información que el usuario necesita
      expect(response.data).toHaveProperty('message');
      expect(response.data).toHaveProperty('transactionId');
      expect(response.data).toHaveProperty('lockReleased');
      expect(response.data).toHaveProperty('retryAfterSeconds');

      // El mensaje debe ser comprensible
      expect(response.data.message).not.toContain('GATEWAY_TIMEOUT'); // No errores técnicos
      expect(response.data.message).toContain('Tiempo de espera');
    });

    it('should return 30 second retry delay for timeouts', async () => {
      /**
       * Por qué 30 segundos: Dar tiempo a que la pasarela se recupere.
       * Si el usuario reintenta inmediatamente, probablemente fallará otra vez.
       */
      
      mockServer.setBehavior({ paymentGatewayTimeout: true });

      const qrPayload = JSON.stringify({
        deviceId: 'device-001',
        timestamp: Date.now(),
        nonce: `retry_delay_${Date.now()}`,
      });

      const response = await apiClient.post('/access/process', { qrPayload });

      expect(response.data.retryAfterSeconds).toBe(30);
    });
  });
});
