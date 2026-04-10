/**
 * ============================================================================
 * SMART_RETAIL - User Entity (Dominio Puro)
 * ============================================================================
 * Representa un usuario del sistema con su billetera virtual.
 * 
 * ARQUITECTURA: Capa de DOMINIO 🟢
 * ⚠️ PROHIBIDO: Importar NestJS, TypeORM, o cualquier framework aquí.
 * 
 * Por qué entidad pura: Garantiza que las reglas de negocio no dependan
 * de la infraestructura. Facilita testing y cambios de tecnología.
 * ============================================================================
 */

import { InsufficientBalanceException } from '@domain/exceptions/insufficient-balance.exception';
import { Money } from '@domain/value-objects/money.value-object';

/**
 * Roles disponibles en el sistema
 */
export type UserRole = 'consumer' | 'merchant' | 'operator' | 'admin';

/**
 * Entidad de Usuario del Dominio
 * 
 * Representa a un actor que puede realizar transacciones en el sistema.
 * Contiene la lógica de negocio relacionada con el saldo de la billetera.
 */
export class User {
  /**
   * Identificador único (UUID v4)
   * Por qué UUID: Evita colisiones en sistemas distribuidos y no revela
   * información secuencial (seguridad por oscuridad).
   */
  readonly id: string;

  /**
   * Email del usuario (único en el sistema)
   */
  readonly email: string;

  /**
   * Nombre completo del usuario
   */
  readonly fullName: string;

  /**
   * Hash de la contraseña (nunca el texto plano)
   * Por qué readonly: El hash solo se modifica a través de métodos específicos.
   */
  private _passwordHash: string;

  /**
   * Rol del usuario en el sistema
   */
  readonly role: UserRole;

  /**
   * Saldo actual de la billetera virtual
   * Por qué Money VO: Encapsula la lógica de precisión decimal y moneda.
   */
  private _walletBalance: Money;

  /**
   * ID de la ubicación asociada al usuario
   */
  readonly locationId: string;

  /**
   * Si el usuario está activo
   */
  readonly isActive: boolean;

  /**
   * Fecha del último login
   */
  readonly lastLoginAt?: Date;

  /**
   * Fecha de creación
   */
  readonly createdAt: Date;

  /**
   * Fecha de última actualización
   */
  private _updatedAt: Date;

  constructor(props: {
    id: string;
    email: string;
    fullName: string;
    passwordHash: string;
    role?: UserRole;
    walletBalance: Money;
    locationId: string;
    isActive?: boolean;
    lastLoginAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = props.id;
    this.email = props.email;
    this.fullName = props.fullName;
    this._passwordHash = props.passwordHash;
    this.role = props.role ?? 'consumer';
    this._walletBalance = props.walletBalance;
    this.locationId = props.locationId;
    this.isActive = props.isActive ?? true;
    this.lastLoginAt = props.lastLoginAt;
    this.createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GETTERS (Encapsulación)
  // ─────────────────────────────────────────────────────────────────────────

  get passwordHash(): string {
    return this._passwordHash;
  }

  get walletBalance(): Money {
    return this._walletBalance;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MÉTODOS DE NEGOCIO
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Verifica si el usuario tiene saldo suficiente para una operación.
   * 
   * Por qué método separado de deduct: Permite consultar sin modificar estado.
   * Útil para validaciones previas sin bloquear recursos.
   * 
   * @param amount - Monto a verificar
   * @returns true si tiene saldo suficiente
   */
  hasEnoughBalance(amount: Money): boolean {
    return this._walletBalance.isGreaterThanOrEqual(amount);
  }

  /**
   * Descuenta un monto de la billetera.
   * 
   * Por qué lanza excepción: Fail Fast - Es un error de programación
   * intentar descontar sin verificar primero el saldo.
   * 
   * @param amount - Monto a descontar
   * @throws InsufficientBalanceException si no hay saldo suficiente
   */
  deductBalance(amount: Money): void {
    if (!this.hasEnoughBalance(amount)) {
      throw new InsufficientBalanceException(
        this.id,
        this._walletBalance.amount,
        amount.amount,
      );
    }

    this._walletBalance = this._walletBalance.subtract(amount);
    this._updatedAt = new Date();
  }

  /**
   * Agrega fondos a la billetera (recarga o reembolso).
   * 
   * @param amount - Monto a agregar
   */
  addBalance(amount: Money): void {
    this._walletBalance = this._walletBalance.add(amount);
    this._updatedAt = new Date();
  }

  /**
   * Actualiza el hash de contraseña (cambio de password).
   * 
   * @param newPasswordHash - Nuevo hash de contraseña
   */
  updatePassword(newPasswordHash: string): void {
    this._passwordHash = newPasswordHash;
    this._updatedAt = new Date();
  }
}
