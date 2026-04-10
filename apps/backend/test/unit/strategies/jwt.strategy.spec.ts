/**
 * ============================================================================
 * SMART_RETAIL - JwtStrategy Tests
 * ============================================================================
 * Tests unitarios para la estrategia JWT de Passport.
 * ============================================================================
 */

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
    AuthenticatedUser,
    JwtPayload,
    JwtStrategy,
} from '../../../src/infrastructure/auth/strategies/jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let mockConfigService: jest.Mocked<ConfigService>;

  // RSA public key for testing (not real production key)
  const testPublicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0Z3VS5JJcds3TApHxMYG
VOLs0Z0GI1WJm1ygK+1zMnFbh0PEDWMbHc3VAyY1Z+G0VfKrZrFVxU9h7l5z9KJl
tQrPFVGM2sCb3MqYEWMKq5VEu7WI+nqJQZhZqIq5UZ2nVmN2f3HYX2b3yqKQfq3M
DLFXpJC8b7rN5pVH5G3zYzRrD6KvH2JKQO/UJ7w5t1OV3E7Y5n3NQvZr1kQN8DDN
JZcZ8k3X4Cq+3cLdMQp5K0Y9o6pvj0YN3RBksFG7V5x8kPmf3K3yvOXq3UQPL6Sk
k3QjB5g0V9zBQz0P0nZ7qZK5m8K0pN5M3kQjH6k3f7vB4qL8uQ3ZHJ5L3nC6RJJZ
TQIDAQAB
-----END PUBLIC KEY-----`;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn(),
      getOrThrow: jest.fn().mockReturnValue(testPublicKey),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should be defined', () => {
      expect(strategy).toBeDefined();
    });

    it('should load public key from ConfigService', () => {
      expect(mockConfigService.getOrThrow).toHaveBeenCalledWith('JWT_PUBLIC_KEY');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // validate
  // ─────────────────────────────────────────────────────────────────────────

  describe('validate', () => {
    const validPayload: JwtPayload = {
      sub: 'user-001',
      email: 'user@example.com',
      role: 'consumer',
      locationId: 'loc-001',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900,
    };

    it('should return authenticated user for valid payload', async () => {
      const result = await strategy.validate(validPayload);

      expect(result).toEqual<AuthenticatedUser>({
        id: 'user-001',
        email: 'user@example.com',
        role: 'consumer',
        locationId: 'loc-001',
      });
    });

    it('should throw UnauthorizedException for missing sub', async () => {
      const invalidPayload = { ...validPayload, sub: '' };

      await expect(strategy.validate(invalidPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for missing email', async () => {
      const invalidPayload = { ...validPayload, email: '' };

      await expect(strategy.validate(invalidPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for missing role', async () => {
      // Role vacío intencionalmente inválido para probar validación
      const invalidPayload = { ...validPayload, role: '' } as unknown as typeof validPayload;

      await expect(strategy.validate(invalidPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should accept all valid roles', async () => {
      const roles: Array<'consumer' | 'merchant' | 'operator' | 'admin'> = [
        'consumer',
        'merchant',
        'operator',
        'admin',
      ];

      for (const role of roles) {
        const result = await strategy.validate({ ...validPayload, role });
        expect(result.role).toBe(role);
      }
    });

    it('should preserve locationId in authenticated user', async () => {
      const result = await strategy.validate({
        ...validPayload,
        locationId: 'special-location',
      });

      expect(result.locationId).toBe('special-location');
    });
  });
});
