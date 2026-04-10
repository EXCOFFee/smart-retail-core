/**
 * ============================================================================
 * SMART_RETAIL - Product Entity (Dominio Puro)
 * ============================================================================
 * Representa un producto/servicio disponible para compra.
 * 
 * ARQUITECTURA: Capa de DOMINIO 🟢
 * ⚠️ PROHIBIDO: Importar NestJS, TypeORM, o cualquier framework aquí.
 * ============================================================================
 */

import { StockInsufficientException } from '@domain/exceptions/stock-insufficient.exception';
import { Money } from '@domain/value-objects/money.value-object';

/**
 * Estados posibles de un producto
 */
export enum ProductStatus {
  /** Producto activo y disponible para venta */
  ACTIVE = 'ACTIVE',
  /** Producto pausado temporalmente (no visible en kiosco) */
  PAUSED = 'PAUSED',
  /** Producto descontinuado */
  DISCONTINUED = 'DISCONTINUED',
}

/**
 * Entidad de Producto del Dominio
 * 
 * Representa un ítem que puede ser adquirido a través del sistema.
 * Contiene la lógica de negocio relacionada con el stock.
 */
export class Product {
  readonly id: string;

  /**
   * SKU (Stock Keeping Unit) - Código único del producto
   * Por qué separado del ID: El SKU es visible al humano (etiquetas, QR),
   * mientras el ID es para uso interno del sistema.
   */
  readonly sku: string;

  /**
   * Nombre descriptivo del producto
   */
  readonly name: string;

  /**
   * Descripción extendida del producto (opcional)
   */
  readonly description?: string;

  /**
   * Precio de venta
   * Por qué Money VO: Evita errores de precisión con decimales.
   */
  private _price: Money;

  /**
   * Umbral para alerta de stock bajo
   */
  readonly lowStockThreshold: number;

  /**
   * Cantidad disponible en inventario
   * Por qué private: Solo se modifica a través de métodos de negocio
   * que garantizan la integridad del stock.
   */
  private _stockQuantity: number;

  /**
   * ID de la ubicación/local donde está el producto
   * Por qué: Multi-Location - El mismo SKU puede tener diferente stock
   * en cada sucursal.
   */
  readonly locationId: string;

  /**
   * Estado del producto
   */
  private _status: ProductStatus;

  /**
   * Si el producto está activo (visible y disponible para compra)
   */
  private _isActive: boolean;

  readonly createdAt: Date;
  private _updatedAt: Date;

  /**
   * Versión para Optimistic Locking
   * Por qué: Evita condiciones de carrera cuando dos procesos
   * intentan modificar el mismo producto simultáneamente.
   */
  private _version: number;

  constructor(props: {
    id: string;
    sku: string;
    name: string;
    description?: string;
    price: Money;
    stockQuantity: number;
    lowStockThreshold?: number;
    locationId: string;
    isActive?: boolean;
    status?: ProductStatus;
    createdAt?: Date;
    updatedAt?: Date;
    version?: number;
  }) {
    this.id = props.id;
    this.sku = props.sku;
    this.name = props.name;
    this.description = props.description;
    this._price = props.price;
    this._stockQuantity = props.stockQuantity;
    this.lowStockThreshold = props.lowStockThreshold ?? 10;
    this.locationId = props.locationId;
    this._isActive = props.isActive ?? true;
    this._status = props.status ?? ProductStatus.ACTIVE;
    this.createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();
    this._version = props.version ?? 1;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GETTERS
  // ─────────────────────────────────────────────────────────────────────────

  get price(): Money {
    return this._price;
  }

  get stockQuantity(): number {
    return this._stockQuantity;
  }

  get status(): ProductStatus {
    return this._status;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get version(): number {
    return this._version;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MÉTODOS DE NEGOCIO
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Verifica si hay stock suficiente para una cantidad solicitada.
   * 
   * @param quantity - Cantidad a verificar
   * @returns true si hay stock disponible
   */
  hasStock(quantity: number = 1): boolean {
    return this._stockQuantity >= quantity;
  }

  /**
   * Verifica si el producto está disponible para venta.
   * 
   * Por qué método separado: Combina estado + stock en una sola verificación.
   * 
   * @param quantity - Cantidad a verificar (default 1)
   * @returns true si está activo y tiene stock
   */
  isAvailableForSale(quantity: number = 1): boolean {
    return this._status === ProductStatus.ACTIVE && this.hasStock(quantity);
  }

  /**
   * Reserva stock (Soft Lock durante el proceso de pago).
   * 
   * Por qué "reservar" y no "descontar": El stock real se descuenta
   * solo cuando el pago es confirmado. Esto permite revertir si el pago falla.
   * 
   * NOTA: Esta operación es in-memory. El verdadero lock está en Redis
   * a nivel de adaptador para manejar concurrencia distribuida.
   * 
   * @param quantity - Cantidad a reservar
   * @throws StockInsufficientException si no hay stock
   */
  reserveStock(quantity: number): void {
    if (!this.hasStock(quantity)) {
      throw new StockInsufficientException(
        this.id,
        this.sku,
        this._stockQuantity,
        quantity,
      );
    }

    this._stockQuantity -= quantity;
    this._version += 1;
    this._updatedAt = new Date();
  }

  /**
   * Libera stock reservado (cuando el pago falla o el usuario cancela).
   * 
   * @param quantity - Cantidad a liberar
   */
  releaseStock(quantity: number): void {
    this._stockQuantity += quantity;
    this._version += 1;
    this._updatedAt = new Date();
  }

  /**
   * Ajuste manual de stock (inventario físico).
   * 
   * Por qué método separado de reserveStock: Esta operación es administrativa,
   * no transaccional. Debe generar un registro de auditoría diferente.
   * 
   * @param newQuantity - Nueva cantidad de stock
   */
  adjustStock(newQuantity: number): void {
    if (newQuantity < 0) {
      throw new Error('Stock cannot be negative');
    }

    this._stockQuantity = newQuantity;
    this._version += 1;
    this._updatedAt = new Date();
  }

  /**
   * Actualiza el precio del producto.
   * 
   * NOTA según CU-19: Los precios se "congelan" al momento del escaneo.
   * Este método solo afecta a futuras transacciones.
   * 
   * @param newPrice - Nuevo precio
   */
  updatePrice(newPrice: Money): void {
    this._price = newPrice;
    this._version += 1;
    this._updatedAt = new Date();
  }

  /**
   * Cambia el estado del producto.
   * 
   * @param newStatus - Nuevo estado
   */
  changeStatus(newStatus: ProductStatus): void {
    this._status = newStatus;
    this._updatedAt = new Date();
  }
}
