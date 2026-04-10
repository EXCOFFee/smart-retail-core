/**
 * ============================================================================
 * SMART_RETAIL - Product ORM Entity (Infraestructura)
 * ============================================================================
 * Entidad TypeORM para persistencia de productos en PostgreSQL.
 * 
 * ARQUITECTURA: Capa de INFRAESTRUCTURA 🔴
 * ============================================================================
 */

import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
    VersionColumn,
} from 'typeorm';

/**
 * Estados del producto (mirror del enum de dominio)
 */
export enum ProductStatusOrm {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  DISCONTINUED = 'DISCONTINUED',
}

@Entity('products')
@Index('IDX_PRODUCT_SKU_LOCATION', ['sku', 'locationId'], { unique: true })
export class ProductOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * SKU (Stock Keeping Unit)
   * Por qué index compuesto con locationId: El mismo SKU puede existir
   * en diferentes sucursales con diferente stock.
   */
  @Column({ type: 'varchar', length: 100 })
  sku!: string;

  /**
   * Nombre del producto
   */
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /**
   * Descripción detallada (opcional)
   */
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  /**
   * Precio en centavos
   * CRÍTICO (Regla 8): Integer para evitar problemas de precisión.
   */
  @Column({ type: 'integer', name: 'price_cents' })
  priceCents!: number;

  /**
   * Cantidad en stock
   * Por qué integer: No hay "medio producto".
   */
  @Column({ type: 'integer', default: 0, name: 'stock_quantity' })
  stockQuantity!: number;

  /**
   * Umbral para alerta de stock bajo
   */
  @Column({ type: 'integer', default: 10, name: 'low_stock_threshold' })
  lowStockThreshold!: number;

  /**
   * Si el producto está activo
   */
  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;

  /**
   * ID de la ubicación/sucursal
   * Por qué no FK: Puede venir de un sistema externo de gestión de locales.
   */
  @Column({ type: 'uuid', name: 'location_id' })
  @Index('IDX_PRODUCT_LOCATION')
  locationId!: string;

  /**
   * Estado del producto
   */
  @Column({
    type: 'enum',
    enum: ProductStatusOrm,
    default: ProductStatusOrm.ACTIVE,
  })
  status!: ProductStatusOrm;

  /**
   * URL de imagen del producto (opcional)
   */
  @Column({ type: 'varchar', length: 500, nullable: true, name: 'image_url' })
  imageUrl?: string | null;

  /**
   * Categoría del producto (opcional)
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  category?: string | null;

  /**
   * Versión para Optimistic Locking
   * 
   * CRÍTICO: TypeORM incrementa automáticamente esta columna en cada UPDATE.
   * Si dos procesos intentan actualizar la misma versión, uno falla.
   * Esto previene race conditions en operaciones de stock.
   */
  @VersionColumn()
  version!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
