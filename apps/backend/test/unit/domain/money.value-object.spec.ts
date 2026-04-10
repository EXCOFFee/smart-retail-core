/**
 * ============================================================================
 * SMART_RETAIL - Money Value Object Tests
 * ============================================================================
 * Tests unitarios para el Value Object Money.
 * 
 * Por qué: Money es crítico para toda la lógica financiera.
 * Regla 8 del SRS: NUNCA usar float/double para dinero.
 * ============================================================================
 */

import { Money } from '../../../src/domain/value-objects/money.value-object';

describe('Money Value Object', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // CREACIÓN
  // ─────────────────────────────────────────────────────────────────────────

  describe('Creation', () => {
    it('should create Money from cents', () => {
      const money = Money.fromCents(1050);
      expect(money.cents).toBe(1050);
      expect(money.amount).toBe(10.50);
    });

    it('should create Money from decimal amount', () => {
      const money = Money.fromDecimal(10.50);
      expect(money.cents).toBe(1050);
      expect(money.amount).toBe(10.50);
    });

    it('should create zero Money', () => {
      const money = Money.zero();
      expect(money.cents).toBe(0);
      expect(money.isZero()).toBe(true);
    });

    it('should throw error for negative cents', () => {
      expect(() => Money.fromCents(-100)).toThrow();
    });

    it('should throw error for negative decimal', () => {
      expect(() => Money.fromDecimal(-10.50)).toThrow();
    });

    it('should throw error for non-integer cents', () => {
      expect(() => Money.fromCents(10.5)).toThrow('Money cents must be an integer');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // OPERACIONES ARITMÉTICAS
  // ─────────────────────────────────────────────────────────────────────────

  describe('Arithmetic Operations', () => {
    it('should add two Money values', () => {
      const a = Money.fromCents(1000);
      const b = Money.fromCents(500);
      const result = a.add(b);
      
      expect(result.cents).toBe(1500);
    });

    it('should subtract Money values', () => {
      const a = Money.fromCents(1000);
      const b = Money.fromCents(300);
      const result = a.subtract(b);
      
      expect(result.cents).toBe(700);
    });

    it('should throw when subtracting more than available', () => {
      const a = Money.fromCents(100);
      const b = Money.fromCents(500);
      
      expect(() => a.subtract(b)).toThrow();
    });

    it('should multiply Money by a factor', () => {
      const money = Money.fromCents(1000);
      const result = money.multiply(3);
      
      expect(result.cents).toBe(3000);
    });

    it('should throw when multiplying by negative factor', () => {
      const money = Money.fromCents(1000);
      
      expect(() => money.multiply(-2)).toThrow('Cannot multiply Money by negative quantity');
    });

    it('should handle decimal multiplication with rounding', () => {
      const money = Money.fromCents(1000);
      const result = money.multiply(1.5);
      
      expect(result.cents).toBe(1500);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // COMPARACIONES
  // ─────────────────────────────────────────────────────────────────────────

  describe('Comparisons', () => {
    it('should compare equality correctly', () => {
      const a = Money.fromCents(1000);
      const b = Money.fromCents(1000);
      const c = Money.fromCents(500);

      expect(a.equals(b)).toBe(true);
      expect(a.equals(c)).toBe(false);
    });

    it('should compare greater than correctly', () => {
      const a = Money.fromCents(1000);
      const b = Money.fromCents(500);

      expect(a.isGreaterThan(b)).toBe(true);
      expect(b.isGreaterThan(a)).toBe(false);
    });

    it('should compare less than correctly', () => {
      const a = Money.fromCents(500);
      const b = Money.fromCents(1000);

      expect(a.isLessThan(b)).toBe(true);
      expect(b.isLessThan(a)).toBe(false);
    });

    it('should check if zero', () => {
      const zero = Money.zero();
      const nonZero = Money.fromCents(100);

      expect(zero.isZero()).toBe(true);
      expect(nonZero.isZero()).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SERIALIZACIÓN
  // ─────────────────────────────────────────────────────────────────────────

  describe('Serialization', () => {
    it('should convert to string correctly', () => {
      const money = Money.fromCents(1050);
      expect(money.toString()).toBe('10.50');
    });

    it('should convert to JSON correctly', () => {
      const money = Money.fromCents(1050);
      const json = money.toJSON();
      
      expect(json.cents).toBe(1050);
      expect(json.amount).toBe(10.50);
    });
  });
});
