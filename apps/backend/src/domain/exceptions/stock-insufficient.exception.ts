/**
 * ============================================================================
 * SMART_RETAIL - Stock Insufficient Exception
 * ============================================================================
 * Se lanza cuando no hay stock suficiente para completar una operación.
 * 
 * Mapeo HTTP: 409 Conflict
 * Caso de Uso: CU-05 (Race Condition - Guerra de Clics)
 * ============================================================================
 */

import { DomainException } from './domain.exception';

export class StockInsufficientException extends DomainException {
  readonly code = 'STOCK_INSUFFICIENT';
  readonly httpStatus = 409; // Conflict

  readonly productId: string;
  readonly productSku: string;
  readonly availableStock: number;
  readonly requestedQuantity: number;

  constructor(
    productId: string,
    sku: string,
    currentStock: number,
    requestedQuantity: number,
  ) {
    super(
      `Product ${sku} has insufficient stock. Available: ${currentStock}, Requested: ${requestedQuantity}`,
      {
        productId,
        sku,
        currentStock,
        requestedQuantity,
      },
    );

    this.productId = productId;
    this.productSku = sku;
    this.availableStock = currentStock;
    this.requestedQuantity = requestedQuantity;
  }
}
