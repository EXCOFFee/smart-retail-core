/**
 * ============================================================================
 * SMART_RETAIL - ProductController Tests
 * ============================================================================
 * Tests unitarios para el controlador de productos.
 * ============================================================================
 */

import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PRODUCT_REPOSITORY } from '../../../src/application/ports/output/repositories.port';
import { Product, ProductStatus } from '../../../src/domain/entities/product.entity';
import { Money } from '../../../src/domain/value-objects/money.value-object';
import { ProductController } from '../../../src/interfaces/http/controllers/product.controller';

describe('ProductController', () => {
  let controller: ProductController;
  let productRepository: {
    findById: jest.Mock;
    findBySkuAndLocation: jest.Mock;
    findMany: jest.Mock;
    save: jest.Mock;
    updateStockWithVersion: jest.Mock;
  };

  const mockProductRepository = {
    findById: jest.fn(),
    findBySkuAndLocation: jest.fn(),
    findMany: jest.fn(),
    save: jest.fn(),
    updateStockWithVersion: jest.fn(),
  };

  const createMockProduct = (overrides = {}) => {
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [
        {
          provide: PRODUCT_REPOSITORY,
          useValue: mockProductRepository,
        },
      ],
    }).compile();

    controller = module.get<ProductController>(ProductController);
    productRepository = module.get(PRODUCT_REPOSITORY);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE PRODUCT
  // ─────────────────────────────────────────────────────────────────────────

  describe('createProduct', () => {
    const createDto = {
      sku: 'AGUA-500ML',
      name: 'Agua Mineral 500ml',
      description: 'Agua mineral natural',
      priceCents: 100,
      stockQuantity: 50,
      lowStockThreshold: 10,
      locationId: 'loc-001',
    };

    it('should create a product successfully', async () => {
      const mockProduct = createMockProduct();
      mockProductRepository.findBySkuAndLocation.mockResolvedValue(null);
      mockProductRepository.save.mockResolvedValue(mockProduct);

      const result = await controller.createProduct(createDto);

      expect(productRepository.findBySkuAndLocation).toHaveBeenCalledWith(
        createDto.sku,
        createDto.locationId,
      );
      expect(productRepository.save).toHaveBeenCalled();
      expect(result.sku).toBe('AGUA-500ML');
    });

    it('should throw ConflictException for duplicate SKU in location', async () => {
      const existingProduct = createMockProduct();
      mockProductRepository.findBySkuAndLocation.mockResolvedValue(existingProduct);

      await expect(controller.createProduct(createDto)).rejects.toThrow(ConflictException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET PRODUCT
  // ─────────────────────────────────────────────────────────────────────────

  describe('getProduct', () => {
    it('should return a product by ID', async () => {
      const mockProduct = createMockProduct();
      mockProductRepository.findById.mockResolvedValue(mockProduct);

      const result = await controller.getProduct('prod-123');

      expect(productRepository.findById).toHaveBeenCalledWith('prod-123');
      expect(result.id).toBe('prod-123');
    });

    it('should throw NotFoundException for non-existent product', async () => {
      mockProductRepository.findById.mockResolvedValue(null);

      await expect(controller.getProduct('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // LIST PRODUCTS
  // ─────────────────────────────────────────────────────────────────────────

  describe('listProducts', () => {
    it('should return list of products', async () => {
      const mockProducts = [createMockProduct(), createMockProduct({ id: 'prod-456' })];
      mockProductRepository.findMany.mockResolvedValue(mockProducts);

      const result = await controller.listProducts({});

      expect(productRepository.findMany).toHaveBeenCalled();
      expect(result.products).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by locationId', async () => {
      const mockProducts = [createMockProduct()];
      mockProductRepository.findMany.mockResolvedValue(mockProducts);

      await controller.listProducts({ locationId: 'loc-001' });

      expect(productRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ locationId: 'loc-001' }),
      );
    });

    it('should filter by status', async () => {
      const mockProducts = [createMockProduct()];
      mockProductRepository.findMany.mockResolvedValue(mockProducts);

      await controller.listProducts({ status: ProductStatus.ACTIVE });

      expect(productRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ status: ProductStatus.ACTIVE }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE PRODUCT
  // ─────────────────────────────────────────────────────────────────────────

  describe('updateProduct', () => {
    const updateDto = {
      name: 'Agua Mineral 600ml',
      priceCents: 150,
    };

    it('should update a product successfully', async () => {
      const existingProduct = createMockProduct();
      const updatedProduct = createMockProduct({ name: 'Agua Mineral 600ml' });
      
      mockProductRepository.findById.mockResolvedValue(existingProduct);
      mockProductRepository.save.mockResolvedValue(updatedProduct);

      const result = await controller.updateProduct('prod-123', updateDto);

      expect(productRepository.findById).toHaveBeenCalledWith('prod-123');
      expect(productRepository.save).toHaveBeenCalled();
      expect(result.name).toBe('Agua Mineral 600ml');
    });

    it('should throw NotFoundException for non-existent product', async () => {
      mockProductRepository.findById.mockResolvedValue(null);

      await expect(controller.updateProduct('non-existent', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE STOCK
  // ─────────────────────────────────────────────────────────────────────────

  describe('updateStock', () => {
    const stockDto = {
      stockQuantity: 100,
      expectedVersion: 1,
    };

    it('should update stock with optimistic locking', async () => {
      const existingProduct = createMockProduct();
      const updatedProduct = createMockProduct({ stockQuantity: 100 });
      
      mockProductRepository.findById
        .mockResolvedValueOnce(existingProduct)
        .mockResolvedValueOnce(updatedProduct);
      mockProductRepository.updateStockWithVersion.mockResolvedValue(true);

      const result = await controller.updateStock('prod-123', stockDto);

      expect(productRepository.updateStockWithVersion).toHaveBeenCalledWith(
        'prod-123',
        100,
        1,
      );
      expect(result.stockQuantity).toBe(100);
    });

    it('should throw ConflictException on version mismatch', async () => {
      const existingProduct = createMockProduct();
      
      mockProductRepository.findById.mockResolvedValue(existingProduct);
      mockProductRepository.updateStockWithVersion.mockResolvedValue(false);

      await expect(controller.updateStock('prod-123', stockDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException when product not found for stock update', async () => {
      mockProductRepository.findById.mockResolvedValue(null);

      await expect(controller.updateStock('non-existent', stockDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when product disappears after update', async () => {
      const existingProduct = createMockProduct();
      
      mockProductRepository.findById
        .mockResolvedValueOnce(existingProduct)
        .mockResolvedValueOnce(null); // Product disappears after update
      mockProductRepository.updateStockWithVersion.mockResolvedValue(true);

      await expect(controller.updateStock('prod-123', stockDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE PRODUCT
  // ─────────────────────────────────────────────────────────────────────────

  describe('deleteProduct', () => {
    it('should soft delete a product', async () => {
      const existingProduct = createMockProduct();
      const discontinuedProduct = createMockProduct({ 
        status: ProductStatus.DISCONTINUED,
        isActive: false,
      });
      
      mockProductRepository.findById.mockResolvedValue(existingProduct);
      mockProductRepository.save.mockResolvedValue(discontinuedProduct);

      await controller.deleteProduct('prod-123');

      expect(productRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ProductStatus.DISCONTINUED,
        }),
      );
    });

    it('should throw NotFoundException for non-existent product', async () => {
      mockProductRepository.findById.mockResolvedValue(null);

      await expect(controller.deleteProduct('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
