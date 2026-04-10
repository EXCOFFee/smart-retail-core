/**
 * ============================================================================
 * SMART_RETAIL Mobile - Preferences Store Tests
 * ============================================================================
 * Tests unitarios para el store de preferencias Zustand.
 * 
 * Patrón: AAA (Arrange, Act, Assert) según 04_qa_test_architect.md
 * Cobertura: Happy Path + Edge Cases + Reset
 * ============================================================================
 */

import { usePreferencesStore } from '@/stores/preferencesStore';

// Mock de AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

describe('usePreferencesStore', () => {
  // Reset store state before each test
  beforeEach(() => {
    usePreferencesStore.setState({
      hapticEnabled: true,
      soundEnabled: true,
      theme: 'system',
      fontSize: 'medium',
      biometricEnabled: false,
      inactivityTimeoutMinutes: 5,
      vibrationOnScan: true,
      soundOnScanSuccess: true,
      autoFlash: false,
    });
  });

  describe('Initial State', () => {
    it('should have correct default values', () => {
      // Arrange & Act
      const state = usePreferencesStore.getState();

      // Assert
      expect(state.hapticEnabled).toBe(true);
      expect(state.soundEnabled).toBe(true);
      expect(state.theme).toBe('system');
      expect(state.fontSize).toBe('medium');
      expect(state.biometricEnabled).toBe(false);
      expect(state.inactivityTimeoutMinutes).toBe(5);
      expect(state.vibrationOnScan).toBe(true);
      expect(state.soundOnScanSuccess).toBe(true);
      expect(state.autoFlash).toBe(false);
    });
  });

  describe('UI Preferences', () => {
    it('should toggle haptic feedback', () => {
      // Arrange
      const store = usePreferencesStore.getState();

      // Act
      store.setHapticEnabled(false);

      // Assert
      expect(usePreferencesStore.getState().hapticEnabled).toBe(false);
    });

    it('should toggle sound feedback', () => {
      // Arrange
      const store = usePreferencesStore.getState();

      // Act
      store.setSoundEnabled(false);

      // Assert
      expect(usePreferencesStore.getState().soundEnabled).toBe(false);
    });

    it('should change theme', () => {
      // Arrange
      const store = usePreferencesStore.getState();

      // Act
      store.setTheme('dark');

      // Assert
      expect(usePreferencesStore.getState().theme).toBe('dark');
    });

    it('should change font size', () => {
      // Arrange
      const store = usePreferencesStore.getState();

      // Act
      store.setFontSize('large');

      // Assert
      expect(usePreferencesStore.getState().fontSize).toBe('large');
    });
  });

  describe('Security Preferences', () => {
    it('should toggle biometric authentication', () => {
      // Arrange
      const store = usePreferencesStore.getState();

      // Act
      store.setBiometricEnabled(true);

      // Assert
      expect(usePreferencesStore.getState().biometricEnabled).toBe(true);
    });

    it('should set inactivity timeout', () => {
      // Arrange
      const store = usePreferencesStore.getState();

      // Act
      store.setInactivityTimeout(10);

      // Assert
      expect(usePreferencesStore.getState().inactivityTimeoutMinutes).toBe(10);
    });

    it('should allow disabling inactivity timeout with 0', () => {
      // Arrange
      const store = usePreferencesStore.getState();

      // Act
      store.setInactivityTimeout(0);

      // Assert
      expect(usePreferencesStore.getState().inactivityTimeoutMinutes).toBe(0);
    });
  });

  describe('Scan Preferences', () => {
    it('should toggle vibration on scan', () => {
      // Arrange
      const store = usePreferencesStore.getState();

      // Act
      store.setVibrationOnScan(false);

      // Assert
      expect(usePreferencesStore.getState().vibrationOnScan).toBe(false);
    });

    it('should toggle sound on scan success', () => {
      // Arrange
      const store = usePreferencesStore.getState();

      // Act
      store.setSoundOnScanSuccess(false);

      // Assert
      expect(usePreferencesStore.getState().soundOnScanSuccess).toBe(false);
    });

    it('should toggle auto flash', () => {
      // Arrange
      const store = usePreferencesStore.getState();

      // Act
      store.setAutoFlash(true);

      // Assert
      expect(usePreferencesStore.getState().autoFlash).toBe(true);
    });
  });

  describe('Reset', () => {
    it('should reset all preferences to defaults', () => {
      // Arrange - modify all preferences
      const store = usePreferencesStore.getState();
      store.setHapticEnabled(false);
      store.setSoundEnabled(false);
      store.setTheme('dark');
      store.setFontSize('large');
      store.setBiometricEnabled(true);
      store.setInactivityTimeout(15);
      store.setVibrationOnScan(false);
      store.setSoundOnScanSuccess(false);
      store.setAutoFlash(true);

      // Verify they changed
      expect(usePreferencesStore.getState().hapticEnabled).toBe(false);
      expect(usePreferencesStore.getState().theme).toBe('dark');

      // Act
      usePreferencesStore.getState().resetToDefaults();

      // Assert
      const state = usePreferencesStore.getState();
      expect(state.hapticEnabled).toBe(true);
      expect(state.soundEnabled).toBe(true);
      expect(state.theme).toBe('system');
      expect(state.fontSize).toBe('medium');
      expect(state.biometricEnabled).toBe(false);
      expect(state.inactivityTimeoutMinutes).toBe(5);
      expect(state.vibrationOnScan).toBe(true);
      expect(state.soundOnScanSuccess).toBe(true);
      expect(state.autoFlash).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple rapid state changes', () => {
      // Arrange
      const store = usePreferencesStore.getState();

      // Act - rapid changes
      store.setTheme('light');
      store.setTheme('dark');
      store.setTheme('system');
      store.setTheme('dark');

      // Assert - should have the last value
      expect(usePreferencesStore.getState().theme).toBe('dark');
    });

    it('should preserve other state when changing one preference', () => {
      // Arrange
      const store = usePreferencesStore.getState();
      store.setBiometricEnabled(true);
      store.setTheme('dark');

      // Act - change only one preference
      store.setFontSize('small');

      // Assert - other preferences should be preserved
      const state = usePreferencesStore.getState();
      expect(state.biometricEnabled).toBe(true);
      expect(state.theme).toBe('dark');
      expect(state.fontSize).toBe('small');
    });
  });
});
