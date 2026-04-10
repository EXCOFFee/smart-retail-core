/**
 * ============================================================================
 * SMART_RETAIL - Money Value Object (Dominio Puro)
 * ============================================================================
 * Representa un valor monetario inmutable con precisión decimal.
 * 
 * ARQUITECTURA: Capa de DOMINIO 🟢
 * 
 * Por qué Value Object: El dinero tiene comportamiento propio (suma, resta,
 * comparación) y debe garantizar precisión. Encapsular esto evita errores
 * de punto flotante dispersos por todo el código.
 * 
 * ⚠️ REGLA 8 (AGENTS.md): Prohibido float/double para dinero.
 * Internamente trabajamos con centavos (enteros) para evitar precisión.
 * ============================================================================
 */

/**
 * Value Object inmutable para representar valores monetarios.
 * 
 * Internamente almacena el valor en centavos (entero) para evitar
 * problemas de precisión con decimales de punto flotante.
 * 
 * Ejemplo: $10.50 se almacena como 1050 centavos
 */
export class Money {
  /**
   * Valor en centavos (entero)
   * Por qué private: El valor interno no debe ser modificable.
   */
  private readonly _cents: number;

  /**
   * Constructor privado - Usar métodos factory
   * 
   * @param cents - Valor en centavos
   */
  private constructor(cents: number) {
    // Validación defensiva: solo enteros positivos o cero
    if (!Number.isInteger(cents)) {
      throw new Error('Money cents must be an integer');
    }
    if (cents < 0) {
      throw new Error('Money cannot be negative');
    }
    this._cents = cents;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FACTORY METHODS
  // Por qué factories: Proporcionan formas claras y seguras de crear Money
  // desde diferentes fuentes (decimal, centavos, string).
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Crea Money desde un valor decimal (formato humano).
   * 
   * @param amount - Valor decimal (ej: 10.50)
   * @returns Instancia de Money
   * 
   * @example
   * const price = Money.fromDecimal(10.50); // 1050 cents
   */
  static fromDecimal(amount: number): Money {
    // Multiplicamos por 100 y redondeamos para evitar errores de flotante
    const cents = Math.round(amount * 100);
    return new Money(cents);
  }

  /**
   * Crea Money desde centavos (formato interno).
   * 
   * @param cents - Valor en centavos (ej: 1050)
   * @returns Instancia de Money
   */
  static fromCents(cents: number): Money {
    return new Money(cents);
  }

  /**
   * Crea Money con valor cero.
   * 
   * @returns Money con valor 0
   */
  static zero(): Money {
    return new Money(0);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GETTERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Obtiene el valor en formato decimal (para mostrar al usuario).
   * 
   * @returns Valor decimal (ej: 10.50)
   */
  get amount(): number {
    return this._cents / 100;
  }

  /**
   * Obtiene el valor en centavos (para cálculos internos).
   * 
   * @returns Valor en centavos (ej: 1050)
   */
  get cents(): number {
    return this._cents;
  }

  /**
   * Obtiene el valor en formato decimal.
   * Alias de amount para APIs que esperan toDecimal().
   * 
   * @returns Valor decimal (ej: 10.50)
   */
  toDecimal(): number {
    return this.amount;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // OPERACIONES ARITMÉTICAS
  // Por qué retornan nuevo Money: Inmutabilidad - Las operaciones no
  // modifican la instancia original, sino que crean una nueva.
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Suma otro Money a este.
   * 
   * @param other - Money a sumar
   * @returns Nuevo Money con la suma
   */
  add(other: Money): Money {
    return new Money(this._cents + other._cents);
  }

  /**
   * Resta otro Money de este.
   * 
   * @param other - Money a restar
   * @returns Nuevo Money con la diferencia
   * @throws Error si el resultado sería negativo
   */
  subtract(other: Money): Money {
    const result = this._cents - other._cents;
    if (result < 0) {
      throw new Error('Money subtraction would result in negative value');
    }
    return new Money(result);
  }

  /**
   * Multiplica por una cantidad (para calcular totales).
   * 
   * @param quantity - Cantidad por la cual multiplicar
   * @returns Nuevo Money con el producto
   */
  multiply(quantity: number): Money {
    if (quantity < 0) {
      throw new Error('Cannot multiply Money by negative quantity');
    }
    return new Money(Math.round(this._cents * quantity));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // COMPARACIONES
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Compara si este Money es igual a otro.
   */
  equals(other: Money): boolean {
    return this._cents === other._cents;
  }

  /**
   * Compara si este Money es mayor que otro.
   */
  isGreaterThan(other: Money): boolean {
    return this._cents > other._cents;
  }

  /**
   * Compara si este Money es mayor o igual que otro.
   */
  isGreaterThanOrEqual(other: Money): boolean {
    return this._cents >= other._cents;
  }

  /**
   * Compara si este Money es menor que otro.
   */
  isLessThan(other: Money): boolean {
    return this._cents < other._cents;
  }

  /**
   * Verifica si el valor es cero.
   */
  isZero(): boolean {
    return this._cents === 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SERIALIZACIÓN
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Convierte a string formateado (para logs y debugging).
   * 
   * @returns String con formato "10.50"
   */
  toString(): string {
    return this.amount.toFixed(2);
  }

  /**
   * Convierte a objeto plano (para serialización JSON).
   * 
   * @returns Objeto con cents y amount
   */
  toJSON(): { cents: number; amount: number } {
    return {
      cents: this._cents,
      amount: this.amount,
    };
  }
}
