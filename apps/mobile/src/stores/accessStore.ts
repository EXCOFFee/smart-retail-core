/**
 * ============================================================================
 * SMART_RETAIL - Access Store (Zustand)
 * ============================================================================
 * Store para gestión de accesos QR.
 * 
 * RESPONSABILIDADES:
 * - Procesar escaneos de QR
 * - Manejar estado de procesamiento
 * - Cachear último resultado
 * ============================================================================
 */

import { create } from 'zustand';

import { apiClient } from '@/services/api/client';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface AccessResult {
  success: boolean;
  transactionId?: string;
  message: string;
  errorCode?: string;
  latencyMs?: number;
}

interface AccessState {
  /** ¿Está procesando un acceso? */
  isProcessing: boolean;
  /** Último resultado de acceso */
  lastResult: AccessResult | null;
  /** Timestamp del último escaneo */
  lastScanTimestamp: number | null;
  /** Errores de procesamiento */
  error: string | null;
}

interface AccessActions {
  /**
   * Procesa un código QR de acceso.
   * 
   * @param qrPayload - Contenido del QR escaneado
   * @returns Resultado del procesamiento
   */
  processAccess: (qrPayload: string) => Promise<AccessResult>;

  /**
   * Limpia el último resultado.
   */
  clearResult: () => void;

  /**
   * Resetea el store al estado inicial.
   */
  reset: () => void;
}

type AccessStore = AccessState & AccessActions;

// ─────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────

const initialState: AccessState = {
  isProcessing: false,
  lastResult: null,
  lastScanTimestamp: null,
  error: null,
};

export const useAccessStore = create<AccessStore>((set, _get) => ({
  ...initialState,

  processAccess: async (qrPayload: string): Promise<AccessResult> => {
    const startTime = Date.now();

    set({
      isProcessing: true,
      error: null,
      lastScanTimestamp: startTime,
    });

    try {
      // Llamar al endpoint de procesamiento de acceso
      const response = await apiClient.post<{
        success: boolean;
        transactionId?: string;
        message: string;
        errorCode?: string;
      }>('/access/process', {
        qrPayload,
        timestamp: startTime,
        // deviceId se extrae del JWT en el backend
      });

      const latencyMs = Date.now() - startTime;

      const result: AccessResult = {
        success: response.data.success,
        transactionId: response.data.transactionId,
        message: response.data.message,
        errorCode: response.data.errorCode,
        latencyMs,
      };

      set({
        isProcessing: false,
        lastResult: result,
      });

      return result;
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      let message = 'Error al procesar el acceso';
      let errorCode = 'UNKNOWN_ERROR';

      if (error instanceof Error) {
        message = error.message;
      }

      // Extraer código de error del response si existe
      if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error
      ) {
        const responseError = error as {
          response?: { data?: { message?: string; errorCode?: string } };
        };
        message = responseError.response?.data?.message ?? message;
        errorCode = responseError.response?.data?.errorCode ?? errorCode;
      }

      const result: AccessResult = {
        success: false,
        message,
        errorCode,
        latencyMs,
      };

      set({
        isProcessing: false,
        lastResult: result,
        error: message,
      });

      return result;
    }
  },

  clearResult: () => {
    set({ lastResult: null, error: null });
  },

  reset: () => {
    set(initialState);
  },
}));
