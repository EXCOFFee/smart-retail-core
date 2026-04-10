/**
 * ============================================================================
 * SMART_RETAIL - Mock Server for E2E Tests
 * ============================================================================
 * Servidor mock completo que simula el backend para tests E2E.
 * 
 * FEATURES:
 * - Endpoints de autenticación
 * - Endpoints de acceso/transacciones
 * - Simulación de Redis locks
 * - Respuestas configurables para diferentes escenarios
 * ============================================================================
 */

import http from 'http';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface MockUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  locationId: string;
  walletBalance: number;
}

interface MockDevice {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'maintenance';
  locationId: string;
}

interface MockProduct {
  id: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
}

interface Transaction {
  id: string;
  userId: string;
  deviceId: string;
  productId: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  createdAt: string;
}

interface UsedNonce {
  nonce: string;
  usedAt: number;
}

/**
 * Configuración de comportamiento del mock (para simular fallos).
 * CU-03: Simula timeouts de pasarela de pago.
 */
interface MockBehavior {
  /** Habilita timeout en la pasarela de pagos */
  paymentGatewayTimeout: boolean;
  /** Delay en ms antes de responder (0 = sin delay) */
  paymentGatewayDelayMs: number;
  /** Simula error de red en la pasarela */
  paymentGatewayNetworkError: boolean;
  /** Simula respuesta parcial (pago procesado pero sin confirmación) */
  paymentGatewayPartialResponse: boolean;
  /** Simula rollback automático después de timeout */
  autoRollbackOnTimeout: boolean;
  /** Timeout máximo en ms (default 30000) */
  timeoutThresholdMs: number;
}

const defaultBehavior: MockBehavior = {
  paymentGatewayTimeout: false,
  paymentGatewayDelayMs: 0,
  paymentGatewayNetworkError: false,
  paymentGatewayPartialResponse: false,
  autoRollbackOnTimeout: true,
  timeoutThresholdMs: 30000,
};

let currentBehavior: MockBehavior = { ...defaultBehavior };

/**
 * Registro de transacciones en estado pendiente (para cleanup).
 * CU-03: Necesario para detectar y limpiar locks huérfanos.
 */
interface PendingTransaction {
  transactionId: string;
  productId: string;
  userId: string;
  lockedAt: number;
  lockExpiresAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

const mockUsers: Map<string, MockUser> = new Map([
  [
    'test@smartretail.com',
    {
      id: 'user-001',
      email: 'test@smartretail.com',
      fullName: 'Usuario de Prueba',
      role: 'consumer',
      locationId: 'loc-001',
      walletBalance: 10000, // $100.00 en centavos
    },
  ],
  [
    'nobalance@smartretail.com',
    {
      id: 'user-002',
      email: 'nobalance@smartretail.com',
      fullName: 'Usuario Sin Saldo',
      role: 'consumer',
      locationId: 'loc-001',
      walletBalance: 0, // Sin saldo
    },
  ],
  [
    'admin@smartretail.com',
    {
      id: 'user-003',
      email: 'admin@smartretail.com',
      fullName: 'Administrador',
      role: 'admin',
      locationId: 'loc-001',
      walletBalance: 50000,
    },
  ],
]);

const mockDevices: Map<string, MockDevice> = new Map([
  [
    'device-001',
    {
      id: 'device-001',
      name: 'Molinete Principal',
      status: 'online',
      locationId: 'loc-001',
    },
  ],
  [
    'device-002',
    {
      id: 'device-002',
      name: 'Molinete Secundario',
      status: 'offline',
      locationId: 'loc-001',
    },
  ],
]);

const mockProducts: Map<string, MockProduct> = new Map([
  [
    'product-001',
    {
      id: 'product-001',
      sku: 'ENTRY-001',
      name: 'Entrada General',
      price: 500, // $5.00
      stock: 100,
    },
  ],
  [
    'product-002',
    {
      id: 'product-002',
      sku: 'ENTRY-VIP',
      name: 'Entrada VIP',
      price: 1500, // $15.00
      stock: 1, // Solo uno para test de race condition
    },
  ],
  [
    'product-003',
    {
      id: 'product-003',
      sku: 'ENTRY-NOSTOCK',
      name: 'Entrada Agotada',
      price: 500,
      stock: 0,
    },
  ],
]);

// Simular Redis: locks activos y nonces usados
const activeLocks: Map<string, { userId: string; expiresAt: number }> = new Map();
const usedNonces: UsedNonce[] = [];
const transactions: Map<string, Transaction> = new Map();

// CU-03: Transacciones pendientes (esperando confirmación de pasarela)
const pendingTransactions: Map<string, PendingTransaction> = new Map();

// Tokens válidos (simula JWT)
const validTokens: Map<string, string> = new Map(); // token -> userId

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function generateToken(userId: string): string {
  const token = `mock_token_${userId}_${Date.now()}`;
  validTokens.set(token, userId);
  return token;
}

function validateToken(authHeader: string | undefined): MockUser | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  
  const token = authHeader.substring(7);
  const userId = validTokens.get(token);
  
