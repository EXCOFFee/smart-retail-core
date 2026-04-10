/**
 * ============================================================================
 * SMART_RETAIL - UserController Tests
 * ============================================================================
 * Tests unitarios para el controlador de usuarios.
 * ============================================================================
 */

import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { USER_REPOSITORY } from '../../../src/application/ports/output/repositories.port';
import { User, UserRole } from '../../../src/domain/entities/user.entity';
import { Money } from '../../../src/domain/value-objects/money.value-object';
import { AuthenticatedUser } from '../../../src/infrastructure/auth/strategies/jwt.strategy';
import { UserController } from '../../../src/interfaces/http/controllers/user.controller';
import { CreateUserDto, CreateUserRoleDto, WalletOperationType } from '../../../src/interfaces/http/dto/user.dto';

describe('UserController', () => {
  let controller: UserController;
  let userRepository: {
    findById: jest.Mock;
    findByEmail: jest.Mock;
    save: jest.Mock;
    updateBalance: jest.Mock;
  };

  const mockUserRepository = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    save: jest.fn(),
    updateBalance: jest.fn(),
  };

  const createMockUser = (overrides = {}) => {
    return new User({
      id: 'user-123',
      email: 'test@example.com',
      fullName: 'Test User',
      passwordHash: 'hashedpassword',
      role: 'consumer' as UserRole,
      walletBalance: Money.fromCents(5000),
      locationId: 'loc-001',
      ...overrides,
    });
  };

  const mockCurrentUser = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'admin' as const,
    locationId: 'loc-001',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: USER_REPOSITORY,
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    userRepository = module.get(USER_REPOSITORY);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE USER
  // ─────────────────────────────────────────────────────────────────────────

  describe('createUser', () => {
    const createDto: CreateUserDto = {
      email: 'new@example.com',
      password: 'SecurePass123!',
      fullName: 'New User',
      role: CreateUserRoleDto.CONSUMER,
      locationId: '550e8400-e29b-41d4-a716-446655440001',
    };

    it('should create a user successfully', async () => {
      const mockUser = createMockUser({ email: 'new@example.com', fullName: 'New User' });
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.save.mockResolvedValue(mockUser);

      const result = await controller.createUser(createDto);

      expect(userRepository.findByEmail).toHaveBeenCalledWith('new@example.com');
      expect(userRepository.save).toHaveBeenCalled();
      expect(result.email).toBe('new@example.com');
    });

    it('should throw ConflictException for duplicate email', async () => {
      const existingUser = createMockUser();
      mockUserRepository.findByEmail.mockResolvedValue(existingUser);

      await expect(controller.createUser(createDto)).rejects.toThrow(ConflictException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET USER
  // ─────────────────────────────────────────────────────────────────────────

  describe('getUser', () => {
    it('should return a user by ID for admin', async () => {
      const mockUser = createMockUser();
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await controller.getUser('user-123', mockCurrentUser);

      expect(userRepository.findById).toHaveBeenCalledWith('user-123');
      expect(result.id).toBe('user-123');
    });

    it('should allow user to view their own profile', async () => {
      const mockUser = createMockUser();
      const selfUser: AuthenticatedUser = { ...mockCurrentUser, role: 'consumer' };
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await controller.getUser('user-123', selfUser);

      expect(result.id).toBe('user-123');
    });

    it('should throw ForbiddenException for non-admin viewing other user', async () => {
      const consumerUser: AuthenticatedUser = { id: 'other-user', email: 'other@test.com', role: 'consumer', locationId: 'loc-001' };

      await expect(controller.getUser('user-123', consumerUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException for non-existent user', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(controller.getUser('non-existent', mockCurrentUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE USER
  // ─────────────────────────────────────────────────────────────────────────

  describe('updateUser', () => {
    const updateDto = {
      fullName: 'Updated Name',
    };

    it('should update a user successfully', async () => {
      const existingUser = createMockUser();
      const updatedUser = createMockUser({ fullName: 'Updated Name' });
      
      mockUserRepository.findById.mockResolvedValue(existingUser);
      mockUserRepository.save.mockResolvedValue(updatedUser);

      const result = await controller.updateUser('user-123', updateDto);

      expect(userRepository.findById).toHaveBeenCalledWith('user-123');
      expect(userRepository.save).toHaveBeenCalled();
      expect(result.fullName).toBe('Updated Name');
    });

    it('should throw NotFoundException for non-existent user', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(controller.updateUser('non-existent', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // WALLET OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  describe('walletOperation', () => {
    it('should add balance to wallet', async () => {
      const existingUser = createMockUser({ walletBalance: Money.fromCents(5000) });
      const updatedUser = createMockUser({ walletBalance: Money.fromCents(6000) });
      
      mockUserRepository.findById
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce(updatedUser);
      mockUserRepository.updateBalance.mockResolvedValue(undefined);

      const result = await controller.walletOperation('user-123', {
        operation: WalletOperationType.ADD,
        amountCents: 1000,
      });

      expect(userRepository.updateBalance).toHaveBeenCalledWith('user-123', 6000);
      expect(result.walletBalanceCents).toBe(6000);
    });

    it('should deduct balance from wallet', async () => {
      const existingUser = createMockUser({ walletBalance: Money.fromCents(5000) });
      const updatedUser = createMockUser({ walletBalance: Money.fromCents(4000) });
      
      mockUserRepository.findById
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce(updatedUser);
      mockUserRepository.updateBalance.mockResolvedValue(undefined);

      const result = await controller.walletOperation('user-123', {
        operation: WalletOperationType.DEDUCT,
        amountCents: 1000,
      });

      expect(userRepository.updateBalance).toHaveBeenCalledWith('user-123', 4000);
      expect(result.walletBalanceCents).toBe(4000);
    });

    it('should throw BadRequestException for insufficient balance', async () => {
      const existingUser = createMockUser({ walletBalance: Money.fromCents(500) });
      mockUserRepository.findById.mockResolvedValue(existingUser);

      await expect(
        controller.walletOperation('user-123', {
          operation: WalletOperationType.DEDUCT,
          amountCents: 1000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when user not found for wallet operation', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        controller.walletOperation('non-existent', {
          operation: WalletOperationType.ADD,
          amountCents: 1000,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when user disappears after update', async () => {
      const existingUser = createMockUser({ walletBalance: Money.fromCents(5000) });
      
      mockUserRepository.findById
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce(null); // User disappears after update
      mockUserRepository.updateBalance.mockResolvedValue(undefined);

      await expect(
        controller.walletOperation('user-123', {
          operation: WalletOperationType.ADD,
          amountCents: 1000,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // LIST USERS
  // ─────────────────────────────────────────────────────────────────────────

  describe('listUsers', () => {
    it('should return empty list (TODO implementation)', async () => {
      const result = await controller.listUsers({});

      expect(result.users).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE USER
  // ─────────────────────────────────────────────────────────────────────────

  describe('deleteUser', () => {
    it('should deactivate a user (soft delete)', async () => {
      const existingUser = createMockUser();
      const deactivatedUser = createMockUser({ isActive: false });
      
      mockUserRepository.findById.mockResolvedValue(existingUser);
      mockUserRepository.save.mockResolvedValue(deactivatedUser);

      await controller.deleteUser('user-123');

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('should throw NotFoundException for non-existent user', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(controller.deleteUser('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
