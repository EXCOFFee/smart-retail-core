/**
 * ============================================================================
 * SMART_RETAIL - Application Layer (Barrel Export)
 * ============================================================================
 * Exporta toda la capa de aplicación: ports y use-cases.
 * 
 * ARQUITECTURA: Capa de APLICACIÓN 🟠
 * ============================================================================
 */

// Ports (Interfaces)
export * from './ports/input/process-access.use-case';
export * from './ports/output/device-gateway.port';
export * from './ports/output/payment-gateway.port';
export * from './ports/output/repositories.port';
export * from './ports/output/stock-cache.port';

// Use Cases (Implementations)
export * from './use-cases';
