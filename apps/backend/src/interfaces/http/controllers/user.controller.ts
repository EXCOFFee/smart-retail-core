/**
 * ============================================================================
 * SMART_RETAIL - User Controller
 * ============================================================================
 * Controlador HTTP para endpoints CRUD de usuarios.
 * 
 * ARQUITECTURA: Capa de INTERFACES 🟢 (http/controllers)
 * 
 * ENDPOINTS:
 * - POST /users - Crear usuario (solo admin)
 * - GET /users - Listar usuarios (solo admin)
 * - GET /users/:id - Obtener usuario (admin o el propio usuario)
 * - PATCH /users/:id - Actualizar usuario (solo admin)
 * - PATCH /users/:id/wallet - Operaciones de billetera (solo admin)
 * - DELETE /users/:id - Desactivar usuario (solo admin)
 * 
 * SEGURIDAD:
 * - La mayoría de operaciones requieren rol admin
 * - Los usuarios normales solo pueden ver su propio perfil
 * ============================================================================
 */

import {
    BadRequestException,
    Body,
    ConflictException,
    Controller,
    Delete,
    ForbiddenException,
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
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiConflictResponse,
    ApiCreatedResponse,
    ApiForbiddenResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiTags,
} from '@nestjs/swagger';
import { createHash, randomUUID } from 'crypto';

