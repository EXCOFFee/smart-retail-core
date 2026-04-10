/**
 * ============================================================================
 * SMART_RETAIL - AuthController Tests
 * ============================================================================
 * Tests unitarios para el controlador de autenticación.
 * 
 * Por qué: AuthController es crítico - bloquea todo el login del sistema.
 * ============================================================================
 */

import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../../src/application/services/auth.service';
import { AuthController } from '../../../src/interfaces/http/controllers/auth.controller';
import { RegisterDto, RegisterRoleDto } from '../../../src/interfaces/http/dto/auth.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockAuthService = {
    login: jest.fn(),
    register: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn(),
    getProfile: jest.fn(),
    changePassword: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────────────────────────────────────

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'SecurePass123!',
    };

    const mockAuthResponse = {
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-456',
      expiresIn: 900,
      user: {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'consumer',
      },
    };

    it('should login successfully with valid credentials', async () => {
      mockAuthService.login.mockResolvedValue(mockAuthResponse);

      const result = await controller.login(loginDto);

      expect(authService.login).toHaveBeenCalledWith(loginDto.email, loginDto.password);
      expect(result).toEqual(mockAuthResponse);
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      await expect(controller.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // REGISTER
  // ─────────────────────────────────────────────────────────────────────────

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'new@example.com',
      password: 'SecurePass123!',
      fullName: 'New User',
      role: RegisterRoleDto.CONSUMER,
      locationId: '550e8400-e29b-41d4-a716-446655440001',
    };

    const mockAuthResponse = {
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-456',
      expiresIn: 900,
      user: {
        id: 'user-new',
        email: 'new@example.com',
        fullName: 'New User',
        role: 'consumer',
      },
    };

    it('should register a new user successfully', async () => {
      mockAuthService.register.mockResolvedValue(mockAuthResponse);

      const result = await controller.register(registerDto);

      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(mockAuthResponse);
    });

    it('should throw ConflictException for duplicate email', async () => {
      mockAuthService.register.mockRejectedValue(
        new ConflictException('User with this email already exists'),
      );

      await expect(controller.register(registerDto)).rejects.toThrow(ConflictException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // REFRESH TOKEN
  // ─────────────────────────────────────────────────────────────────────────

  describe('refresh', () => {
    const refreshDto = {
      refreshToken: 'valid-refresh-token',
    };

    const mockAuthResponse = {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 900,
      user: {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'consumer',
      },
    };

    it('should refresh tokens successfully', async () => {
      mockAuthService.refreshToken.mockResolvedValue(mockAuthResponse);

      const result = await controller.refresh(refreshDto);

      expect(authService.refreshToken).toHaveBeenCalledWith(refreshDto.refreshToken);
      expect(result).toEqual(mockAuthResponse);
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      mockAuthService.refreshToken.mockRejectedValue(
        new UnauthorizedException('Invalid refresh token'),
      );

      await expect(controller.refresh(refreshDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────────────────────────────────────

  describe('logout', () => {
    const currentUser = {
      id: 'user-123',
      email: 'test@example.com',
      role: 'consumer' as const,
      locationId: 'loc-001',
    };

    it('should logout successfully', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      await controller.logout(currentUser, {});

      expect(authService.logout).toHaveBeenCalledWith(currentUser.id, undefined);
    });

    it('should logout with specific refresh token', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      await controller.logout(currentUser, { refreshToken: 'token-to-revoke' });

      expect(authService.logout).toHaveBeenCalledWith(currentUser.id, 'token-to-revoke');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET PROFILE
  // ─────────────────────────────────────────────────────────────────────────

  describe('getProfile', () => {
    const currentUser = {
      id: 'user-123',
      email: 'test@example.com',
      role: 'consumer' as const,
      locationId: 'loc-001',
    };

    const mockProfile = {
      id: 'user-123',
      email: 'test@example.com',
      fullName: 'Test User',
      role: 'consumer',
      walletBalanceCents: 5000,
      walletBalanceFormatted: '$50.00',
      locationId: 'loc-001',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return user profile', async () => {
      mockAuthService.getProfile.mockResolvedValue(mockProfile);

      const result = await controller.getProfile(currentUser);

      expect(authService.getProfile).toHaveBeenCalledWith(currentUser.id);
      expect(result).toEqual(mockProfile);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CHANGE PASSWORD
  // ─────────────────────────────────────────────────────────────────────────

  describe('changePassword', () => {
    const currentUser = {
      id: 'user-123',
      email: 'test@example.com',
      role: 'consumer' as const,
      locationId: 'loc-001',
    };

    const changePasswordDto = {
      currentPassword: 'OldPass123!',
      newPassword: 'NewPass456!',
    };

    it('should change password successfully', async () => {
      mockAuthService.changePassword.mockResolvedValue(undefined);

      await controller.changePassword(currentUser, changePasswordDto);

      expect(authService.changePassword).toHaveBeenCalledWith(
        currentUser.id,
        changePasswordDto.currentPassword,
        changePasswordDto.newPassword,
      );
    });

    it('should throw UnauthorizedException for wrong current password', async () => {
      mockAuthService.changePassword.mockRejectedValue(
        new UnauthorizedException('Current password is incorrect'),
      );

      await expect(
        controller.changePassword(currentUser, changePasswordDto),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
