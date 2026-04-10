/**
 * ============================================================================
 * SMART_RETAIL - User ORM Entity (Infraestructura)
 * ============================================================================
 * Entidad TypeORM para persistencia de usuarios en PostgreSQL.
 * 
 * ARQUITECTURA: Capa de INFRAESTRUCTURA 🔴
 * 
 * Por qué separar de la entidad de dominio:
 * - La entidad de dominio es PURA (sin decoradores de frameworks)
 * - Esta entidad tiene decoradores de TypeORM (@Entity, @Column)
 * - Un "mapper" convierte entre ambas representaciones
 * 
 * Esto respeta el principio de Dependency Inversion: el dominio no
 * depende de la infraestructura.
 * ============================================================================
 */

import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class UserOrmEntity {
  /**
   * ID único del usuario (UUID v4)
   * Por qué UUID: Evita exposición de secuencias y facilita distribución.
   */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Email del usuario
   * Por qué unique index: El email es el identificador natural del usuario.
   */
  @Column({ type: 'varchar', length: 255, unique: true })
  @Index('IDX_USER_EMAIL')
  email!: string;

  /**
   * Hash de la contraseña (bcrypt o argon2)
   * Por qué varchar(255): Suficiente para cualquier algoritmo de hash.
   */
  @Column({ type: 'varchar', length: 255, name: 'password_hash' })
  passwordHash!: string;

  /**
   * Saldo de la billetera en centavos
   * 
   * CRÍTICO (Regla 8): Usamos integer para centavos, NO decimal.
   * Esto evita problemas de precisión en operaciones aritméticas.
   * 
   * Ejemplo: $10.50 se almacena como 1050
   */
  @Column({ type: 'integer', default: 0, name: 'wallet_balance_cents' })
  walletBalanceCents!: number;

  /**
   * Nombre completo del usuario
   */
  @Column({ type: 'varchar', length: 255, name: 'full_name' })
  fullName!: string;

  /**
   * Rol del usuario en el sistema
   */
  @Column({
    type: 'varchar',
    length: 20,
    default: 'consumer',
  })
  role!: string;

  /**
   * ID de la ubicación asociada al usuario
   * Por qué: Single-tenant multi-location (DA-03)
   */
  @Column({ type: 'uuid', name: 'location_id' })
  @Index('IDX_USER_LOCATION')
  locationId!: string;

  /**
   * Número de teléfono (opcional, para notificaciones)
   */
  @Column({ type: 'varchar', length: 50, nullable: true, name: 'phone_number' })
  phoneNumber?: string | null;

  /**
   * Si el usuario está activo
   * Por qué: Soft delete - No eliminamos usuarios, los desactivamos.
   */
  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;

  /**
   * Fecha de creación (automática)
   */
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  /**
   * Fecha de última actualización (automática)
   */
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  /**
   * Fecha del último login (para auditoría)
   */
  @Column({ type: 'timestamptz', nullable: true, name: 'last_login_at' })
  lastLoginAt?: Date | null;
}
