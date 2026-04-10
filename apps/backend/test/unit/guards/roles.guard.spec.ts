/**
 * ============================================================================
 * SMART_RETAIL - RolesGuard Tests
 * ============================================================================
 * Tests unitarios para el guard de autorización por roles.
 * ============================================================================
 */

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { RolesGuard } from '../../../src/infrastructure/auth/guards/roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  const createMockExecutionContext = (user: unknown = null): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user }),
        getResponse: jest.fn(),
      }),
      getType: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
    }) as unknown as ExecutionContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should allow access when no roles are required', () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);
      const context = createMockExecutionContext();

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when roles array is empty', () => {
      mockReflector.getAllAndOverride.mockReturnValue([]);
      const context = createMockExecutionContext();

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user is not authenticated', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['admin']);
      const context = createMockExecutionContext(null);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('User not authenticated');
    });

    it('should allow access when user has required role', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['admin', 'operator']);
      const context = createMockExecutionContext({
        sub: 'user-001',
        email: 'admin@example.com',
        role: 'admin',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when user has one of multiple required roles', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['admin', 'operator']);
      const context = createMockExecutionContext({
        sub: 'user-001',
        email: 'operator@example.com',
        role: 'operator',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user lacks required role', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['admin']);
      const context = createMockExecutionContext({
        sub: 'user-001',
        email: 'consumer@example.com',
        role: 'consumer',
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        'Requires one of the following roles: admin',
      );
    });

    it('should include all required roles in error message', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['admin', 'operator', 'supervisor']);
      const context = createMockExecutionContext({
        sub: 'user-001',
        email: 'consumer@example.com',
        role: 'consumer',
      });

      expect(() => guard.canActivate(context)).toThrow(
        'Requires one of the following roles: admin, operator, supervisor',
      );
    });

    it('should check roles from both handler and class', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['admin']);
      const context = createMockExecutionContext({
        sub: 'user-001',
        role: 'admin',
      });

      guard.canActivate(context);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
        'roles',
        [context.getHandler(), context.getClass()],
      );
    });
  });
});
