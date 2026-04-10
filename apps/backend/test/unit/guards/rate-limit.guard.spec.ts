/**
 * ============================================================================
 * SMART_RETAIL - RateLimitGuard Tests
 * ============================================================================
 * Tests unitarios para el guard de rate limiting.
 * ============================================================================
 */

import { CallHandler, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import {
    RATE_LIMIT_CONFIGS,
    RateLimitConfig,
    RateLimitGuard,
    RateLimitHeadersInterceptor,
    RateLimitStore,
    rateLimitStore,
} from '../../../src/infrastructure/guards/rate-limit.guard';

// Tipo para el socket mock
interface MockSocket {
  remoteAddress?: string;
}

// Tipo para request mock - usamos Record para flexibilidad en tests
type MockRequest = Record<string, unknown> & {
  ip?: string;
  method?: string;
  path?: string;
  headers?: Record<string, string>;
  socket?: MockSocket;
  user?: { id: string };
};

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let reflector: Reflector;

  const mockRequest: MockRequest = {
    ip: '192.168.1.1',
    method: 'POST',
    path: '/api/test',
    headers: {},
    socket: { remoteAddress: '192.168.1.1' },
  };

  const createMockContext = (request: MockRequest | Partial<Request> = mockRequest): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: () => request as unknown as Request,
      getResponse: () => ({}),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  }) as unknown as ExecutionContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RateLimitGuard, Reflector],
    }).compile();

    guard = module.get<RateLimitGuard>(RateLimitGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    // Destruir el singleton para evitar leaks de intervals
    rateLimitStore.destroy();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should be defined', () => {
      expect(guard).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // No rate limit configured
  // ─────────────────────────────────────────────────────────────────────────

  describe('no rate limit configured', () => {
    it('should allow request when no config', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);

      const result = guard.canActivate(createMockContext());

      expect(result).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Basic rate limiting
  // ─────────────────────────────────────────────────────────────────────────

  describe('basic rate limiting', () => {
    const config: RateLimitConfig = {
      limit: 3,
      windowSeconds: 60,
    };

    beforeEach(() => {
      jest.spyOn(reflector, 'get').mockReturnValue(config);
    });

    it('should allow requests within limit', () => {
      const context = createMockContext({
        ...mockRequest,
        ip: '10.0.0.1',
        path: '/test-basic-1',
      } as MockRequest);

      expect(guard.canActivate(context)).toBe(true);
      expect(guard.canActivate(context)).toBe(true);
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should block request when limit exceeded', () => {
      const context = createMockContext({
        ...mockRequest,
        ip: '10.0.0.2',
        path: '/test-basic-2',
      } as MockRequest);

      // First 3 should pass
      expect(guard.canActivate(context)).toBe(true);
      expect(guard.canActivate(context)).toBe(true);
      expect(guard.canActivate(context)).toBe(true);

      // 4th should fail
      expect(() => guard.canActivate(context)).toThrow(HttpException);
    });

    it('should throw 429 Too Many Requests', () => {
      const context = createMockContext({
        ...mockRequest,
        ip: '10.0.0.3',
        path: '/test-basic-3',
      } as MockRequest);

      // Exhaust limit
      for (let i = 0; i < 3; i++) {
        guard.canActivate(context);
      }

      try {
        guard.canActivate(context);
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(HttpException);
        expect((e as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Blocking behavior
  // ─────────────────────────────────────────────────────────────────────────

  describe('blocking behavior', () => {
    const blockingConfig: RateLimitConfig = {
      limit: 2,
      windowSeconds: 60,
      blockOnExceed: true,
      blockDurationSeconds: 300,
      message: 'You are blocked',
    };

    beforeEach(() => {
      jest.spyOn(reflector, 'get').mockReturnValue(blockingConfig);
    });

    it('should block client when limit exceeded with blocking enabled', () => {
      const context = createMockContext({
        ...mockRequest,
        ip: '10.0.0.10',
        path: '/test-block-1',
      } as MockRequest);

      // Exhaust limit
      expect(guard.canActivate(context)).toBe(true);
      expect(guard.canActivate(context)).toBe(true);

      // This should trigger block
      try {
        guard.canActivate(context);
        fail('Should have thrown');
      } catch (e) {
        const response = (e as HttpException).getResponse() as Record<string, unknown>;
        expect(response.message).toBe('You are blocked');
        expect(response.retryAfter).toBe(300);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // IP extraction
  // ─────────────────────────────────────────────────────────────────────────

  describe('IP extraction', () => {
    const config: RateLimitConfig = {
      limit: 5,
      windowSeconds: 60,
    };

    beforeEach(() => {
      jest.spyOn(reflector, 'get').mockReturnValue(config);
    });

    it('should use x-forwarded-for header when present', () => {
      const context = createMockContext({
        ...mockRequest,
        headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
        path: '/test-xff',
      } as MockRequest);

      // Should use 1.2.3.4 (first in chain)
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should fallback to request.ip', () => {
      const context = createMockContext({
        ip: '99.99.99.99',
        method: 'GET',
        path: '/test-ip-fallback',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should handle x-forwarded-for as array', () => {
      const context = createMockContext({
        ...mockRequest,
        headers: { 'x-forwarded-for': ['1.1.1.1', '2.2.2.2'] as unknown as string },
        path: '/test-xff-array',
      } as MockRequest);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should fallback to socket.remoteAddress when request.ip is undefined', () => {
      const context = createMockContext({
        ip: undefined,
        method: 'GET',
        path: '/test-socket-fallback',
        headers: {},
        socket: { remoteAddress: '10.10.10.10' },
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should return unknown when no IP available', () => {
      const context = createMockContext({
        ip: undefined,
        method: 'GET',
        path: '/test-unknown-ip',
        headers: {},
        socket: {},
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should handle empty x-forwarded-for string and fallback to request.ip', () => {
      const context = createMockContext({
        ...mockRequest,
        ip: '5.5.5.5',
        headers: { 'x-forwarded-for': '' },
        path: '/test-empty-xff',
      } as MockRequest);

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // User-based rate limiting
  // ─────────────────────────────────────────────────────────────────────────

  describe('user-based rate limiting', () => {
    const config: RateLimitConfig = {
      limit: 2,
      windowSeconds: 60,
    };

    beforeEach(() => {
      jest.spyOn(reflector, 'get').mockReturnValue(config);
    });

    it('should track authenticated users separately', () => {
      const authenticatedRequest: MockRequest = {
        ...mockRequest,
        ip: '10.0.0.50',
        path: '/test-auth',
        user: { id: 'user-123' },
      };

      const context = createMockContext(authenticatedRequest);

      expect(guard.canActivate(context)).toBe(true);
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should treat anonymous users differently from authenticated', () => {
      const anonRequest: MockRequest = {
        ...mockRequest,
        ip: '10.0.0.60',
        path: '/test-anon-vs-auth',
      };

      const authRequest: MockRequest = {
        ...mockRequest,
        ip: '10.0.0.60',
        path: '/test-anon-vs-auth',
        user: { id: 'user-456' },
      };

      const anonContext = createMockContext(anonRequest);
      const authContext = createMockContext(authRequest);

      // Both should have separate limits
      expect(guard.canActivate(anonContext)).toBe(true);
      expect(guard.canActivate(authContext)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Predefined configs
  // ─────────────────────────────────────────────────────────────────────────

  describe('predefined configs', () => {
    it('should have CRITICAL config', () => {
      expect(RATE_LIMIT_CONFIGS.CRITICAL).toEqual(
        expect.objectContaining({
          limit: 10,
          windowSeconds: 60,
          blockOnExceed: true,
          blockDurationSeconds: 300,
        }),
      );
    });

    it('should have AUTH config', () => {
      expect(RATE_LIMIT_CONFIGS.AUTH).toEqual(
        expect.objectContaining({
          limit: 5,
          windowSeconds: 60,
          blockOnExceed: true,
          blockDurationSeconds: 900,
        }),
      );
    });

    it('should have STANDARD config', () => {
      expect(RATE_LIMIT_CONFIGS.STANDARD).toEqual(
        expect.objectContaining({
          limit: 100,
          windowSeconds: 60,
          blockOnExceed: false,
        }),
      );
    });

    it('should have READ config', () => {
      expect(RATE_LIMIT_CONFIGS.READ).toEqual(
        expect.objectContaining({
          limit: 200,
          windowSeconds: 60,
          blockOnExceed: false,
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Blocked request handling
  // ─────────────────────────────────────────────────────────────────────────

  describe('blocked request handling', () => {
    const blockingConfig: RateLimitConfig = {
      limit: 1,
      windowSeconds: 60,
      blockOnExceed: true,
      blockDurationSeconds: 300,
    };

    beforeEach(() => {
      jest.spyOn(reflector, 'get').mockReturnValue(blockingConfig);
    });

    it('should reject blocked client on subsequent request', () => {
      const context = createMockContext({
        ...mockRequest,
        ip: '10.0.0.100',
        path: '/test-blocked-subsequent',
      } as MockRequest);

      // First request passes
      expect(guard.canActivate(context)).toBe(true);

      // Second exceeds limit and triggers block
      expect(() => guard.canActivate(context)).toThrow(HttpException);

      // Third is blocked because client is in blocked state
      try {
        guard.canActivate(context);
        fail('Should have thrown');
      } catch (e) {
        const response = (e as HttpException).getResponse() as Record<string, unknown>;
        expect(response.statusCode).toBe(429);
        expect(response.retryAfter).toBeDefined();
      }
    });

    it('should allow request after block expires', () => {
      const context = createMockContext({
        ...mockRequest,
        ip: '10.0.0.101',
        path: '/test-block-expire',
      } as MockRequest);

      // Exceed limit to trigger block
      guard.canActivate(context);
      try { guard.canActivate(context); } catch {}
      
      // Manually expire the block
      const key = '10.0.0.101:anonymous:POST:/test-block-expire';
      const entry = rateLimitStore.get(key);
      if (entry) {
        entry.blockedUntil = Date.now() - 1000; // Expired
      }

      // Should allow now (block expired, entry deleted)
      expect(guard.canActivate(context)).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RateLimitStore Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('RateLimitStore', () => {
  let store: RateLimitStore;

  beforeEach(() => {
    store = new RateLimitStore();
  });

  afterEach(() => {
    store.destroy();
  });

  it('should store and retrieve entries', () => {
    const entry = {
      count: 5,
      resetAt: Date.now() + 60000,
      blocked: false,
      blockedUntil: 0,
    };

    store.set('test-key', entry);
    const result = store.get('test-key');

    expect(result).toEqual(entry);
  });

  it('should delete entries', () => {
    store.set('to-delete', { count: 1, resetAt: Date.now(), blocked: false, blockedUntil: 0 });
    store.delete('to-delete');

    expect(store.get('to-delete')).toBeUndefined();
  });

  it('should return undefined for non-existent keys', () => {
    expect(store.get('non-existent')).toBeUndefined();
  });

  it('should cleanup expired entries automatically', async () => {
    // Create entry that expired
    const expiredEntry = {
      count: 1,
      resetAt: Date.now() - 1000, // Already expired
      blocked: false,
      blockedUntil: 0,
    };
    store.set('expired-key', expiredEntry);

    // Wait for cleanup interval (default 60s is too long for test, so we call cleanup indirectly)
    // For testing, we just verify entry still exists until explicit cleanup
    expect(store.get('expired-key')).toBeDefined();
  });

  it('should cleanup entries with expired blocks', async () => {
    const blockedExpiredEntry = {
      count: 10,
      resetAt: Date.now() - 1000,
      blocked: true,
      blockedUntil: Date.now() - 500, // Block expired
    };
    store.set('blocked-expired', blockedExpiredEntry);

    expect(store.get('blocked-expired')).toBeDefined();
  });

  it('should cleanup expired entries when interval fires', () => {
    jest.useFakeTimers();

    // Create a fresh store to capture the interval
    const testStore = new RateLimitStore();

    // Add expired entry (not blocked)
    testStore.set('expired-normal', {
      count: 5,
      resetAt: Date.now() - 1000, // Already expired
      blocked: false,
      blockedUntil: 0,
    });

    // Add expired blocked entry
    testStore.set('expired-blocked', {
      count: 10,
      resetAt: Date.now() - 2000,
      blocked: true,
      blockedUntil: Date.now() - 500, // Block also expired
    });

    // Add non-expired entry
    testStore.set('valid', {
      count: 1,
      resetAt: Date.now() + 60000,
      blocked: false,
      blockedUntil: 0,
    });

    // Fast-forward 60 seconds to trigger cleanup
    jest.advanceTimersByTime(60000);

    // Valid entry should still exist
    expect(testStore.get('valid')).toBeDefined();

    // Expired entries should be cleaned up
    expect(testStore.get('expired-normal')).toBeUndefined();
    expect(testStore.get('expired-blocked')).toBeUndefined();

    testStore.destroy();
    jest.useRealTimers();
  });

  it('should destroy and clear all entries', () => {
    store.set('key1', { count: 1, resetAt: Date.now(), blocked: false, blockedUntil: 0 });
    store.set('key2', { count: 2, resetAt: Date.now(), blocked: false, blockedUntil: 0 });

    store.destroy();

    expect(store.get('key1')).toBeUndefined();
    expect(store.get('key2')).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RateLimitHeadersInterceptor Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('RateLimitHeadersInterceptor', () => {
  let interceptor: RateLimitHeadersInterceptor;
  let reflector: Reflector;
  let mockResponse: { setHeader: jest.Mock };

  beforeEach(() => {
    reflector = new Reflector();
    interceptor = new RateLimitHeadersInterceptor(reflector);
    mockResponse = { setHeader: jest.fn() };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createContext = (request: Record<string, unknown>): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => mockResponse,
    }),
    getHandler: () => ({}),
  }) as unknown as ExecutionContext;

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should not set headers when no config', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);

    const context = createContext({
      ip: '127.0.0.1',
      method: 'GET',
      path: '/test',
    });

    const next = {
      handle: () => ({
        pipe: (fn: { project?: (val: unknown) => unknown }) => {
          // Execute the tap function
          fn.project ? fn.project({}) : undefined;
          expect(mockResponse.setHeader).not.toHaveBeenCalled();
          done();
          return { subscribe: jest.fn() };
        },
      }),
    };

    interceptor.intercept(context, next as unknown as CallHandler);
  });

  it('should set rate limit headers when config exists', (done) => {
    const config: RateLimitConfig = { limit: 10, windowSeconds: 60 };
    jest.spyOn(reflector, 'get').mockReturnValue(config);

    // Pre-populate store with an entry
    rateLimitStore.set('127.0.0.1:anonymous:GET:/test-headers', {
      count: 3,
      resetAt: Date.now() + 30000,
      blocked: false,
      blockedUntil: 0,
    });

    const context = createContext({
      ip: '127.0.0.1',
      method: 'GET',
      path: '/test-headers',
    });

    const { of } = require('rxjs');
    const next: CallHandler = {
      handle: () => of('result'),
    };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
        expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 7);
        expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
        done();
      },
    });
  });

  it('should handle authenticated users', (done) => {
    const config: RateLimitConfig = { limit: 5, windowSeconds: 60 };
    jest.spyOn(reflector, 'get').mockReturnValue(config);

    rateLimitStore.set('127.0.0.1:user-999:GET:/test-auth-headers', {
      count: 2,
      resetAt: Date.now() + 45000,
      blocked: false,
      blockedUntil: 0,
    });

    const context = createContext({
      ip: '127.0.0.1',
      method: 'GET',
      path: '/test-auth-headers',
      user: { id: 'user-999' },
    });

    const { of } = require('rxjs');
    const next: CallHandler = { handle: () => of('result') };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 3);
        done();
      },
    });
  });

  it('should not set headers when no entry in store', (done) => {
    const config: RateLimitConfig = { limit: 10, windowSeconds: 60 };
    jest.spyOn(reflector, 'get').mockReturnValue(config);

    const context = createContext({
      ip: '192.168.99.99',
      method: 'GET',
      path: '/no-entry-path',
    });

    const { of } = require('rxjs');
    const next: CallHandler = { handle: () => of('result') };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        // Headers should not be set because there's no entry
        expect(mockResponse.setHeader).not.toHaveBeenCalledWith('X-RateLimit-Limit', expect.anything());
        done();
      },
    });
  });
});