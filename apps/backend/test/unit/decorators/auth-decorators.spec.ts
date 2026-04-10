/**
 * ============================================================================
 * SMART_RETAIL - Auth Decorators Tests
 * ============================================================================
 * Tests unitarios para los decoradores de autenticación.
 * ============================================================================
 */


// Import decorators
import { IS_PUBLIC_KEY, Public } from '../../../src/infrastructure/auth/decorators/public.decorator';
import { ROLES_KEY, Roles } from '../../../src/infrastructure/auth/decorators/roles.decorator';

describe('Auth Decorators', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // @Public() DECORATOR
  // ─────────────────────────────────────────────────────────────────────────

  describe('@Public()', () => {
    it('should export IS_PUBLIC_KEY constant', () => {
      expect(IS_PUBLIC_KEY).toBe('isPublic');
    });

    it('should set isPublic metadata to true', () => {
      @Public()
      class TestController {}

      const metadata = Reflect.getMetadata(IS_PUBLIC_KEY, TestController);
      expect(metadata).toBe(true);
    });

    it('should work on methods', () => {
      class TestController {
        @Public()
        publicEndpoint() {}
      }

      const metadata = Reflect.getMetadata(
        IS_PUBLIC_KEY,
        TestController.prototype.publicEndpoint,
      );
      expect(metadata).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // @Roles() DECORATOR
  // ─────────────────────────────────────────────────────────────────────────

  describe('@Roles()', () => {
    it('should export ROLES_KEY constant', () => {
      expect(ROLES_KEY).toBe('roles');
    });

    it('should set roles metadata with single role', () => {
      @Roles('admin')
      class TestController {}

      const metadata = Reflect.getMetadata(ROLES_KEY, TestController);
      expect(metadata).toEqual(['admin']);
    });

    it('should set roles metadata with multiple roles', () => {
      @Roles('admin', 'operator', 'supervisor')
      class TestController {}

      const metadata = Reflect.getMetadata(ROLES_KEY, TestController);
      expect(metadata).toEqual(['admin', 'operator', 'supervisor']);
    });

    it('should work on methods', () => {
      class TestController {
        @Roles('admin')
        adminEndpoint() {}
      }

      const metadata = Reflect.getMetadata(
        ROLES_KEY,
        TestController.prototype.adminEndpoint,
      );
      expect(metadata).toEqual(['admin']);
    });

    it('should handle empty roles array', () => {
      @Roles()
      class TestController {}

      const metadata = Reflect.getMetadata(ROLES_KEY, TestController);
      expect(metadata).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // @CurrentUser() DECORATOR
  // ─────────────────────────────────────────────────────────────────────────

  describe('@CurrentUser()', () => {
    // Note: Testing param decorators requires more complex setup
    // We test the factory function behavior instead

    it('should be importable', async () => {
      const { CurrentUser } = await import(
        '../../../src/infrastructure/auth/decorators/current-user.decorator'
      );
      expect(CurrentUser).toBeDefined();
    });

    // The actual extraction logic is tested via integration tests
    // or by mocking the execution context
  });
});

// ─────────────────────────────────────────────────────────────────────────
// INTEGRATION BEHAVIOR TESTS
// ─────────────────────────────────────────────────────────────────────────

describe('Decorator Integration', () => {
  it('should allow combining @Public and @Roles', () => {
    // This is technically valid but logically doesn't make sense
    // The test ensures no runtime errors
    @Public()
    @Roles('admin')
    class TestController {}

    const publicMeta = Reflect.getMetadata(IS_PUBLIC_KEY, TestController);
    const rolesMeta = Reflect.getMetadata(ROLES_KEY, TestController);

    expect(publicMeta).toBe(true);
    expect(rolesMeta).toEqual(['admin']);
  });

  it('should allow decorators on different methods', () => {
    class TestController {
      @Public()
      publicMethod() {}

      @Roles('admin')
      adminMethod() {}

      @Roles('consumer')
      consumerMethod() {}
    }

    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, TestController.prototype.publicMethod),
    ).toBe(true);
    expect(
      Reflect.getMetadata(ROLES_KEY, TestController.prototype.adminMethod),
    ).toEqual(['admin']);
    expect(
      Reflect.getMetadata(ROLES_KEY, TestController.prototype.consumerMethod),
    ).toEqual(['consumer']);
  });
});
