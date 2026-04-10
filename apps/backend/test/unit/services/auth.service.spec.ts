/**
 * ============================================================================
 * SMART_RETAIL - AuthService Tests
 * ============================================================================
 * Tests unitarios para el servicio de autenticación.
 * ============================================================================
 */

import {
    BadRequestException,
    ConflictException,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash } from 'crypto';
import { USER_REPOSITORY } from '../../../src/application/ports/output/repositories.port';
import { AuthService } from '../../../src/application/services/auth.service';
import { RefreshTokenService } from '../../../src/application/services/refresh-token.service';
import { User } from '../../../src/domain/entities/user.entity';
import { Money } from '../../../src/domain/value-objects/money.value-object';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    save: jest.Mock;
  };
  let refreshTokenService: {
    generateTokens: jest.Mock;
    refreshTokens: jest.Mock;
    revokeToken: jest.Mock;
    revokeAllUserTokens: jest.Mock;
  };

  const mockUserRepository = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    save: jest.fn(),
  };

  const mockRefreshTokenService = {
    generateTokens: jest.fn(),
    refreshTokens: jest.fn(),
    revokeToken: jest.fn(),
    revokeAllUserTokens: jest.fn(),
  };

  const hashPassword = (password: string): string =>
    createHash('sha256').update(password).digest('hex');

  const createMockUser = (overrides = {}) => {
    return new User({
      id: 'user-001',
      email: 'test@example.com',
      fullName: 'Test User',
      passwordHash: hashPassword('password123'),
      role: 'consumer',
      walletBalance: Money.zero(),
      locationId: 'loc-001',
      isActive: true,
      lastLoginAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });
  };

  const mockTokenPair = {
    accessToken: 'eyJ...access',
    refreshToken: 'refresh-token-123',
    accessTokenExpiresAt: new Date(Date.now() + 900000), // 15 min
    refreshTokenExpiresAt: new Date(Date.now() + 604800000), // 7 days
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: USER_REPOSITORY, useValue: mockUserRepository },
        { provide: RefreshTokenService, useValue: mockRefreshTokenService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(USER_REPOSITORY);
    refreshTokenService = module.get(RefreshTokenService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockUser = createMockUser();
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);
      mockRefreshTokenService.generateTokens.mockResolvedValue(mockTokenPair);

      const result = await service.login('test@example.com', 'password123');

      expect(userRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(refreshTokenService.generateTokens).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.email,
        mockUser.role,
        mockUser.locationId,
      );
      expect(result.accessToken).toBe(mockTokenPair.accessToken);
      expect(result.refreshToken).toBe(mockTokenPair.refreshToken);
      expect(result.user.email).toBe('test@example.com');
    });

    it('should normalize email (lowercase, trim)', async () => {
      const mockUser = createMockUser();
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);
      mockRefreshTokenService.generateTokens.mockResolvedValue(mockTokenPair);

      await service.login('  TEST@EXAMPLE.COM  ', 'password123');

      expect(userRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(
        service.login('nonexistent@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.login('nonexistent@example.com', 'password123'),
      ).rejects.toThrow('Credenciales inválidas');
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      const inactiveUser = createMockUser({ isActive: false });
      mockUserRepository.findByEmail.mockResolvedValue(inactiveUser);

      await expect(
        service.login('test@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.login('test@example.com', 'password123'),
      ).rejects.toThrow('Usuario desactivado');
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const mockUser = createMockUser();
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(
        service.login('test@example.com', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.login('test@example.com', 'wrongpassword'),
      ).rejects.toThrow('Credenciales inválidas');
    });

    it('should update lastLoginAt on successful login', async () => {
      const mockUser = createMockUser();
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);
      mockRefreshTokenService.generateTokens.mockResolvedValue(mockTokenPair);

      await service.login('test@example.com', 'password123');

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          lastLoginAt: expect.any(Date),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // REGISTER
  // ─────────────────────────────────────────────────────────────────────────

  describe('register', () => {
    const registerDto = {
      email: 'new@example.com',
      password: 'newpassword123',
      fullName: 'New User',
      role: 'consumer' as const,
      locationId: 'loc-001',
    };

    it('should register new user successfully', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.save.mockResolvedValue(undefined);
      mockRefreshTokenService.generateTokens.mockResolvedValue(mockTokenPair);

      const result = await service.register(registerDto);

      expect(userRepository.findByEmail).toHaveBeenCalledWith('new@example.com');
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          fullName: 'New User',
          role: 'consumer',
        }),
      );
      expect(result.accessToken).toBe(mockTokenPair.accessToken);
      expect(result.user.email).toBe('new@example.com');
    });

    it('should normalize email and trim fullName', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.save.mockResolvedValue(undefined);
      mockRefreshTokenService.generateTokens.mockResolvedValue(mockTokenPair);

      await service.register({
        ...registerDto,
        email: '  NEW@EXAMPLE.COM  ',
        fullName: '  New User  ',
      });

      expect(userRepository.findByEmail).toHaveBeenCalledWith('new@example.com');
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          fullName: 'New User',
        }),
      );
    });

    it('should throw ConflictException if email already exists', async () => {
      const existingUser = createMockUser();
      mockUserRepository.findByEmail.mockResolvedValue(existingUser);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      await expect(service.register(registerDto)).rejects.toThrow(
        'El email ya está registrado',
      );
    });

    it('should create user with zero wallet balance', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.save.mockResolvedValue(undefined);
      mockRefreshTokenService.generateTokens.mockResolvedValue(mockTokenPair);

      await service.register(registerDto);

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          walletBalance: expect.objectContaining({ cents: 0 }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // REFRESH TOKEN
  // ─────────────────────────────────────────────────────────────────────────

  describe('refreshToken', () => {
    it('should refresh tokens successfully', async () => {
      const mockUser = createMockUser();
      // Crear un token JWT válido mock
      const mockPayload = {
        sub: 'user-001',
        email: 'test@example.com',
        role: 'consumer',
        locationId: 'loc-001',
      };
      const encodedPayload = Buffer.from(JSON.stringify(mockPayload)).toString('base64url');
      const mockAccessToken = `header.${encodedPayload}.signature`;
      
      mockRefreshTokenService.refreshTokens.mockResolvedValue({
        ...mockTokenPair,
        accessToken: mockAccessToken,
      });
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await service.refreshToken('old-refresh-token');

      expect(refreshTokenService.refreshTokens).toHaveBeenCalledWith('old-refresh-token');
      expect(result.accessToken).toBe(mockAccessToken);
      expect(result.user.id).toBe('user-001');
    });

    it('should throw UnauthorizedException if user not found after refresh', async () => {
      const mockPayload = {
        sub: 'deleted-user',
        email: 'deleted@example.com',
        role: 'consumer',
        locationId: 'loc-001',
      };
      const encodedPayload = Buffer.from(JSON.stringify(mockPayload)).toString('base64url');
      const mockAccessToken = `header.${encodedPayload}.signature`;

      mockRefreshTokenService.refreshTokens.mockResolvedValue({
        ...mockTokenPair,
        accessToken: mockAccessToken,
      });
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(service.refreshToken('refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('should revoke specific token when provided', async () => {
      mockRefreshTokenService.revokeToken.mockResolvedValue(undefined);

      await service.logout('user-001', 'specific-refresh-token');

      expect(refreshTokenService.revokeToken).toHaveBeenCalledWith('specific-refresh-token');
      expect(refreshTokenService.revokeAllUserTokens).not.toHaveBeenCalled();
    });

    it('should revoke all user tokens when no specific token provided', async () => {
      mockRefreshTokenService.revokeAllUserTokens.mockResolvedValue(undefined);

      await service.logout('user-001');

      expect(refreshTokenService.revokeAllUserTokens).toHaveBeenCalledWith('user-001');
      expect(refreshTokenService.revokeToken).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CHANGE PASSWORD
  // ─────────────────────────────────────────────────────────────────────────

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const mockUser = createMockUser();
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);
      mockRefreshTokenService.revokeAllUserTokens.mockResolvedValue(undefined);

      await service.changePassword('user-001', 'password123', 'newpassword456');

      expect(userRepository.save).toHaveBeenCalled();
      expect(refreshTokenService.revokeAllUserTokens).toHaveBeenCalledWith('user-001');
    });

    it('should throw NotFoundException for non-existent user', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        service.changePassword('non-existent', 'old', 'new'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw UnauthorizedException for wrong current password', async () => {
      const mockUser = createMockUser();
      mockUserRepository.findById.mockResolvedValue(mockUser);

      await expect(
        service.changePassword('user-001', 'wrongpassword', 'newpassword'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.changePassword('user-001', 'wrongpassword', 'newpassword'),
      ).rejects.toThrow('Contraseña actual incorrecta');
    });

    it('should throw BadRequestException if new password equals current', async () => {
      const mockUser = createMockUser();
      mockUserRepository.findById.mockResolvedValue(mockUser);

      await expect(
        service.changePassword('user-001', 'password123', 'password123'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.changePassword('user-001', 'password123', 'password123'),
      ).rejects.toThrow('La nueva contraseña debe ser diferente a la actual');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET PROFILE
  // ─────────────────────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const mockUser = createMockUser({
        walletBalance: Money.fromCents(5000),
      });
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await service.getProfile('user-001');

      expect(result.id).toBe('user-001');
      expect(result.email).toBe('test@example.com');
      expect(result.fullName).toBe('Test User');
      expect(result.walletBalanceCents).toBe(5000);
      expect(result.walletBalanceFormatted).toBe('50.00');
    });

    it('should throw NotFoundException for non-existent user', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(service.getProfile('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
