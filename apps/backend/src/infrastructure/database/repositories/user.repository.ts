/**
 * ============================================================================
 * SMART_RETAIL - User Repository (TypeORM Implementation)
 * ============================================================================
 * Implementación del puerto IUserRepository usando TypeORM.
 * 
 * ARQUITECTURA: Capa de INFRAESTRUCTURA 🔵 (adapters/database)
 * 
 * Este repositorio TRADUCE entre:
 * - Entidades de Dominio (apps/backend/src/domain/entities)
 * - Entidades ORM (apps/backend/src/infrastructure/database/entities)
 * 
 * ⚠️ PROHIBIDO: Retornar entidades ORM fuera de este archivo.
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IUserRepository } from '@application/ports/output/repositories.port';
import { User } from '@domain/entities/user.entity';
import { Money } from '@domain/value-objects/money.value-object';
import { UserOrmEntity } from '@infrastructure/database/entities/user.orm-entity';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly userRepo: Repository<UserOrmEntity>,
  ) {}

  /**
   * Busca un usuario por ID y lo mapea a entidad de dominio.
   * 
   * @param id - UUID del usuario
   * @returns Usuario de dominio o null si no existe
   */
  async findById(id: string): Promise<User | null> {
    const orm = await this.userRepo.findOne({ where: { id } });
    if (!orm) return null;
    return this.toDomain(orm);
  }

  /**
   * Busca un usuario por email.
   * 
   * @param email - Email del usuario
   * @returns Usuario de dominio o null si no existe
   */
  async findByEmail(email: string): Promise<User | null> {
    const orm = await this.userRepo.findOne({ where: { email } });
    if (!orm) return null;
    return this.toDomain(orm);
  }

  /**
   * Persiste un usuario (crea o actualiza).
   * 
   * @param user - Entidad de dominio del usuario
   * @returns Usuario persistido
   */
  async save(user: User): Promise<User> {
    const orm = this.toOrm(user);
    const saved = await this.userRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Actualiza el balance de la billetera de un usuario.
   * 
   * Por qué método separado: Permite UPDATE atómico sin cargar toda la entidad.
   * Esto previene race conditions en actualizaciones de saldo.
   * 
   * @param userId - ID del usuario
   * @param newBalanceCents - Nuevo balance en centavos
   */
  async updateBalance(userId: string, newBalanceCents: number): Promise<void> {
    await this.userRepo.update(
      { id: userId },
      { walletBalanceCents: newBalanceCents, updatedAt: new Date() },
    );
  }

  /**
   * Mapea entidad ORM a entidad de dominio.
   * 
   * @param orm - Entidad ORM
   * @returns Entidad de dominio
   */
  private toDomain(orm: UserOrmEntity): User {
    return new User({
      id: orm.id,
      email: orm.email,
      fullName: orm.fullName,
      passwordHash: orm.passwordHash,
      role: orm.role as 'consumer' | 'merchant' | 'operator' | 'admin',
      walletBalance: Money.fromCents(orm.walletBalanceCents),
      locationId: orm.locationId,
      isActive: orm.isActive,
      lastLoginAt: orm.lastLoginAt ?? undefined,
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
  private toOrm(domain: User): UserOrmEntity {
    const orm = new UserOrmEntity();
    orm.id = domain.id;
    orm.email = domain.email;
    orm.fullName = domain.fullName;
    orm.passwordHash = domain.passwordHash;
    orm.role = domain.role;
    orm.walletBalanceCents = domain.walletBalance.cents;
    orm.locationId = domain.locationId;
    orm.isActive = domain.isActive;
    orm.lastLoginAt = domain.lastLoginAt ?? null;
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    return orm;
  }
}
