/**
 * ============================================================================
 * SMART_RETAIL - RefreshTokenService Tests
 * ============================================================================
 * Tests unitarios para el servicio de Refresh Tokens.
 * 
 * NOTA: RefreshTokenService instancia Redis directamente en el constructor,
 * por lo que usamos jest.mock para interceptar antes del import.
 * ============================================================================
 */

// Mock ioredis - must be before importing the service
const mockRedis = {
  setex: jest.fn().mockResolvedValue('OK'),
  get: jest.fn(),
  del: jest.fn().mockResolvedValue(1),
  scan: jest.fn().mockResolvedValue(['0', []]),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
};

jest.mock('ioredis', () => ({
  Redis: jest.fn(() => mockRedis),
}));

import { RefreshTokenService } from '@application/services/refresh-token.service';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MockConfigService, createMockConfigService } from '../../utils';

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let mockConfigService: MockConfigService;
  let mockJwtService: {
    sign: jest.Mock;
    verify: jest.Mock;
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    mockConfigService = createMockConfigService({
      JWT_ACCESS_TOKEN_TTL: 900, // 15 minutes
      JWT_REFRESH_TOKEN_TTL: 604800, // 7 days
      REDIS_DB: 0,
      REDIS_PASSWORD: undefined,
    });
    // Override getOrThrow for required values
    mockConfigService.getOrThrow = jest.fn((key: string) => {
      const required: Record<string, unknown> = {
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        JWT_PRIVATE_KEY: `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Z3VS5JJcds3TApHxMYGVOLs
-----END RSA PRIVATE KEY-----`,
      };
      if (!(key in required)) {
        throw new Error(`Config ${key} not found`);
      }
      return required[key];
    });

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock.jwt.token'),
      verify: jest.fn(),
    };

    // Instantiate the service directly with mocked dependencies
    service = new RefreshTokenService(
      mockConfigService as unknown as ConfigService,
      mockJwtService as unknown as JwtService
    );

    // Silence logger
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should load configuration from ConfigService', () => {
      expect(mockConfigService.getOrThrow).toHaveBeenCalledWith('REDIS_HOST');
      expect(mockConfigService.getOrThrow).toHaveBeenCalledWith('REDIS_PORT');
      expect(mockConfigService.getOrThrow).toHaveBeenCalledWith('JWT_PRIVATE_KEY');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // generateTokens
  // ─────────────────────────────────────────────────────────────────────────

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', async () => {
      const result = await service.generateTokens(
        'user-001',
        'user@example.com',
        'consumer',
        'loc-001',
      );

      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.refreshToken).toBeDefined();
      expect(result.accessTokenExpiresAt).toBeInstanceOf(Date);
      expect(result.refreshTokenExpiresAt).toBeInstanceOf(Date);
    });

    it('should sign JWT with RS256 algorithm', async () => {
      await service.generateTokens('user-001', 'user@example.com', 'consumer', 'loc-001');

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-001',
          email: 'user@example.com',
          role: 'consumer',
          locationId: 'loc-001',
        }),
        expect.objectContaining({
          algorithm: 'RS256',
          expiresIn: 900,
        }),
      );
    });

    it('should store refresh token in Redis', async () => {
      await service.generateTokens('user-001', 'user@example.com', 'admin', 'loc-001');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringMatching(/^rt:/),
        604800, // 7 days
        expect.stringContaining('user-001'),
      );
    });

    it('should return expiration dates in the future', async () => {
      const before = new Date();
      const result = await service.generateTokens(
        'user-001',
        'user@example.com',
        'consumer',
        'loc-001',
      );

      expect(result.accessTokenExpiresAt.getTime()).toBeGreaterThan(before.getTime());
      expect(result.refreshTokenExpiresAt.getTime()).toBeGreaterThan(
        result.accessTokenExpiresAt.getTime(),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // refreshTokens
  // ─────────────────────────────────────────────────────────────────────────

  describe('refreshTokens', () => {
    const mockStoredData = {
      userId: 'user-001',
      email: 'user@example.com',
      role: 'merchant',
      locationId: 'loc-001',
      issuedAt: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      expiresAt: Math.floor(Date.now() / 1000) + 86400, // 1 day from now
    };

    it('should refresh tokens successfully', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(mockStoredData));

      const result = await service.refreshTokens('valid-refresh-token');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should delete old token after rotation', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(mockStoredData));

      await service.refreshTokens('old-refresh-token');

      expect(mockRedis.del).toHaveBeenCalledWith(expect.stringMatching(/^rt:/));
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for expired token', async () => {
      const expiredData = {
        ...mockStoredData,
        expiresAt: Math.floor(Date.now() / 1000) - 3600, // expired 1 hour ago
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(expiredData));

      await expect(service.refreshTokens('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should preserve user data in new tokens', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(mockStoredData));

      await service.refreshTokens('valid-token');

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-001',
          email: 'user@example.com',
          role: 'merchant',
          locationId: 'loc-001',
        }),
        expect.anything(),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // revokeToken
  // ─────────────────────────────────────────────────────────────────────────

  describe('revokeToken', () => {
    it('should delete token from Redis', async () => {
      await service.revokeToken('refresh-token-to-revoke');

      expect(mockRedis.del).toHaveBeenCalledWith(expect.stringMatching(/^rt:/));
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // revokeAllUserTokens
  // ─────────────────────────────────────────────────────────────────────────

  describe('revokeAllUserTokens', () => {
    it('should scan and delete all user tokens', async () => {
      const mockStoredData = {
        userId: 'user-001',
        email: 'test@example.com',
        role: 'consumer',
        locationId: 'loc-001',
        issuedAt: Date.now() / 1000,
        expiresAt: Date.now() / 1000 + 86400,
      };

      // Mock scan to return some keys, then done
      mockRedis.scan
        .mockResolvedValueOnce(['100', ['rt:hash1', 'rt:hash2']])
        .mockResolvedValueOnce(['0', []]);
      
      mockRedis.get.mockResolvedValue(JSON.stringify(mockStoredData));

      await service.revokeAllUserTokens('user-001');

      expect(mockRedis.scan).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith('rt:hash1', 'rt:hash2');
    });

    it('should not delete tokens from other users', async () => {
      const otherUserData = {
        userId: 'other-user',
        email: 'other@example.com',
        role: 'consumer',
        locationId: 'loc-002',
        issuedAt: Date.now() / 1000,
        expiresAt: Date.now() / 1000 + 86400,
      };

      mockRedis.scan.mockResolvedValueOnce(['0', ['rt:hash1']]);
      mockRedis.get.mockResolvedValue(JSON.stringify(otherUserData));

      await service.revokeAllUserTokens('user-001');

      // Should not delete since token belongs to other user
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should handle empty token list gracefully', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);

      await expect(service.revokeAllUserTokens('user-001')).resolves.not.toThrow();
    });
  });
});
