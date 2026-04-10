/**
 * ============================================================================
 * SMART_RETAIL Admin Web - Auth Store Tests
 * ============================================================================
 * Tests unitarios para el store de autenticación Zustand.
 * 
 * Patrón: AAA (Arrange, Act, Assert) según 04_qa_test_architect.md
 * Cobertura: Happy Path + Edge Cases
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from './authStore';

describe('useAuthStore', () => {
  // Reset store state before each test to ensure independence
  beforeEach(() => {
    useAuthStore.setState({ token: null, user: null });
  });

  describe('initial state', () => {
    it('should have null token and user initially', () => {
      // Arrange & Act
      const state = useAuthStore.getState();

      // Assert
      expect(state.token).toBeNull();
      expect(state.user).toBeNull();
    });
  });

  describe('login', () => {
    it('should set token and user on login (Happy Path)', () => {
      // Arrange
      const mockToken = 'jwt.token.here';
      const mockUser = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'admin@smartretail.com',
        name: 'Admin User',
      };

      // Act
      useAuthStore.getState().login(mockToken, mockUser);

      // Assert
      const state = useAuthStore.getState();
      expect(state.token).toBe(mockToken);
      expect(state.user).toEqual(mockUser);
    });

    it('should overwrite previous token and user on re-login', () => {
      // Arrange
      const oldUser = { id: '1', email: 'old@test.com', name: 'Old' };
      const newUser = { id: '2', email: 'new@test.com', name: 'New' };
      useAuthStore.getState().login('old-token', oldUser);

      // Act
      useAuthStore.getState().login('new-token', newUser);

      // Assert
      const state = useAuthStore.getState();
      expect(state.token).toBe('new-token');
      expect(state.user).toEqual(newUser);
    });
  });

  describe('logout', () => {
    it('should clear token and user on logout (Happy Path)', () => {
      // Arrange
      const mockUser = { id: '1', email: 'test@test.com', name: 'Test' };
      useAuthStore.getState().login('token', mockUser);

      // Act
      useAuthStore.getState().logout();

      // Assert
      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.user).toBeNull();
    });

    it('should be idempotent - calling logout when already logged out', () => {
      // Arrange - already logged out (initial state)

      // Act
      useAuthStore.getState().logout();

      // Assert - should not throw, state remains null
      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.user).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle user with minimal data', () => {
      // Arrange
      const minimalUser = { id: '', email: '', name: '' };

      // Act
      useAuthStore.getState().login('token', minimalUser);

      // Assert
      expect(useAuthStore.getState().user).toEqual(minimalUser);
    });

    it('should handle empty string token', () => {
      // Arrange
      const user = { id: '1', email: 'test@test.com', name: 'Test' };

      // Act
      useAuthStore.getState().login('', user);

      // Assert
      expect(useAuthStore.getState().token).toBe('');
    });

    it('should preserve state structure after multiple operations', () => {
      // Arrange
      const user = { id: '1', email: 'test@test.com', name: 'Test' };

      // Act - multiple operations
      useAuthStore.getState().login('token1', user);
      useAuthStore.getState().logout();
      useAuthStore.getState().login('token2', { ...user, name: 'Updated' });

      // Assert
      const state = useAuthStore.getState();
      expect(state.token).toBe('token2');
      expect(state.user?.name).toBe('Updated');
    });
  });

  describe('Selectors', () => {
    it('should allow selecting specific fields', () => {
      // Arrange
      const user = { id: '1', email: 'test@test.com', name: 'Test User' };
      useAuthStore.getState().login('my-token', user);

      // Act - using getState as selector
      const token = useAuthStore.getState().token;
      const userEmail = useAuthStore.getState().user?.email;

      // Assert
      expect(token).toBe('my-token');
      expect(userEmail).toBe('test@test.com');
    });
  });
});
