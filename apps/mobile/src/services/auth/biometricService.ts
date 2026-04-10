/**
 * ============================================================================
 * SMART_RETAIL - Biometric Authentication Service
 * ============================================================================
 * Servicio para autenticación biométrica (Face ID / Touch ID).
 * 
 * FEATURES:
 * - Verificación de disponibilidad de biometría
 * - Autenticación local para desbloqueo rápido
 * - Fallback a PIN/contraseña
 * ============================================================================
 */

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface BiometricStatus {
  isAvailable: boolean;
  isEnrolled: boolean;
  biometryType: 'fingerprint' | 'facial' | 'iris' | 'none';
  isEnabled: boolean;
}

export interface AuthenticateOptions {
  promptMessage?: string;
  cancelLabel?: string;
  fallbackLabel?: string;
  disableDeviceFallback?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'smart_retail_biometric_enabled';

// ─────────────────────────────────────────────────────────────────────────────
// BIOMETRIC SERVICE
// ─────────────────────────────────────────────────────────────────────────────

class BiometricService {
  /**
   * Verifica el estado de la biometría en el dispositivo.
   */
  async getStatus(): Promise<BiometricStatus> {
    const isAvailable = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const supportedTypes =
      await LocalAuthentication.supportedAuthenticationTypesAsync();

    let biometryType: BiometricStatus['biometryType'] = 'none';

    if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      biometryType = 'facial';
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      biometryType = 'fingerprint';
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      biometryType = 'iris';
    }

    const isEnabled = await this.isEnabled();

    return {
      isAvailable,
      isEnrolled,
      biometryType,
      isEnabled,
    };
  }

  /**
   * Verifica si el usuario ha habilitado la biometría en la app.
   */
  async isEnabled(): Promise<boolean> {
    try {
      const value = await SecureStore.getItemAsync(STORAGE_KEY);
      return value === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Habilita o deshabilita la biometría en la app.
   */
  async setEnabled(enabled: boolean): Promise<void> {
    if (enabled) {
      await SecureStore.setItemAsync(STORAGE_KEY, 'true');
    } else {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
    }
  }

  /**
   * Realiza la autenticación biométrica.
   * 
   * @returns true si la autenticación fue exitosa, false en caso contrario
   */
  async authenticate(options: AuthenticateOptions = {}): Promise<boolean> {
    const status = await this.getStatus();

    if (!status.isAvailable || !status.isEnrolled) {
      return false;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: options.promptMessage ?? 'Autenticación requerida',
      cancelLabel: options.cancelLabel ?? 'Cancelar',
      fallbackLabel: options.fallbackLabel ?? 'Usar contraseña',
      disableDeviceFallback: options.disableDeviceFallback ?? false,
    });

    return result.success;
  }

  /**
   * Obtiene el nombre del tipo de biometría para mostrar al usuario.
   */
  getBiometryLabel(type: BiometricStatus['biometryType']): string {
    const labels: Record<BiometricStatus['biometryType'], string> = {
      fingerprint: 'Touch ID',
      facial: 'Face ID',
      iris: 'Iris',
      none: 'No disponible',
    };
    return labels[type];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export const biometricService = new BiometricService();
