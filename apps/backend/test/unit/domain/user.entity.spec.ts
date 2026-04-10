/**
 * ============================================================================
 * SMART_RETAIL - User Entity Tests
 * ============================================================================
 * Tests unitarios para la entidad User.
 * 
 * Por qué: Validar lógica de negocio de balance de billetera.
 * ============================================================================
 */

import { User, UserRole } from '../../../src/domain/entities/user.entity';
import { Money } from '../../../src/domain/value-objects/money.value-object';

describe('User Entity', () => {
  const createUser = (overrides = {}) => {
    return new User({
      id: 'user-123',
      email: 'test@example.com',
      fullName: 'Test User',
      passwordHash: 'hashedpassword123',
      role: 'consumer' as UserRole,
      walletBalance: Money.fromCents(5000),
      locationId: 'loc-001',
      ...overrides,
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CREACIÓN
  // ─────────────────────────────────────────────────────────────────────────

  describe('Creation', () => {
    it('should create a user with all properties', () => {
      const user = createUser();

      expect(user.id).toBe('user-123');
      expect(user.email).toBe('test@example.com');
      expect(user.fullName).toBe('Test User');
      expect(user.role).toBe('consumer');
      expect(user.walletBalance.cents).toBe(5000);
      expect(user.locationId).toBe('loc-001');
    });

    it('should default to isActive = true', () => {
      const user = createUser();
      expect(user.isActive).toBe(true);
    });

    it('should allow creating inactive user', () => {
      const user = createUser({ isActive: false });
      expect(user.isActive).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // WALLET LOGIC
  // ─────────────────────────────────────────────────────────────────────────

  describe('Wallet Logic', () => {
    it('should return true for hasEnoughBalance when balance is enough', () => {
      const user = createUser({ walletBalance: Money.fromCents(5000) });
      
      expect(user.hasEnoughBalance(Money.fromCents(1000))).toBe(true);
      expect(user.hasEnoughBalance(Money.fromCents(5000))).toBe(true);
    });

    it('should return false for hasEnoughBalance when balance is insufficient', () => {
      const user = createUser({ walletBalance: Money.fromCents(5000) });
      
      expect(user.hasEnoughBalance(Money.fromCents(5001))).toBe(false);
      expect(user.hasEnoughBalance(Money.fromCents(10000))).toBe(false);
    });

    it('should handle zero balance correctly', () => {
      const user = createUser({ walletBalance: Money.zero() });
      
      expect(user.hasEnoughBalance(Money.fromCents(1))).toBe(false);
      expect(user.hasEnoughBalance(Money.zero())).toBe(true);
    });

    it('should deduct balance successfully', () => {
      const user = createUser({ walletBalance: Money.fromCents(5000) });
      user.deductBalance(Money.fromCents(2000));
      
      expect(user.walletBalance.cents).toBe(3000);
    });

    it('should throw when deducting more than balance', () => {
      const user = createUser({ walletBalance: Money.fromCents(1000) });
      
      expect(() => user.deductBalance(Money.fromCents(2000))).toThrow();
    });

    it('should add balance successfully', () => {
      const user = createUser({ walletBalance: Money.fromCents(1000) });
      user.addBalance(Money.fromCents(500));
      
      expect(user.walletBalance.cents).toBe(1500);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ROLES
  // ─────────────────────────────────────────────────────────────────────────

  describe('Roles', () => {
    it('should accept consumer role', () => {
      const user = createUser({ role: 'consumer' as UserRole });
      expect(user.role).toBe('consumer');
    });

    it('should accept merchant role', () => {
      const user = createUser({ role: 'merchant' as UserRole });
      expect(user.role).toBe('merchant');
    });

    it('should accept operator role', () => {
      const user = createUser({ role: 'operator' as UserRole });
      expect(user.role).toBe('operator');
    });

    it('should accept admin role', () => {
      const user = createUser({ role: 'admin' as UserRole });
      expect(user.role).toBe('admin');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TIMESTAMPS
  // ─────────────────────────────────────────────────────────────────────────

  describe('Timestamps', () => {
    it('should set createdAt automatically', () => {
      const user = createUser();
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('should set updatedAt automatically', () => {
      const user = createUser();
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should allow custom lastLoginAt', () => {
      const loginDate = new Date('2026-01-01');
      const user = createUser({ lastLoginAt: loginDate });
      expect(user.lastLoginAt).toEqual(loginDate);
    });
  });
});
