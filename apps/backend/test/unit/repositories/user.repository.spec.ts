/**
 * Tests para UserRepository (Unit con mocks)
 */

import { Repository, UpdateResult } from 'typeorm';

import { User } from '@domain/entities/user.entity';
import { Money } from '@domain/value-objects/money.value-object';
import { UserOrmEntity } from '@infrastructure/database/entities/user.orm-entity';
import { UserRepository } from '@infrastructure/database/repositories/user.repository';

/**
 * Crea un UpdateResult tipado para TypeORM.
 */
function createUpdateResult(affected: number): UpdateResult {
  return { raw: [], affected, generatedMaps: [] };
}

describe('UserRepository', () => {
  let repository: UserRepository;
  let mockTypeOrmRepo: jest.Mocked<Repository<UserOrmEntity>>;

  const mockOrmUser: UserOrmEntity = {
    id: 'user-123',
    email: 'test@example.com',
    fullName: 'Test User',
    passwordHash: 'hashed-password',
    role: 'consumer',
    walletBalanceCents: 50000,
    locationId: 'loc-1',
    isActive: true,
    lastLoginAt: new Date('2025-01-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2025-01-15'),
  } as UserOrmEntity;

  beforeEach(() => {
    mockTypeOrmRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<UserOrmEntity>>;

    repository = new UserRepository(mockTypeOrmRepo);
  });

  describe('findById', () => {
    it('should return domain user when found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockOrmUser);

      const result = await repository.findById('user-123');

      expect(result).toBeInstanceOf(User);
      expect(result?.id).toBe('user-123');
      expect(result?.email).toBe('test@example.com');
      expect(result?.fullName).toBe('Test User');
      expect(result?.role).toBe('consumer');
      expect(result?.walletBalance.cents).toBe(50000);
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
    });

    it('should return null when user not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should handle user without lastLoginAt', async () => {
      const ormWithoutLogin = { ...mockOrmUser, lastLoginAt: null };
      mockTypeOrmRepo.findOne.mockResolvedValue(ormWithoutLogin as UserOrmEntity);

      const result = await repository.findById('user-123');

      expect(result).not.toBeNull();
      expect(result?.lastLoginAt).toBeUndefined();
    });
  });

  describe('findByEmail', () => {
    it('should return domain user when found by email', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(mockOrmUser);

      const result = await repository.findByEmail('test@example.com');

      expect(result).toBeInstanceOf(User);
      expect(result?.email).toBe('test@example.com');
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null when email not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.findByEmail('unknown@example.com');

      expect(result).toBeNull();
    });
  });

  describe('save', () => {
    it('should persist user and return domain entity', async () => {
      const domainUser = new User({
        id: 'new-user-456',
        email: 'new@example.com',
        fullName: 'New User',
        passwordHash: 'new-hash',
        role: 'merchant',
        walletBalance: Money.fromCents(10000),
        locationId: 'loc-2',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const savedOrm = {
        ...mockOrmUser,
        id: 'new-user-456',
        email: 'new@example.com',
        fullName: 'New User',
        role: 'merchant',
        walletBalanceCents: 10000,
      };

      mockTypeOrmRepo.save.mockResolvedValue(savedOrm as UserOrmEntity);

      const result = await repository.save(domainUser);

      expect(result).toBeInstanceOf(User);
      expect(result.id).toBe('new-user-456');
      expect(mockTypeOrmRepo.save).toHaveBeenCalled();
    });

    it('should map all domain fields to ORM entity', async () => {
      const domainUser = new User({
        id: 'user-xyz',
        email: 'full@example.com',
        fullName: 'Full User',
        passwordHash: 'super-hash',
        role: 'admin',
        walletBalance: Money.fromCents(999999),
        locationId: 'loc-admin',
        isActive: false,
        lastLoginAt: new Date('2025-01-20'),
        createdAt: new Date('2024-06-01'),
        updatedAt: new Date('2025-01-20'),
      });

      mockTypeOrmRepo.save.mockImplementation(async (entity) => entity as UserOrmEntity);

      await repository.save(domainUser);

      const savedEntity = mockTypeOrmRepo.save.mock.calls[0][0] as UserOrmEntity;
      expect(savedEntity.id).toBe('user-xyz');
      expect(savedEntity.email).toBe('full@example.com');
      expect(savedEntity.passwordHash).toBe('super-hash');
      expect(savedEntity.role).toBe('admin');
      expect(savedEntity.walletBalanceCents).toBe(999999);
      expect(savedEntity.isActive).toBe(false);
    });
  });

  describe('updateBalance', () => {
    it('should update balance atomically', async () => {
      mockTypeOrmRepo.update.mockResolvedValue(createUpdateResult(1));

      await repository.updateBalance('user-123', 75000);

      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        { id: 'user-123' },
        expect.objectContaining({
          walletBalanceCents: 75000,
          updatedAt: expect.any(Date),
        }),
      );
    });

    it('should set new balance to zero', async () => {
      mockTypeOrmRepo.update.mockResolvedValue(createUpdateResult(1));

      await repository.updateBalance('user-123', 0);

      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        { id: 'user-123' },
        expect.objectContaining({ walletBalanceCents: 0 }),
      );
    });
  });

  describe('toDomain mapping', () => {
    it('should correctly convert walletBalanceCents to Money', async () => {
      const ormWithLargeBalance = { ...mockOrmUser, walletBalanceCents: 1234567 };
      mockTypeOrmRepo.findOne.mockResolvedValue(ormWithLargeBalance as UserOrmEntity);

      const result = await repository.findById('user-123');

      expect(result?.walletBalance.cents).toBe(1234567);
      expect(result?.walletBalance.toDecimal()).toBe(12345.67);
    });

    it('should handle all user roles', async () => {
      const roles = ['consumer', 'merchant', 'operator', 'admin'] as const;

      for (const role of roles) {
        const ormWithRole = { ...mockOrmUser, role };
        mockTypeOrmRepo.findOne.mockResolvedValue(ormWithRole as UserOrmEntity);

        const result = await repository.findById('user-123');

        expect(result?.role).toBe(role);
      }
    });
  });
});