  if (!userId) return null;
  
  // Buscar usuario por ID
  for (const user of mockUsers.values()) {
    if (user.id === userId) return user;
  }
  
  return null;
}

function generateTransactionId(): string {
  return `txn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function isNonceUsed(nonce: string): boolean {
  // Limpiar nonces viejos (> 60 segundos)
  const now = Date.now();
  const validNonces = usedNonces.filter((n) => now - n.usedAt < 60000);
  usedNonces.length = 0;
  usedNonces.push(...validNonces);
  
  return usedNonces.some((n) => n.nonce === nonce);
}

function markNonceAsUsed(nonce: string): void {
  usedNonces.push({ nonce, usedAt: Date.now() });
}

function acquireLock(productId: string, userId: string): boolean {
  // Limpiar locks expirados
  const now = Date.now();
  for (const [key, lock] of activeLocks.entries()) {
    if (lock.expiresAt < now) {
      activeLocks.delete(key);
    }
  }
  
  // Verificar si ya hay un lock
  if (activeLocks.has(productId)) {
    return false; // Lock ya existe
  }
  
  // Crear nuevo lock (10 segundos TTL)
  activeLocks.set(productId, {
    userId,
    expiresAt: now + 10000,
  });
  
  return true;
}

function releaseLock(productId: string): void {
  activeLocks.delete(productId);
}

// ─────────────────────────────────────────────────────────────────────────────
// CU-03: PAYMENT GATEWAY SIMULATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simula una llamada a la pasarela de pagos (Mercado Pago, etc.)
 * 
 * @returns Promise que:
 * - Se resuelve con éxito si no hay problemas configurados
 * - Se rechaza con timeout si paymentGatewayTimeout está activo
 * - Se rechaza con error de red si paymentGatewayNetworkError está activo
 */
async function simulatePaymentGateway(
  userId: string,
  amount: number,
  transactionId: string,
): Promise<{ success: boolean; gatewayReference?: string; error?: string }> {
  // Aplicar delay si está configurado
  if (currentBehavior.paymentGatewayDelayMs > 0) {
    await new Promise((resolve) =>
      setTimeout(resolve, currentBehavior.paymentGatewayDelayMs),
    );
  }

  // Simular error de red
  if (currentBehavior.paymentGatewayNetworkError) {
    throw new Error('NETWORK_ERROR: Unable to reach payment gateway');
  }

  // Simular timeout (delay que excede el threshold)
  if (currentBehavior.paymentGatewayTimeout) {
    // En un caso real, esto causaría un timeout del cliente
    // Aquí devolvemos un error específico de timeout
    throw new Error('GATEWAY_TIMEOUT: Payment gateway did not respond in time');
  }

  // Simular respuesta parcial (pago procesado pero sin confirmación clara)
  if (currentBehavior.paymentGatewayPartialResponse) {
    return {
      success: false,
      error: 'PARTIAL_RESPONSE: Payment may have been processed, status unknown',
    };
  }

  // Respuesta exitosa normal
  return {
    success: true,
    gatewayReference: `MP_${Date.now()}_${transactionId.substring(0, 8)}`,
  };
}

/**
 * Cleanup de locks huérfanos (CU-03: Rollback automático).
 * Se ejecuta periódicamente o al detectar timeout.
 */
function cleanupOrphanedLocks(): void {
  const now = Date.now();

  for (const [transactionId, pending] of pendingTransactions.entries()) {
    if (pending.lockExpiresAt < now) {
      // Lock expirado - hacer rollback
      console.log(`[CU-03] Cleaning up orphaned lock for transaction ${transactionId}`);

      // Restaurar stock si es necesario
      const product = mockProducts.get(pending.productId);
      if (product) {
        product.stock += 1;
      }

      // Liberar lock
      releaseLock(pending.productId);

      // Marcar transacción como fallida
      const transaction = transactions.get(transactionId);
      if (transaction) {
        transaction.status = 'FAILED';
      }

      // Remover de pendientes
      pendingTransactions.delete(transactionId);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

function handleLogin(body: { email: string; password: string }): { status: number; data: unknown } {
  const user = mockUsers.get(body.email);
  
  if (!user || body.password !== 'TestPassword123!') {
    return {
      status: 401,
      data: { message: 'Credenciales inválidas', statusCode: 401 },
    };
  }
  
  const accessToken = generateToken(user.id);
  const refreshToken = `refresh_${accessToken}`;
  
  return {
    status: 200,
    data: {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        locationId: user.locationId,
      },
    },
  };
}

function handleGetDevices(user: MockUser): { status: number; data: unknown } {
  const devices = Array.from(mockDevices.values()).filter(
    (d) => d.locationId === user.locationId,
  );
  
  return {
    status: 200,
    data: { data: devices },
  };
}

function handleGetProductStock(productId: string): { status: number; data: unknown } {
  const product = mockProducts.get(productId);
  
  if (!product) {
    return {
      status: 404,
      data: { message: 'Producto no encontrado', statusCode: 404 },
    };
  }
  
  return {
    status: 200,
    data: { quantity: product.stock },
  };
}

function handleProcessAccess(
  user: MockUser,
  body: { qrPayload: string },
): Promise<{ status: number; data: unknown }> {
  return handleProcessAccessAsync(user, body);
}

async function handleProcessAccessAsync(
  user: MockUser,
  body: { qrPayload: string },
): Promise<{ status: number; data: unknown }> {
  let payload: { deviceId: string; productId?: string; timestamp: number; nonce: string };
  
  try {
    payload = JSON.parse(body.qrPayload);
  } catch {
    return {
      status: 400,
      data: { message: 'QR payload inválido', statusCode: 400 },
    };
  }
  
  // CU-08: Verificar timestamp (QR expirado si > 60s)
  const now = Date.now();
  if (now - payload.timestamp > 60000) {
    return {
      status: 403,
      data: { message: 'Código QR Expirado', statusCode: 403 },
    };
  }
  
  // CU-08: Verificar nonce (replay attack)
  if (isNonceUsed(payload.nonce)) {
    return {
      status: 403,
      data: { message: 'Código QR ya utilizado', statusCode: 403 },
    };
  }
  
  // Verificar dispositivo
  const device = mockDevices.get(payload.deviceId);
  if (!device) {
    return {
      status: 404,
      data: { message: 'Dispositivo no encontrado', statusCode: 404 },
    };
  }
  
  if (device.status !== 'online') {
    return {
      status: 503,
      data: { message: 'Dispositivo no disponible', statusCode: 503 },
    };
  }
  
  // Obtener producto (default al primero si no se especifica)
  const productId = payload.productId ?? 'product-001';
  const product = mockProducts.get(productId);
  
  if (!product) {
    return {
      status: 404,
      data: { message: 'Producto no encontrado', statusCode: 404 },
    };
  }
  
  // CU-05: Verificar stock y lock (race condition)
  if (product.stock <= 0) {
    return {
      status: 409,
      data: { message: 'Sin stock disponible', statusCode: 409 },
    };
  }
  
  // Intentar adquirir lock
  if (!acquireLock(productId, user.id)) {
    return {
      status: 409,
      data: { message: 'Producto en proceso de compra por otro usuario', statusCode: 409 },
    };
  }
  
  // CU-02: Verificar saldo
  if (user.walletBalance < product.price) {
    releaseLock(productId);
    return {
      status: 402,
      data: { message: 'Saldo insuficiente', statusCode: 402 },
    };
  }
  
  // Marcar nonce como usado
  markNonceAsUsed(payload.nonce);
  
  // Generar ID de transacción
  const transactionId = generateTransactionId();
  
  // CU-03: Registrar como transacción pendiente (antes de llamar a pasarela)
  const pendingTx: PendingTransaction = {
    transactionId,
    productId: product.id,
    userId: user.id,
    lockedAt: Date.now(),
    lockExpiresAt: Date.now() + currentBehavior.timeoutThresholdMs,
  };
  pendingTransactions.set(transactionId, pendingTx);

  // CU-03: Llamar a pasarela de pagos (puede fallar/timeout)
  try {
    const gatewayResult = await simulatePaymentGateway(
      user.id,
      product.price,
      transactionId,
    );

    if (!gatewayResult.success) {
      // Pago falló - rollback
      releaseLock(productId);
      pendingTransactions.delete(transactionId);
      
      return {
        status: 502,
        data: {
          message: gatewayResult.error ?? 'Error en pasarela de pagos',
          statusCode: 502,
          shouldRetry: true,
        },
      };
    }

    // Éxito - remover de pendientes
    pendingTransactions.delete(transactionId);

    // Procesar transacción exitosa
    const transaction: Transaction = {
      id: transactionId,
      userId: user.id,
      deviceId: device.id,
      productId: product.id,
      amount: product.price,
      status: 'PAID',
      createdAt: new Date().toISOString(),
    };
    
    transactions.set(transactionId, transaction);
    
    // Descontar stock
    product.stock -= 1;
    
    // Descontar saldo (en memoria)
    user.walletBalance -= product.price;
    
    // Liberar lock
    releaseLock(productId);
    
    return {
      status: 200,
      data: {
        success: true,
        transactionId,
        deviceCommand: 'OPEN',
        gatewayReference: gatewayResult.gatewayReference,
      },
    };
  } catch (error) {
    // CU-03: Timeout o error de red en pasarela
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (currentBehavior.autoRollbackOnTimeout) {
      // Rollback inmediato
      releaseLock(productId);
      pendingTransactions.delete(transactionId);
      
      // Marcar como fallida
      const failedTx: Transaction = {
        id: transactionId,
        userId: user.id,
        deviceId: device.id,
        productId: product.id,
        amount: product.price,
        status: 'FAILED',
        createdAt: new Date().toISOString(),
      };
      transactions.set(transactionId, failedTx);
    }
    // Si no hay auto-rollback, el lock permanece y será limpiado por cleanupOrphanedLocks
    
    const isTimeout = errorMessage.includes('TIMEOUT');
    const isNetworkError = errorMessage.includes('NETWORK');
    
    return {
      status: isTimeout ? 504 : 502,
      data: {
        message: isTimeout
          ? 'Tiempo de espera agotado en pasarela de pagos'
          : 'Error de conexión con pasarela de pagos',
        statusCode: isTimeout ? 504 : 502,
        transactionId,
        shouldRetry: isNetworkError,
        // CU-03: Información para el cliente sobre el estado
        lockReleased: currentBehavior.autoRollbackOnTimeout,
        retryAfterSeconds: isTimeout ? 30 : 5,
      },
    };
  }
}

function handleGetTransaction(transactionId: string): { status: number; data: unknown } {
  const transaction = transactions.get(transactionId);
  
  if (!transaction) {
    return {
      status: 404,
      data: { message: 'Transacción no encontrada', statusCode: 404 },
    };
  }
  
  return {
    status: 200,
    data: transaction,
  };
}

function handleHealth(): { status: number; data: unknown } {
  return {
    status: 200,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      uptime: process.uptime(),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK SERVER
// ─────────────────────────────────────────────────────────────────────────────

export class MockServer {
  private server: http.Server | null = null;
  private port: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(port = 3001) {
    this.port = port;
  }

  /**
   * Configura el comportamiento del mock (para simular fallos).
   * CU-03: Usa esto para simular timeouts de pasarela de pago.
   * 
   * @example
   * // Simular timeout de Mercado Pago
   * mockServer.setBehavior({ paymentGatewayTimeout: true });
   * 
   * @example
   * // Simular latencia alta (pero sin timeout)
   * mockServer.setBehavior({ paymentGatewayDelayMs: 5000 });
   */
  setBehavior(behavior: Partial<MockBehavior>): void {
    currentBehavior = { ...currentBehavior, ...behavior };
  }

  /**
   * Obtiene el comportamiento actual del mock.
   */
  getBehavior(): MockBehavior {
    return { ...currentBehavior };
  }

  /**
   * Obtiene las transacciones pendientes (útil para tests).
   */
  getPendingTransactions(): PendingTransaction[] {
    return Array.from(pendingTransactions.values());
  }

  /**
   * Fuerza la limpieza de locks huérfanos.
   */
  forceCleanupOrphanedLocks(): void {
    cleanupOrphanedLocks();
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        let body = '';
        
        req.on('data', (chunk) => {
          body += chunk.toString();
        });
        
        req.on('end', () => {
          this.handleRequest(req, res, body);
        });
      });

      // CU-03: Iniciar limpieza periódica de locks huérfanos (cada 10s)
      this.cleanupInterval = setInterval(() => {
        cleanupOrphanedLocks();
      }, 10000);

      this.server.listen(this.port, () => {
        console.log(`Mock server running on port ${this.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // Limpiar intervalo de cleanup
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }

      if (this.server) {
        this.server.close(() => {
          console.log('Mock server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  reset(): void {
    // Limpiar estado
    activeLocks.clear();
    usedNonces.length = 0;
    transactions.clear();
    validTokens.clear();
    pendingTransactions.clear();
    
    // Restaurar comportamiento por defecto
    currentBehavior = { ...defaultBehavior };
    
    // Restaurar stock inicial
    const product002 = mockProducts.get('product-002');
    if (product002) product002.stock = 1;
    
    const product001 = mockProducts.get('product-001');
    if (product001) product001.stock = 100;
    
    // Restaurar saldo
    const testUser = mockUsers.get('test@smartretail.com');
    if (testUser) testUser.walletBalance = 10000;
  }

  private handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    body: string,
  ): void {
    // Llamar al handler async
    this.handleRequestAsync(req, res, body).catch((error) => {
      console.error('Unhandled error in request handler:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ message: 'Error interno del servidor', statusCode: 500 }));
    });
  }

  private async handleRequestAsync(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    body: string,
  ): Promise<void> {
    const url = req.url ?? '';
    const method = req.method ?? 'GET';
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Type', 'application/json');
    
    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    let result: { status: number; data: unknown };
    
    try {
      const parsedBody = body ? JSON.parse(body) : {};
      
      // Health check (no auth required)
      if (url === '/api/v1/health' && method === 'GET') {
        result = handleHealth();
      }
      // Login (no auth required)
      else if (url === '/api/v1/auth/login' && method === 'POST') {
        result = handleLogin(parsedBody);
      }
      // Protected routes
      else {
        const user = validateToken(req.headers.authorization);
        
        if (!user) {
          result = { status: 401, data: { message: 'No autorizado', statusCode: 401 } };
        } else if (url === '/api/v1/devices' && method === 'GET') {
          result = handleGetDevices(user);
        } else if (url.match(/^\/api\/v1\/products\/[\w-]+\/stock$/) && method === 'GET') {
          const productId = url.split('/')[4];
          result = handleGetProductStock(productId);
        } else if (url === '/api/v1/access/process' && method === 'POST') {
          // handleProcessAccess devuelve una promesa ahora (CU-03)
          result = await handleProcessAccess(user, parsedBody);
        } else if (url.match(/^\/api\/v1\/transactions\/[\w-]+$/) && method === 'GET') {
          const transactionId = url.split('/')[4];
          result = handleGetTransaction(transactionId);
        } else {
          result = { status: 404, data: { message: 'Endpoint no encontrado', statusCode: 404 } };
        }
      }
    } catch (error) {
      result = {
        status: 500,
        data: { message: 'Error interno del servidor', statusCode: 500 },
      };
    }
    
    res.writeHead(result.status);
    res.end(JSON.stringify(result.data));
  }
}

// Export singleton para tests
export const mockServer = new MockServer();
