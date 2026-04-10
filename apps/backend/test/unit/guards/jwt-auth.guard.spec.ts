/**
 * ============================================================================
 * SMART_RETAIL - JwtAuthGuard Tests
 * ============================================================================
 * Tests unitarios para el guard de autenticación JWT.
 * ============================================================================
 */

import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../../../src/infrastructure/auth/guards/jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  const createMockExecutionContext = (overrides = {}): ExecutionContext => ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({ headers: {} }),
      getResponse: jest.fn(),
    }),
    getType: jest.fn(),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    ...overrides,
  });

  beforeEach(() => {
    reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride');
    guard = new JwtAuthGuard(reflector);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate - public routes', () => {
    it('should allow access to public routes', () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
      const context = createMockExecutionContext();

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('handleRequest', () => {
    it('should return user when authentication succeeds', () => {
      const mockUser = { sub: 'user-001', email: 'test@example.com' };

      const result = guard.handleRequest(null, mockUser, undefined);

      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException when error is present', () => {
      const error = new Error('Auth failed');

      expect(() => guard.handleRequest(error, false, undefined)).toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user is false', () => {
      expect(() => guard.handleRequest(null, false, undefined)).toThrow(
        UnauthorizedException,
      );
    });

    it('should include specific message for TokenExpiredError', () => {
      try {
        guard.handleRequest(null, false, { name: 'TokenExpiredError' });
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect((error as UnauthorizedException).message).toBe('Token has expired');
      }
    });

    it('should include specific message for JsonWebTokenError', () => {
      try {
        guard.handleRequest(null, false, { name: 'JsonWebTokenError' });
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect((error as UnauthorizedException).message).toBe('Invalid token');
      }
    });

    it('should use info.message if available', () => {
      try {
        guard.handleRequest(null, false, { message: 'Custom error message' });
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect((error as UnauthorizedException).message).toBe('Custom error message');
      }
    });

    it('should use default message when no info provided', () => {
      try {
        guard.handleRequest(null, false, undefined);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect((error as UnauthorizedException).message).toBe('Authentication required');
      }
    });
  });
});
