/**
 * ============================================================================
 * SMART_RETAIL - Product Entity Tests
 * ============================================================================
 * Tests unitarios para la entidad Product.
 * 
 * Por qué: Validar lógica de negocio de stock y estados del producto.
 * ============================================================================
 */

import { Product, ProductStatus } from '../../../src/domain/entities/product.entity';
import { Money } from '../../../src/domain/value-objects/money.value-object';

describe('Product Entity', () => {
  const createProduct = (overrides = {}) => {
    return new Product({
      id: 'prod-123',
      sku: 'AGUA-500ML',
      name: 'Agua Mineral 500ml',
      description: 'Agua mineral natural',
      price: Money.fromCents(100),
      stockQuantity: 50,
      lowStockThreshold: 10,
      locationId: 'loc-001',
      ...overrides,
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CREACIÓN
  // ─────────────────────────────────────────────────────────────────────────

  describe('Creation', () => {
    it('should create a product with all properties', () => {
      const product = createProduct();

      expect(product.id).toBe('prod-123');
      expect(product.sku).toBe('AGUA-500ML');
      expect(product.name).toBe('Agua Mineral 500ml');
      expect(product.price.cents).toBe(100);
      expect(product.stockQuantity).toBe(50);
      expect(product.locationId).toBe('loc-001');
    });

    it('should default to ACTIVE status', () => {
      const product = createProduct();
      expect(product.status).toBe(ProductStatus.ACTIVE);
    });

    it('should default to isActive = true', () => {
      const product = createProduct();
      expect(product.isActive).toBe(true);
    });

    it('should default lowStockThreshold to 10', () => {
      const product = new Product({
        id: 'prod-123',
        sku: 'TEST',
        name: 'Test',
        price: Money.fromCents(100),
        stockQuantity: 50,
        locationId: 'loc-001',
      });
      expect(product.lowStockThreshold).toBe(10);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // STOCK LOGIC
  // ─────────────────────────────────────────────────────────────────────────

  describe('Stock Logic', () => {
    it('should return true for hasStock when quantity is available', () => {
      const product = createProduct({ stockQuantity: 50 });
      
      expect(product.hasStock(10)).toBe(true);
      expect(product.hasStock(50)).toBe(true);
    });

    it('should return false for hasStock when quantity exceeds stock', () => {
      const product = createProduct({ stockQuantity: 50 });
      
      expect(product.hasStock(51)).toBe(false);
      expect(product.hasStock(100)).toBe(false);
    });

    it('should check if product is available for sale', () => {
      const activeProduct = createProduct({
        status: ProductStatus.ACTIVE,
        stockQuantity: 50,
      });
      
      expect(activeProduct.isAvailableForSale(10)).toBe(true);
    });

    it('should not be available when paused', () => {
      const pausedProduct = createProduct({
        status: ProductStatus.PAUSED,
        stockQuantity: 50,
      });
      
      expect(pausedProduct.isAvailableForSale(10)).toBe(false);
    });

    it('should not be available when discontinued', () => {
      const discontinuedProduct = createProduct({
        status: ProductStatus.DISCONTINUED,
        stockQuantity: 50,
      });
      
      expect(discontinuedProduct.isAvailableForSale(10)).toBe(false);
    });

    it('should not be available when no stock', () => {
      const noStockProduct = createProduct({
        status: ProductStatus.ACTIVE,
        stockQuantity: 0,
      });
      
      expect(noStockProduct.isAvailableForSale(1)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // VERSION (OPTIMISTIC LOCKING)
  // ─────────────────────────────────────────────────────────────────────────

  describe('Optimistic Locking', () => {
    it('should default version to 1', () => {
      const product = createProduct();
      expect(product.version).toBe(1);
    });

    it('should allow setting custom version', () => {
      const product = createProduct({ version: 5 });
      expect(product.version).toBe(5);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // RESERVE STOCK
  // ─────────────────────────────────────────────────────────────────────────

  describe('reserveStock', () => {
    it('should decrease stock when quantity is available', () => {
      const product = createProduct({ stockQuantity: 50 });
      const initialVersion = product.version;

      product.reserveStock(10);

      expect(product.stockQuantity).toBe(40);
      expect(product.version).toBe(initialVersion + 1);
    });

    it('should throw StockInsufficientException when not enough stock', () => {
      const product = createProduct({ stockQuantity: 5 });

      expect(() => product.reserveStock(10)).toThrow();
    });

    it('should update updatedAt timestamp', () => {
      const product = createProduct({ stockQuantity: 50 });
      const before = product.updatedAt;

      // Ensure time difference
      jest.useFakeTimers();
      jest.advanceTimersByTime(100);

      product.reserveStock(5);

      expect(product.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      jest.useRealTimers();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // RELEASE STOCK
  // ─────────────────────────────────────────────────────────────────────────

  describe('releaseStock', () => {
    it('should increase stock by specified amount', () => {
      const product = createProduct({ stockQuantity: 30 });
      const initialVersion = product.version;

      product.releaseStock(10);

      expect(product.stockQuantity).toBe(40);
      expect(product.version).toBe(initialVersion + 1);
    });

    it('should allow releasing to increase above initial stock', () => {
      const product = createProduct({ stockQuantity: 50 });

      product.releaseStock(100);

      expect(product.stockQuantity).toBe(150);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ADJUST STOCK
  // ─────────────────────────────────────────────────────────────────────────

  describe('adjustStock', () => {
    it('should set stock to new value', () => {
      const product = createProduct({ stockQuantity: 50 });
      const initialVersion = product.version;

      product.adjustStock(100);

      expect(product.stockQuantity).toBe(100);
      expect(product.version).toBe(initialVersion + 1);
    });

    it('should allow adjusting to zero', () => {
      const product = createProduct({ stockQuantity: 50 });

      product.adjustStock(0);

      expect(product.stockQuantity).toBe(0);
    });

    it('should throw error for negative stock', () => {
      const product = createProduct({ stockQuantity: 50 });

      expect(() => product.adjustStock(-10)).toThrow('Stock cannot be negative');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE PRICE
  // ─────────────────────────────────────────────────────────────────────────

  describe('updatePrice', () => {
    it('should update the price', () => {
      const product = createProduct();
      const initialVersion = product.version;
      const newPrice = Money.fromCents(250);

      product.updatePrice(newPrice);

      expect(product.price.cents).toBe(250);
      expect(product.version).toBe(initialVersion + 1);
    });

    it('should update updatedAt timestamp', () => {
      const product = createProduct();
      const before = product.updatedAt;

      product.updatePrice(Money.fromCents(500));

      expect(product.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CHANGE STATUS
  // ─────────────────────────────────────────────────────────────────────────

  describe('changeStatus', () => {
    it('should change status to PAUSED', () => {
      const product = createProduct({ status: ProductStatus.ACTIVE });

      product.changeStatus(ProductStatus.PAUSED);

      expect(product.status).toBe(ProductStatus.PAUSED);
      // Note: isActive is a separate property, not derived from status
    });

    it('should change status to DISCONTINUED', () => {
      const product = createProduct({ status: ProductStatus.ACTIVE });

      product.changeStatus(ProductStatus.DISCONTINUED);

      expect(product.status).toBe(ProductStatus.DISCONTINUED);
    });

    it('should change status back to ACTIVE', () => {
      const product = createProduct({ status: ProductStatus.PAUSED });

      product.changeStatus(ProductStatus.ACTIVE);

      expect(product.status).toBe(ProductStatus.ACTIVE);
    });

    it('should update updatedAt timestamp', () => {
      const product = createProduct();
      const before = product.updatedAt;

      product.changeStatus(ProductStatus.PAUSED);

      expect(product.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });
});
