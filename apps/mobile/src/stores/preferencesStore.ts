/**
 * ============================================================================
 * SMART_RETAIL Mobile - Preferences Store (Zustand)
 * ============================================================================
 * Estado global para preferencias del usuario con persistencia.
 * 
 * Por qué Zustand: Más simple que Redux, mejor DX que Context.
 * Por qué persist: Las preferencias deben sobrevivir a reinicios de la app.
 * 
 * Cumple con SRS §3 "Estrategia Offline Parcial":
 * - Permitir navegación de menús y configuración sin conexión
 * - Persistir preferencias localmente
 * ============================================================================
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface PreferencesState {
  // ─── UI Preferences ────────────────────────────────────────────────────────
  /** Habilitar feedback háptico en acciones */
  hapticEnabled: boolean;
  /** Habilitar sonidos de feedback */
  soundEnabled: boolean;
  /** Tema de la app */
  theme: 'light' | 'dark' | 'system';
  /** Tamaño de fuente */
  fontSize: 'small' | 'medium' | 'large';

  // ─── Security Preferences ──────────────────────────────────────────────────
  /** Habilitar autenticación biométrica */
  biometricEnabled: boolean;
  /** Timeout de inactividad (minutos, 0 = deshabilitado) */
  inactivityTimeoutMinutes: number;

  // ─── Scan Preferences ──────────────────────────────────────────────────────
  /** Habilitar vibración al escanear */
  vibrationOnScan: boolean;
  /** Habilitar sonido al escanear exitosamente */
  soundOnScanSuccess: boolean;
  /** Habilitar flash automático en luz baja */
  autoFlash: boolean;

  // ─── Actions ───────────────────────────────────────────────────────────────
  setHapticEnabled: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setFontSize: (size: 'small' | 'medium' | 'large') => void;
  setBiometricEnabled: (enabled: boolean) => void;
  setInactivityTimeout: (minutes: number) => void;
  setVibrationOnScan: (enabled: boolean) => void;
  setSoundOnScanSuccess: (enabled: boolean) => void;
  setAutoFlash: (enabled: boolean) => void;
  resetToDefaults: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT VALUES
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_PREFERENCES = {
  hapticEnabled: true,
  soundEnabled: true,
  theme: 'system' as const,
  fontSize: 'medium' as const,
  biometricEnabled: false,
  inactivityTimeoutMinutes: 5,
  vibrationOnScan: true,
  soundOnScanSuccess: true,
  autoFlash: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      // Initial state
      ...DEFAULT_PREFERENCES,

      // Actions
      setHapticEnabled: (enabled) => set({ hapticEnabled: enabled }),
      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setBiometricEnabled: (enabled) => set({ biometricEnabled: enabled }),
      setInactivityTimeout: (minutes) => set({ inactivityTimeoutMinutes: minutes }),
      setVibrationOnScan: (enabled) => set({ vibrationOnScan: enabled }),
      setSoundOnScanSuccess: (enabled) => set({ soundOnScanSuccess: enabled }),
      setAutoFlash: (enabled) => set({ autoFlash: enabled }),

      resetToDefaults: () => set(DEFAULT_PREFERENCES),
    }),
    {
      name: 'smart-retail-preferences',
      storage: createJSONStorage(() => AsyncStorage),
      // Solo persistir estas propiedades (no las funciones)
      partialize: (state) => ({
        hapticEnabled: state.hapticEnabled,
        soundEnabled: state.soundEnabled,
        theme: state.theme,
        fontSize: state.fontSize,
        biometricEnabled: state.biometricEnabled,
        inactivityTimeoutMinutes: state.inactivityTimeoutMinutes,
        vibrationOnScan: state.vibrationOnScan,
        soundOnScanSuccess: state.soundOnScanSuccess,
        autoFlash: state.autoFlash,
      }),
    },
  ),
);

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORS (Para optimizar re-renders)
// ─────────────────────────────────────────────────────────────────────────────

/** Selector para preferencias de escaneo */
export const useScanPreferences = () =>
  usePreferencesStore((state) => ({
    vibrationOnScan: state.vibrationOnScan,
    soundOnScanSuccess: state.soundOnScanSuccess,
    autoFlash: state.autoFlash,
  }));

/** Selector para preferencias de UI */
export const useUIPreferences = () =>
  usePreferencesStore((state) => ({
    hapticEnabled: state.hapticEnabled,
    soundEnabled: state.soundEnabled,
    theme: state.theme,
    fontSize: state.fontSize,
  }));

/** Selector para preferencias de seguridad */
export const useSecurityPreferences = () =>
  usePreferencesStore((state) => ({
    biometricEnabled: state.biometricEnabled,
    inactivityTimeoutMinutes: state.inactivityTimeoutMinutes,
  }));
