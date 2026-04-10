/**
 * Tests for CurrentUser Decorator
 */

import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';

import { CurrentUser } from '@infrastructure/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@infrastructure/auth/strategies/jwt.strategy';

// Helper to get decorator factory
function getParamDecoratorFactory(decorator: Function) {
  class TestController {
    public test(@decorator() value: unknown) {
      return value;
    }
  }

  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestController, 'test');
  return args[Object.keys(args)[0]].factory;
}

describe('CurrentUser Decorator', () => {
  let factory: Function;
  let mockExecutionContext: {
    switchToHttp: jest.Mock;
  };
  let mockRequest: { user?: AuthenticatedUser };

  beforeEach(() => {
    factory = getParamDecoratorFactory(CurrentUser);
    mockRequest = {};
    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    };
  });

  describe('when user exists in request', () => {
    const mockUser: AuthenticatedUser = {
      id: 'user-123',
      email: 'test@example.com',
      role: 'consumer',
      locationId: 'loc-456',
    };

    beforeEach(() => {
      mockRequest.user = mockUser;
    });

    it('should return the full user when no data parameter', () => {
      const result = factory(undefined, mockExecutionContext);

      expect(result).toEqual(mockUser);
    });

    it('should return id property when data is "id"', () => {
      const result = factory('id', mockExecutionContext);

      expect(result).toBe('user-123');
    });

    it('should return email property when data is "email"', () => {
      const result = factory('email', mockExecutionContext);

      expect(result).toBe('test@example.com');
    });

    it('should return role property when data is "role"', () => {
      const result = factory('role', mockExecutionContext);

      expect(result).toBe('consumer');
    });

    it('should return locationId property when data is "locationId"', () => {
      const result = factory('locationId', mockExecutionContext);

      expect(result).toBe('loc-456');
    });
  });

  describe('when user does not exist in request', () => {
    beforeEach(() => {
      mockRequest.user = undefined;
    });

    it('should return undefined when no user', () => {
      const result = factory(undefined, mockExecutionContext);

      expect(result).toBeUndefined();
    });

    it('should return undefined when requesting property but no user', () => {
      const result = factory('id', mockExecutionContext);

      expect(result).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle null user', () => {
      mockRequest.user = null as unknown as AuthenticatedUser;

      const result = factory(undefined, mockExecutionContext);

      expect(result).toBeUndefined();
    });

    it('should return undefined for non-existent property', () => {
      mockRequest.user = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'consumer',
        locationId: 'loc-456',
      };

      // Cast to access non-existent property
      const result = factory('nonExistent' as keyof AuthenticatedUser, mockExecutionContext);

      expect(result).toBeUndefined();
    });
  });
});
