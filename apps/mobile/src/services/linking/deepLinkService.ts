/**
 * ============================================================================
 * SMART_RETAIL - Deep Link Handler
 * ============================================================================
 * Manejo de deep links para callbacks de pasarelas de pago (MODO).
 * 
 * IMPLEMENTA: DA-06 (Multi-Pasarela) y callbacks de MODO
 * 
 * SCHEMA: smartRetail://
 * 
 * ROUTES:
 * - smartRetail://payment/success?transactionId=xxx
 * - smartRetail://payment/failure?transactionId=xxx&error=xxx
 * - smartRetail://payment/pending?transactionId=xxx
 * ============================================================================
 */

import * as Linking from 'expo-linking';
import { router } from 'expo-router';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface PaymentCallback {
  status: 'success' | 'failure' | 'pending';
  transactionId: string;
  error?: string;
  externalId?: string;
}

type DeepLinkHandler = (params: Record<string, string>) => void;

// ─────────────────────────────────────────────────────────────────────────────
// DEEP LINK SERVICE
// ─────────────────────────────────────────────────────────────────────────────

class DeepLinkService {
  private handlers: Map<string, DeepLinkHandler> = new Map();
  private isListening = false;

  /**
   * Inicia el listener de deep links.
   * Debe llamarse al iniciar la app.
   */
  startListening(): void {
    if (this.isListening) return;

    // Handler para links mientras la app está abierta
    Linking.addEventListener('url', this.handleUrl.bind(this));

    // Verificar si la app fue abierta con un link
    this.checkInitialUrl();

    this.isListening = true;
  }

  /**
   * Detiene el listener de deep links.
   */
  stopListening(): void {
    // Expo Linking no tiene removeEventListener en versiones recientes
    // El listener se limpia automáticamente con el ciclo de vida
    this.isListening = false;
  }

  /**
   * Registra un handler para una ruta específica.
   * 
   * @param path - Ruta del deep link (ej: 'payment/success')
   * @param handler - Función a ejecutar cuando se recibe el link
   */
  registerHandler(path: string, handler: DeepLinkHandler): void {
    this.handlers.set(path, handler);
  }

  /**
   * Remueve un handler registrado.
   */
  removeHandler(path: string): void {
    this.handlers.delete(path);
  }

  /**
   * Verifica si la app fue abierta con un deep link inicial.
   */
  private async checkInitialUrl(): Promise<void> {
    try {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        this.processUrl(initialUrl);
      }
    } catch {
      // Silently ignore - initial URL check is non-critical
    }
  }

  /**
   * Handler del evento de URL.
   */
  private handleUrl(event: { url: string }): void {
    this.processUrl(event.url);
  }

  /**
   * Procesa una URL de deep link.
   */
  private processUrl(url: string): void {
    try {
      const parsed = Linking.parse(url);

      if (!parsed.path) return;

      // Buscar handler registrado
      const handler = this.handlers.get(parsed.path);
      if (handler) {
        handler(parsed.queryParams as Record<string, string>);
        return;
      }

      // Handlers por defecto para rutas de pago
      if (parsed.path.startsWith('payment/')) {
        this.handlePaymentCallback(parsed.path, parsed.queryParams as Record<string, string>);
      }
    } catch {
      // Silently ignore malformed deep links
    }
  }

  /**
   * Maneja callbacks de pagos (MODO, etc.)
   */
  private handlePaymentCallback(
    path: string,
    params: Record<string, string>,
  ): void {
    const status = path.split('/')[1] as PaymentCallback['status'];

    const callback: PaymentCallback = {
      status,
      transactionId: params.transactionId ?? '',
      error: params.error,
      externalId: params.externalId,
    };

    // Navegar a pantalla de resultado
    switch (status) {
      case 'success':
        router.push({
          pathname: '/(app)/payment-result',
          params: {
            status: 'success',
            transactionId: callback.transactionId,
          },
        });
        break;

      case 'failure':
        router.push({
          pathname: '/(app)/payment-result',
          params: {
            status: 'failure',
            transactionId: callback.transactionId,
            error: callback.error ?? 'Pago rechazado',
          },
        });
        break;

      case 'pending':
        router.push({
          pathname: '/(app)/payment-result',
          params: {
            status: 'pending',
            transactionId: callback.transactionId,
          },
        });
        break;
    }
  }

  /**
   * Genera una URL de deep link.
   */
  createUrl(path: string, params?: Record<string, string>): string {
    return Linking.createURL(path, { queryParams: params });
  }

  /**
   * Abre una URL externa (para iniciar flujo de pago).
   */
  async openUrl(url: string): Promise<boolean> {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    }
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export const deepLinkService = new DeepLinkService();
export type { PaymentCallback };
