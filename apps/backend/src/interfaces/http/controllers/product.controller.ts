/**
 * ============================================================================
 * SMART_RETAIL - Product Controller
 * ============================================================================
 * Controlador HTTP para endpoints CRUD de productos.
 * 
 * ARQUITECTURA: Capa de INTERFACES 🟢 (http/controllers)
 * 
 * ENDPOINTS:
 * - POST /products - Crear producto (admin, business_owner)
 * - GET /products - Listar productos con filtros
 * - GET /products/:id - Obtener producto por ID
 * - PATCH /products/:id - Actualizar producto
 * - PATCH /products/:id/stock - Actualizar stock con Optimistic Locking
 * - DELETE /products/:id - Soft delete (marca como DISCONTINUED)
 * 
 * SEGURIDAD:
 * - Creación solo por admin y business_owner
 * - Lectura permitida para todos los usuarios autenticados
 * ============================================================================
 */

import {
    Body,
    ConflictException,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Inject,
    Logger,
    NotFoundException,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiConflictResponse,
    ApiCreatedResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiTags,
} from '@nestjs/swagger';
import { randomUUID } from 'crypto';

import {
    IProductRepository,
    PRODUCT_REPOSITORY,
} from '@application/ports/output/repositories.port';
import { Product, ProductStatus } from '@domain/entities/product.entity';
import { Money } from '@domain/value-objects/money.value-object';
import { Roles } from '@infrastructure/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@infrastructure/auth/guards/roles.guard';
import {
    CreateProductDto,
    ProductListResponseDto,
    ProductQueryDto,
    ProductResponseDto,
    UpdateProductDto,
    UpdateStockDto,
} from '@interfaces/http/dto/product.dto';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductController {
  private readonly logger = new Logger(ProductController.name);

  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: IProductRepository,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE PRODUCT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Crea un nuevo producto.
   * 
   * @param dto - Datos del producto
   * @returns Producto creado
   */
  @Post()
  @Roles('admin', 'business_owner')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear producto',
    description: 'Crea un nuevo producto en el sistema. Solo admins y business_owners.',
  })
  @ApiCreatedResponse({
    description: 'Producto creado exitosamente',
    type: ProductResponseDto,
  })
  @ApiConflictResponse({
    description: 'Ya existe un producto con ese SKU en la ubicación',
  })
  async createProduct(@Body() dto: CreateProductDto): Promise<ProductResponseDto> {
    this.logger.log(`Creating product: ${dto.sku}`);

    // Verificar que no existe el SKU en la ubicación
    const existing = await this.productRepository.findBySkuAndLocation(
      dto.sku,
      dto.locationId,
    );

    if (existing) {
      throw new ConflictException(
        `Ya existe un producto con SKU '${dto.sku}' en esta ubicación`,
      );
    }

    // Crear entidad de dominio
    const product = new Product({
      id: randomUUID(),
      sku: dto.sku.trim().toUpperCase(),
      name: dto.name.trim(),
      description: dto.description?.trim(),
      price: Money.fromCents(dto.priceCents),
      stockQuantity: dto.stockQuantity,
      lowStockThreshold: dto.lowStockThreshold ?? 10,
      locationId: dto.locationId,
      isActive: true,
      status: ProductStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    });

    const saved = await this.productRepository.save(product);

    this.logger.log(`Product created: ${saved.id}`);

    return this.toResponseDto(saved);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIST PRODUCTS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Lista productos con filtros.
   * 
   * @param query - Filtros de búsqueda
   * @returns Lista de productos
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar productos',
    description: 'Obtiene lista de productos con filtros opcionales.',
  })
  @ApiOkResponse({
    description: 'Lista de productos',
    type: ProductListResponseDto,
  })
  async listProducts(
    @Query() query: ProductQueryDto,
  ): Promise<ProductListResponseDto> {
    this.logger.log('Listing products', { query });

    const products = await this.productRepository.findMany({
      locationId: query.locationId,
      sku: query.sku,
      status: query.status,
      minStock: query.minStock,
    });

    return {
      products: products.map((p) => this.toResponseDto(p)),
      total: products.length,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET PRODUCT BY ID
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Obtiene un producto por su ID.
   * 
   * @param id - ID del producto
   * @returns Producto encontrado
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener producto',
    description: 'Obtiene un producto por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del producto',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Producto encontrado',
    type: ProductResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Producto no encontrado',
  })
  async getProduct(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductResponseDto> {
    const product = await this.productRepository.findById(id);

    if (!product) {
      throw new NotFoundException(`Producto con ID '${id}' no encontrado`);
    }

    return this.toResponseDto(product);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE PRODUCT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Actualiza un producto.
   * 
   * @param id - ID del producto
   * @param dto - Datos a actualizar
   * @returns Producto actualizado
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualizar producto',
    description: 'Actualiza los datos de un producto existente.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del producto',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Producto actualizado',
    type: ProductResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Producto no encontrado',
  })
  async updateProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    this.logger.log(`Updating product: ${id}`);

    const existing = await this.productRepository.findById(id);

    if (!existing) {
      throw new NotFoundException(`Producto con ID '${id}' no encontrado`);
    }

    // Construir producto actualizado
    const updated = new Product({
      id: existing.id,
      sku: dto.sku?.trim().toUpperCase() ?? existing.sku,
      name: dto.name?.trim() ?? existing.name,
      description: dto.description?.trim() ?? existing.description,
      price: dto.priceCents !== undefined
        ? Money.fromCents(dto.priceCents)
        : existing.price,
      stockQuantity: dto.stockQuantity ?? existing.stockQuantity,
      lowStockThreshold: dto.lowStockThreshold ?? existing.lowStockThreshold,
      locationId: dto.locationId ?? existing.locationId,
      isActive: dto.isActive ?? existing.isActive,
      status: dto.status ?? existing.status,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
      version: existing.version,
    });

    const saved = await this.productRepository.save(updated);

    this.logger.log(`Product updated: ${id}`);

    return this.toResponseDto(saved);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE STOCK
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Actualiza el stock de un producto con Optimistic Locking.
   * 
   * @param id - ID del producto
   * @param dto - Nueva cantidad y versión esperada
   * @returns Producto actualizado
   */
  @Patch(':id/stock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualizar stock',
    description: 'Actualiza el stock de un producto usando Optimistic Locking. Falla si la versión no coincide.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del producto',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Stock actualizado',
    type: ProductResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Producto no encontrado',
  })
  @ApiConflictResponse({
    description: 'Conflicto de versión - el producto fue modificado por otro proceso',
  })
  async updateStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStockDto,
  ): Promise<ProductResponseDto> {
    this.logger.log(`Updating stock for product: ${id}`);

    // Verificar que el producto existe
    const existing = await this.productRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Producto con ID '${id}' no encontrado`);
    }

    // Intentar actualizar con Optimistic Locking
    const success = await this.productRepository.updateStockWithVersion(
      id,
      dto.stockQuantity,
      dto.expectedVersion,
    );

    if (!success) {
      throw new ConflictException(
        'El producto fue modificado por otro proceso. Por favor, recarga los datos e intenta nuevamente.',
      );
    }

    // Obtener producto actualizado
    const updated = await this.productRepository.findById(id);
    if (!updated) {
      throw new NotFoundException(`Producto con ID '${id}' no encontrado`);
    }

    this.logger.log(`Stock updated for product: ${id}, new quantity: ${dto.stockQuantity}`);

    return this.toResponseDto(updated);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE PRODUCT (SOFT DELETE)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Elimina un producto (soft delete - marca como DISCONTINUED).
   * 
   * @param id - ID del producto
   */
  @Delete(':id')
  @Roles('admin', 'business_owner')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar producto',
    description: 'Soft delete - marca el producto como DISCONTINUED.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del producto',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Producto eliminado (descontinuado)',
  })
  @ApiNotFoundResponse({
    description: 'Producto no encontrado',
  })
  async deleteProduct(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    this.logger.log(`Deleting (discontinuing) product: ${id}`);

    const existing = await this.productRepository.findById(id);

    if (!existing) {
      throw new NotFoundException(`Producto con ID '${id}' no encontrado`);
    }

    // Soft delete: cambiar estado a DISCONTINUED
    const discontinued = new Product({
      id: existing.id,
      sku: existing.sku,
      name: existing.name,
      description: existing.description,
      price: existing.price,
      stockQuantity: existing.stockQuantity,
      lowStockThreshold: existing.lowStockThreshold,
      locationId: existing.locationId,
      isActive: false,
      status: ProductStatus.DISCONTINUED,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
      version: existing.version,
    });

    await this.productRepository.save(discontinued);

    this.logger.log(`Product discontinued: ${id}`);

    return { message: 'Producto eliminado (descontinuado) exitosamente' };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE METHODS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Convierte una entidad de dominio a DTO de respuesta.
   * 
   * @param product - Entidad de producto
   * @returns DTO de respuesta
   */
  private toResponseDto(product: Product): ProductResponseDto {
    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      priceCents: product.price.cents,
      priceFormatted: product.price.toString(),
      stockQuantity: product.stockQuantity,
      lowStockThreshold: product.lowStockThreshold,
      isLowStock: product.stockQuantity <= product.lowStockThreshold,
      locationId: product.locationId,
      status: product.status,
      isActive: product.isActive,
      version: product.version,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
