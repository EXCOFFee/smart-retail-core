/**
 * ============================================================================
 * SMART_RETAIL - Product Repository (TypeORM Implementation)
 * ============================================================================
 * Implementación del puerto IProductRepository usando TypeORM.
 * 
 * ARQUITECTURA: Capa de INFRAESTRUCTURA 🔵 (adapters/database)
 * 
 * NOTA ESPECIAL: Este repositorio implementa Optimistic Locking para
 * actualizaciones de stock (Regla 4 del SRS).
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IProductRepository, ProductSearchCriteria } from '@application/ports/output/repositories.port';
import { Product } from '@domain/entities/product.entity';
import { Money } from '@domain/value-objects/money.value-object';
import { ProductOrmEntity } from '@infrastructure/database/entities/product.orm-entity';

@Injectable()
export class ProductRepository implements IProductRepository {
  private readonly logger = new Logger(ProductRepository.name);

  constructor(
    @InjectRepository(ProductOrmEntity)
    private readonly productRepo: Repository<ProductOrmEntity>,
  ) {}

  /**
   * Busca un producto por ID y lo mapea a entidad de dominio.
   * 
   * @param id - UUID del producto
   * @returns Producto de dominio o null si no existe
   */
  async findById(id: string): Promise<Product | null> {
    const orm = await this.productRepo.findOne({ where: { id } });
    if (!orm) return null;
    return this.toDomain(orm);
  }

  /**
   * Busca un producto por SKU y ubicación.
   * 
   * @param sku - Código SKU del producto
   * @param locationId - ID de la ubicación
   * @returns Producto de dominio o null si no existe
   */
  async findBySkuAndLocation(sku: string, locationId: string): Promise<Product | null> {
    const orm = await this.productRepo.findOne({ 
      where: { sku, locationId } 
    });
    if (!orm) return null;
    return this.toDomain(orm);
  }

  /**
   * Busca productos por criterios.
   * 
   * @param criteria - Criterios de búsqueda
   * @returns Lista de productos que cumplen los criterios
   */
  async findMany(criteria: ProductSearchCriteria): Promise<Product[]> {
    const qb = this.productRepo.createQueryBuilder('product');

    if (criteria.locationId) {
      qb.andWhere('product.locationId = :locationId', { 
        locationId: criteria.locationId 
      });
    }
    if (criteria.sku) {
      qb.andWhere('product.sku = :sku', { sku: criteria.sku });
    }
    if (criteria.status) {
      qb.andWhere('product.status = :status', { status: criteria.status });
    }
    if (typeof criteria.minStock === 'number') {
      qb.andWhere('product.stockQuantity >= :minStock', { 
        minStock: criteria.minStock 
      });
    }

    qb.orderBy('product.name', 'ASC');

    const orms = await qb.getMany();
    return orms.map((orm: ProductOrmEntity) => this.toDomain(orm));
  }

  /**
   * Busca productos por ubicación.
   * 
   * @param locationId - ID de la ubicación
   * @returns Lista de productos en esa ubicación
   */
  async findByLocation(locationId: string): Promise<Product[]> {
    const orms = await this.productRepo.find({
      where: { locationId },
      order: { name: 'ASC' },
    });
    return orms.map((orm: ProductOrmEntity) => this.toDomain(orm));
  }

  /**
   * Persiste un producto (crea o actualiza).
   * 
   * @param product - Entidad de dominio del producto
   * @returns Producto persistido
   */
  async save(product: Product): Promise<Product> {
    const orm = this.toOrm(product);
    const saved = await this.productRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Actualiza el stock con Optimistic Locking.
   * 
   * CRÍTICO: Este método implementa la Regla 4 del SRS.
   * Solo actualiza si la versión coincide, previniendo race conditions.
   * 
   * Por qué Optimistic Locking:
   * 1. No bloquea filas en Postgres (mejor rendimiento)
   * 2. Detecta conflictos de concurrencia
   * 3. El lock de Redis ya maneja la mayoría de conflictos
   * 
   * @param productId - ID del producto
   * @param newQuantity - Nueva cantidad de stock
   * @param expectedVersion - Versión esperada (para OL)
   * @returns true si se actualizó, false si hubo conflicto de versión
   */
  async updateStockWithVersion(
    productId: string,
    newQuantity: number,
    expectedVersion: number,
  ): Promise<boolean> {
    const result = await this.productRepo
      .createQueryBuilder()
      .update(ProductOrmEntity)
      .set({
        stockQuantity: newQuantity,
        version: () => 'version + 1',
        updatedAt: new Date(),
      })
      .where('id = :id', { id: productId })
      .andWhere('version = :version', { version: expectedVersion })
      .execute();

    const updated = (result.affected ?? 0) > 0;

    if (!updated) {
      this.logger.warn('Optimistic lock conflict on product stock update', {
        productId,
        expectedVersion,
      });
    }

    return updated;
  }

  /**
   * Mapea entidad ORM a entidad de dominio.
   * 
   * @param orm - Entidad ORM
   * @returns Entidad de dominio
   */
  private toDomain(orm: ProductOrmEntity): Product {
    return new Product({
      id: orm.id,
      sku: orm.sku,
      name: orm.name,
      description: orm.description ?? undefined,
      price: Money.fromCents(orm.priceCents),
      stockQuantity: orm.stockQuantity,
      lowStockThreshold: orm.lowStockThreshold,
      locationId: orm.locationId,
      isActive: orm.isActive,
      version: orm.version,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  /**
   * Mapea entidad de dominio a entidad ORM.
   * 
   * @param domain - Entidad de dominio
   * @returns Entidad ORM
   */
  private toOrm(domain: Product): ProductOrmEntity {
    const orm = new ProductOrmEntity();
    orm.id = domain.id;
    orm.sku = domain.sku;
    orm.name = domain.name;
    orm.description = domain.description ?? null;
    orm.priceCents = domain.price.cents;
    orm.stockQuantity = domain.stockQuantity;
    orm.lowStockThreshold = domain.lowStockThreshold;
    orm.locationId = domain.locationId;
    orm.isActive = domain.isActive;
    orm.version = domain.version;
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    return orm;
  }
}
