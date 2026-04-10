/**
 * ============================================================================
 * SMART_RETAIL - IProcessAccessUseCase (Input Port)
 * ============================================================================
 * Puerto de entrada para el caso de uso principal: Procesar Acceso/Compra.
 * 
 * ARQUITECTURA: Capa de APLICACIÓN 🟠 (ports/input)
 * 
 * Por qué Input Port: Define el contrato que los Controllers/Gateways
 * usan para invocar la lógica de negocio. Desacopla la infraestructura
 * de la lógica de aplicación.
 * ============================================================================
 */

/**
 * DTO de entrada para procesar una solicitud de acceso.
 * 
 * Por qué DTO puro: No usa decoradores de class-validator aquí.
 * La validación ocurre en el Controller antes de llegar al Use Case.
 */
export interface ProcessAccessInput {
  /** ID del usuario que solicita acceso */
  userId: string;

  /** ID del dispositivo objetivo */
  deviceId: string;

  /** ID del producto a comprar (opcional si es solo acceso) */
  productId?: string;

  /** Cantidad de productos */
  quantity?: number;

  /**
   * Payload del QR escaneado (para validar timestamp y nonce)
   * Por qué: Previene replay attacks (CU-08)
   */
  qrPayload?: {
    timestamp: Date;
    nonce: string;
  };

  /** ID de trazabilidad para logs */
  traceId: string;
}

/**
 * DTO de salida del proceso de acceso.
 */
export interface ProcessAccessOutput {
  /** ID de la transacción creada */
  transactionId: string;

  /** Estado resultante */
  status: 'COMPLETED' | 'PENDING_PAYMENT' | 'FAILED';

  /** Mensaje para mostrar al usuario */
  message: string;

  /** Precio cobrado (si aplica) */
  amountCharged?: {
    cents: number;
    formatted: string;
  };

  /** Tiempo total de procesamiento (para métricas) */
  processingTimeMs: number;
}

/**
 * Puerto de entrada para el caso de uso de Procesamiento de Acceso.
 * 
 * Este es el contrato que implementa el ProcessAccessService
 * y que consumen los Controllers.
 */
export interface IProcessAccessUseCase {
  /**
   * Ejecuta el flujo completo de validación y acceso.
   * 
   * Este método orquesta:
   * 1. Validación de QR (anti-replay)
   * 2. Verificación de stock (Redis)
   * 3. Bloqueo de stock (Soft Lock)
   * 4. Procesamiento de pago (Pasarela)
   * 5. Envío de señal al dispositivo (WebSocket)
   * 
   * @param input - Datos de la solicitud
   * @returns Resultado del procesamiento
   * @throws DomainException si alguna validación falla
   */
  execute(input: ProcessAccessInput): Promise<ProcessAccessOutput>;
}

/**
 * Token de inyección para NestJS DI.
 * 
 * Por qué constante: TypeScript interfaces no existen en runtime.
 * Necesitamos un token string para que NestJS resuelva la dependencia.
 * 
 * Uso: @Inject(PROCESS_ACCESS_USE_CASE)
 */
export const PROCESS_ACCESS_USE_CASE = 'IProcessAccessUseCase';
