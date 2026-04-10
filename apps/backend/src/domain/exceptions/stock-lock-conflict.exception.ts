/**
 * ============================================================================
 * SMART_RETAIL - Stock Lock Conflict Exception
 * ============================================================================
 * Se lanza cuando hay un conflicto de lock (otro usuario ya bloqueó el stock).
 * 
 * Mapeo HTTP: 409 Conflict
 * Caso de Uso: CU-05 (Race Condition - Guerra de Clics)
 * ============================================================================
 */

import { DomainException } from './domain.exception';

export class StockLockConflictException extends DomainException {
  readonly code = 'STOCK_LOCK_CONFLICT';
  readonly httpStatus = 409; // Conflict

  readonly productId: string;
  readonly productSku: string;

  constructor(
    productId: string,
    sku: string,
  ) {
    super(
      `Product ${sku} is currently locked by another user. Please try again in a few seconds.`,
      {
        productId,
        sku,
        retryAfterSeconds: 5,
      },
    );

    this.productId = productId;
    this.productSku = sku;
  }
}
