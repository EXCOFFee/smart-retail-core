/**
 * Tests para ProductRepository (Unit con mocks)
 */

import { Repository, SelectQueryBuilder, UpdateQueryBuilder } from 'typeorm';

import { Product } from '@domain/entities/product.entity';
import { Money } from '@domain/value-objects/money.value-object';
import { ProductOrmEntity } from '@infrastructure/database/entities/product.orm-entity';
import { ProductRepository } from '@infrastructure/database/repositories/product.repository';

describe('ProductRepository', () => {
  let repository: ProductRepository;
  let mockTypeOrmRepo: jest.Mocked<Repository<ProductOrmEntity>>;
  let mockSelectQueryBuilder: jest.Mocked<SelectQueryBuilder<ProductOrmEntity>>;
  let mockUpdateQueryBuilder: jest.Mocked<UpdateQueryBuilder<ProductOrmEntity>>;

  const mockOrmProduct: ProductOrmEntity = {
    id: 'product-123',
    sku: 'SKU-001',
    name: 'Test Product',
    description: 'A test product',
    priceCents: 15000,
    stockQuantity: 100,
    lowStockThreshold: 10,
    locationId: 'loc-1',
    isActive: true,
    version: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2025-01-25'),
  } as ProductOrmEntity;

  beforeEach(() => {
    mockUpdateQueryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    } as unknown as jest.Mocked<UpdateQueryBuilder<ProductOrmEntity>>;

    mockSelectQueryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
      update: jest.fn().mockReturnValue(mockUpdateQueryBuilder),
    } as unknown as jest.Mocked<SelectQueryBuilder<ProductOrmEntity>>;

    mockTypeOrmRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockSelectQueryBuilder),
    } as unknown as jest.Mocked<Repository<ProductOrmEntity>>;

    repository = new ProductRepository(mockTypeOrmRepo);
  });

  describe('findById', () => {
    it('should return domain product when found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockOrmProduct);

      const result = await repository.findById('product-123');

      expect(result).toBeInstanceOf(Product);
      expect(result?.id).toBe('product-123');
      expect(result?.sku).toBe('SKU-001');
      expect(result?.name).toBe('Test Product');
      expect(result?.price.cents).toBe(15000);
      expect(result?.stockQuantity).toBe(100);
    });

    it('should return null when product not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should handle product without description', async () => {
      const ormWithoutDescription = { ...mockOrmProduct, description: null };
      mockTypeOrmRepo.findOne.mockResolvedValue(ormWithoutDescription as ProductOrmEntity);

      const result = await repository.findById('product-123');

      expect(result).not.toBeNull();
      expect(result?.description).toBeUndefined();
    });
  });

  describe('findBySkuAndLocation', () => {
    it('should return product when found by SKU and location', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockOrmProduct);

      const result = await repository.findBySkuAndLocation('SKU-001', 'loc-1');

      expect(result?.sku).toBe('SKU-001');
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { sku: 'SKU-001', locationId: 'loc-1' },
      });
    });

    it('should return null when SKU not found in location', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findBySkuAndLocation('UNKNOWN', 'loc-1');

      expect(result).toBeNull();
    });
  });

  describe('findMany', () => {
    it('should find products by criteria', async () => {
      mockSelectQueryBuilder.getMany.mockResolvedValue([mockOrmProduct]);

      const result = await repository.findMany({
        locationId: 'loc-1',
        status: 'ACTIVE',
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(Product);
      expect(mockSelectQueryBuilder.andWhere).toHaveBeenCalledWith(
        'product.locationId = :locationId',
        { locationId: 'loc-1' },
      );
      expect(mockSelectQueryBuilder.andWhere).toHaveBeenCalledWith(
        'product.status = :status',
        { status: 'ACTIVE' },
      );
    });

    it('should filter by SKU', async () => {
      mockSelectQueryBuilder.getMany.mockResolvedValue([mockOrmProduct]);

      await repository.findMany({ sku: 'SKU-001' });

      expect(mockSelectQueryBuilder.andWhere).toHaveBeenCalledWith(
        'product.sku = :sku',
        { sku: 'SKU-001' },
      );
    });

    it('should filter by minStock', async () => {
      mockSelectQueryBuilder.getMany.mockResolvedValue([mockOrmProduct]);

      await repository.findMany({ minStock: 50 });

      expect(mockSelectQueryBuilder.andWhere).toHaveBeenCalledWith(
        'product.stockQuantity >= :minStock',
        { minStock: 50 },
      );
    });

    it('should order by name', async () => {
      mockSelectQueryBuilder.getMany.mockResolvedValue([]);

      await repository.findMany({});

      expect(mockSelectQueryBuilder.orderBy).toHaveBeenCalledWith('product.name', 'ASC');
    });
  });

  describe('findByLocation', () => {
    it('should return products for location', async () => {
      const products = [
        mockOrmProduct,
        { ...mockOrmProduct, id: 'product-456', name: 'Another Product' },
      ];
      mockTypeOrmRepo.find.mockResolvedValue(products as ProductOrmEntity[]);

      const result = await repository.findByLocation('loc-1');

      expect(result).toHaveLength(2);
      expect(mockTypeOrmRepo.find).toHaveBeenCalledWith({
        where: { locationId: 'loc-1' },
        order: { name: 'ASC' },
      });
    });
  });

  describe('save', () => {
    it('should persist product and return domain entity', async () => {
      const domainProduct = new Product({
        id: 'new-product',
        sku: 'SKU-NEW',
        name: 'New Product',
        price: Money.fromCents(25000),
        stockQuantity: 50,
        lowStockThreshold: 5,
        locationId: 'loc-2',
        isActive: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockTypeOrmRepo.save.mockResolvedValue({
        ...mockOrmProduct,
        id: 'new-product',
        sku: 'SKU-NEW',
        name: 'New Product',
        priceCents: 25000,
      } as ProductOrmEntity);

      const result = await repository.save(domainProduct);

      expect(result).toBeInstanceOf(Product);
      expect(result.id).toBe('new-product');
      expect(mockTypeOrmRepo.save).toHaveBeenCalled();
    });

    it('should map all domain fields to ORM entity', async () => {
      const domainProduct = new Product({
        id: 'product-xyz',
        sku: 'FULL-SKU',
        name: 'Full Product',
        description: 'A complete product',
        price: Money.fromCents(99999),
        stockQuantity: 999,
        lowStockThreshold: 100,
        locationId: 'loc-full',
        isActive: false,
        version: 5,
        createdAt: new Date('2024-06-01'),
        updatedAt: new Date('2025-01-20'),
      });

      mockTypeOrmRepo.save.mockImplementation(async (entity) => entity as ProductOrmEntity);

      await repository.save(domainProduct);

      const savedEntity = mockTypeOrmRepo.save.mock.calls[0][0] as ProductOrmEntity;
      expect(savedEntity.id).toBe('product-xyz');
      expect(savedEntity.sku).toBe('FULL-SKU');
      expect(savedEntity.description).toBe('A complete product');
      expect(savedEntity.priceCents).toBe(99999);
      expect(savedEntity.stockQuantity).toBe(999);
      expect(savedEntity.lowStockThreshold).toBe(100);
      expect(savedEntity.isActive).toBe(false);
      expect(savedEntity.version).toBe(5);
    });

    it('should handle null description', async () => {
      const domainProduct = new Product({
        id: 'product-no-desc',
        sku: 'NO-DESC',
        name: 'No Description',
        price: Money.fromCents(1000),
        stockQuantity: 10,
        lowStockThreshold: 2,
        locationId: 'loc-1',
        isActive: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockTypeOrmRepo.save.mockImplementation(async (entity) => entity as ProductOrmEntity);

      await repository.save(domainProduct);

      const savedEntity = mockTypeOrmRepo.save.mock.calls[0][0] as ProductOrmEntity;
      expect(savedEntity.description).toBeNull();
    });
  });

  describe('updateStockWithVersion', () => {
    it('should update stock with version check - success', async () => {
      mockUpdateQueryBuilder.execute.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      const result = await repository.updateStockWithVersion('product-123', 90, 1);

      expect(result).toBe(true);
      expect(mockUpdateQueryBuilder.set).toHaveBeenCalledWith(
        expect.objectContaining({
          stockQuantity: 90,
          updatedAt: expect.any(Date),
        }),
      );
      expect(mockUpdateQueryBuilder.where).toHaveBeenCalledWith('id = :id', { id: 'product-123' });
      expect(mockUpdateQueryBuilder.andWhere).toHaveBeenCalledWith('version = :version', { version: 1 });
    });

    it('should return false on version conflict', async () => {
      mockUpdateQueryBuilder.execute.mockResolvedValue({ affected: 0, raw: [], generatedMaps: [] });

      const result = await repository.updateStockWithVersion('product-123', 90, 2);

      expect(result).toBe(false);
    });

    it('should handle null affected count', async () => {
      mockUpdateQueryBuilder.execute.mockResolvedValue({ affected: undefined, raw: [], generatedMaps: [] });

      const result = await repository.updateStockWithVersion('product-123', 90, 1);

      expect(result).toBe(false);
    });
  });

  describe('toDomain mapping', () => {
    it('should correctly convert priceCents to Money', async () => {
      const ormWithPrice = { ...mockOrmProduct, priceCents: 1234567 };
      mockTypeOrmRepo.findOne.mockResolvedValue(ormWithPrice as ProductOrmEntity);

      const result = await repository.findById('product-123');

      expect(result?.price.cents).toBe(1234567);
      expect(result?.price.toDecimal()).toBe(12345.67);
    });

    it('should preserve version for optimistic locking', async () => {
      const ormWithVersion = { ...mockOrmProduct, version: 42 };
      mockTypeOrmRepo.findOne.mockResolvedValue(ormWithVersion as ProductOrmEntity);

      const result = await repository.findById('product-123');

      expect(result?.version).toBe(42);
    });
  });
});