import {
    IUserRepository,
    USER_REPOSITORY,
} from '@application/ports/output/repositories.port';
import { User } from '@domain/entities/user.entity';
import { Money } from '@domain/value-objects/money.value-object';
import { CurrentUser } from '@infrastructure/auth/decorators/current-user.decorator';
import { Roles } from '@infrastructure/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@infrastructure/auth/guards/roles.guard';
import { AuthenticatedUser } from '@infrastructure/auth/strategies/jwt.strategy';
import {
    CreateUserDto,
    UpdateUserDto,
    UserListResponseDto,
    UserQueryDto,
    UserResponseDto,
    WalletOperationDto,
    WalletOperationType,
} from '@interfaces/http/dto/user.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE USER
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Crea un nuevo usuario (solo admins).
   * 
   * @param dto - Datos del usuario
   * @returns Usuario creado
   */
  @Post()
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear usuario',
    description: 'Crea un nuevo usuario en el sistema. Solo admins.',
  })
  @ApiCreatedResponse({
    description: 'Usuario creado exitosamente',
    type: UserResponseDto,
  })
  @ApiConflictResponse({
    description: 'El email ya está registrado',
  })
  async createUser(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    this.logger.log(`Creating user: ${dto.email}`);

    const normalizedEmail = dto.email.toLowerCase().trim();

    // Verificar que el email no existe
    const existing = await this.userRepository.findByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictException('El email ya está registrado');
    }

    // Crear usuario
    const passwordHash = this.hashPassword(dto.password);
    const initialBalance = Money.fromCents(dto.initialBalanceCents ?? 0);

    const user = new User({
      id: randomUUID(),
      email: normalizedEmail,
      fullName: dto.fullName.trim(),
      passwordHash,
      role: dto.role as 'consumer' | 'merchant' | 'operator' | 'admin',
      walletBalance: initialBalance,
      locationId: dto.locationId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const saved = await this.userRepository.save(user);

    this.logger.log(`User created: ${saved.id}`);

    return this.toResponseDto(saved);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIST USERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Lista usuarios con filtros (solo admins).
   * 
   * @param query - Filtros de búsqueda
   * @returns Lista de usuarios
   */
  @Get()
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar usuarios',
    description: 'Obtiene lista de usuarios con filtros. Solo admins.',
  })
  @ApiOkResponse({
    description: 'Lista de usuarios',
    type: UserListResponseDto,
  })
  async listUsers(
    @Query() _query: UserQueryDto,
  ): Promise<UserListResponseDto> {
    this.logger.log('Listing users');

    // Por ahora retornamos lista vacía ya que IUserRepository no tiene findMany
    // En una implementación completa, se debería agregar el método findMany
    // al repositorio
    
    // TODO: Implementar findMany en IUserRepository
    return {
      users: [],
      total: 0,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET USER BY ID
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Obtiene un usuario por su ID.
   * Los usuarios normales solo pueden ver su propio perfil.
   * 
   * @param id - ID del usuario
   * @param currentUser - Usuario autenticado
   * @returns Usuario encontrado
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener usuario',
    description: 'Obtiene un usuario por su ID. Usuarios normales solo pueden verse a sí mismos.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del usuario',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Usuario encontrado',
    type: UserResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Usuario no encontrado',
  })
  @ApiForbiddenResponse({
    description: 'No tiene permisos para ver este usuario',
  })
  async getUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    // Verificar permisos: admin puede ver cualquiera, otros solo a sí mismos
    if (currentUser.role !== 'admin' && currentUser.id !== id) {
      throw new ForbiddenException('No tiene permisos para ver este usuario');
    }

    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`Usuario con ID '${id}' no encontrado`);
    }

    return this.toResponseDto(user);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE USER
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Actualiza un usuario (solo admins).
   * 
   * @param id - ID del usuario
   * @param dto - Datos a actualizar
   * @returns Usuario actualizado
   */
  @Patch(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualizar usuario',
    description: 'Actualiza los datos de un usuario. Solo admins.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del usuario',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Usuario actualizado',
    type: UserResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Usuario no encontrado',
  })
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    this.logger.log(`Updating user: ${id}`);

    const existing = await this.userRepository.findById(id);

    if (!existing) {
      throw new NotFoundException(`Usuario con ID '${id}' no encontrado`);
    }

    // Construir usuario actualizado
    const updated = new User({
      id: existing.id,
      email: existing.email,
      fullName: dto.fullName?.trim() ?? existing.fullName,
      passwordHash: existing.passwordHash,
      role: (dto.role as 'consumer' | 'merchant' | 'operator' | 'admin') ?? existing.role,
      walletBalance: existing.walletBalance,
      locationId: existing.locationId,
      isActive: dto.isActive ?? existing.isActive,
      lastLoginAt: existing.lastLoginAt,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });

    const saved = await this.userRepository.save(updated);

    this.logger.log(`User updated: ${id}`);

    return this.toResponseDto(saved);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WALLET OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Realiza operaciones en la billetera de un usuario (solo admins).
   * 
   * @param id - ID del usuario
   * @param dto - Operación a realizar
   * @returns Usuario con saldo actualizado
   */
  @Patch(':id/wallet')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Operación de billetera',
    description: 'Agrega o descuenta fondos de la billetera de un usuario. Solo admins.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del usuario',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Operación exitosa',
    type: UserResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Usuario no encontrado',
  })
  @ApiBadRequestResponse({
    description: 'Saldo insuficiente para la operación',
  })
  async walletOperation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WalletOperationDto,
  ): Promise<UserResponseDto> {
    this.logger.log(`Wallet operation for user ${id}: ${dto.operation} ${dto.amountCents} cents`);

    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`Usuario con ID '${id}' no encontrado`);
    }

    const amount = Money.fromCents(dto.amountCents);

    if (dto.operation === WalletOperationType.ADD) {
      // Agregar fondos
      user.addBalance(amount);
    } else {
      // Descontar fondos
      if (!user.hasEnoughBalance(amount)) {
        throw new BadRequestException(
          `Saldo insuficiente. Saldo actual: ${user.walletBalance.toString()}, ` +
          `Monto a descontar: ${amount.toString()}`,
        );
      }
      user.deductBalance(amount);
    }

    // Actualizar saldo en base de datos
    await this.userRepository.updateBalance(id, user.walletBalance.cents);

    // Obtener usuario actualizado
    const updated = await this.userRepository.findById(id);
    if (!updated) {
      throw new NotFoundException(`Usuario con ID '${id}' no encontrado`);
    }

    this.logger.log(
      `Wallet operation completed for user ${id}. New balance: ${updated.walletBalance.cents} cents`,
    );

    return this.toResponseDto(updated);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE USER (DEACTIVATE)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Desactiva un usuario (solo admins).
   * No elimina físicamente, solo marca como inactivo.
   * 
   * @param id - ID del usuario
   */
  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Desactivar usuario',
    description: 'Desactiva un usuario (no lo elimina). Solo admins.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del usuario',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Usuario desactivado',
  })
  @ApiNotFoundResponse({
    description: 'Usuario no encontrado',
  })
  async deleteUser(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    this.logger.log(`Deactivating user: ${id}`);

    const existing = await this.userRepository.findById(id);

    if (!existing) {
      throw new NotFoundException(`Usuario con ID '${id}' no encontrado`);
    }

    // Soft delete: marcar como inactivo
    const deactivated = new User({
      id: existing.id,
      email: existing.email,
      fullName: existing.fullName,
      passwordHash: existing.passwordHash,
      role: existing.role,
      walletBalance: existing.walletBalance,
      locationId: existing.locationId,
      isActive: false,
      lastLoginAt: existing.lastLoginAt,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });

    await this.userRepository.save(deactivated);

    this.logger.log(`User deactivated: ${id}`);

    return { message: 'Usuario desactivado exitosamente' };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE METHODS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Hashea una contraseña con SHA-256.
   * 
   * TODO: Migrar a bcrypt para mayor seguridad.
   * 
   * @param password - Contraseña en texto plano
   * @returns Hash SHA-256 en hexadecimal
   */
  private hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex');
  }

  /**
   * Convierte una entidad de dominio a DTO de respuesta.
   * 
   * @param user - Entidad de usuario
   * @returns DTO de respuesta
   */
  private toResponseDto(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      walletBalanceCents: user.walletBalance.cents,
      walletBalanceFormatted: user.walletBalance.toString(),
      locationId: user.locationId,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
