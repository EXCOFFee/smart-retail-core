/**
 * ============================================================================
 * SMART_RETAIL - Offline Queue Service
 * ============================================================================
 * Cola de peticiones fallidas para sincronización posterior.
 * 
 * IMPLEMENTA: CU-07 (Anti-Fraude Offline) y Resiliencia HU-04
 * 
 * ESTRATEGIA:
 * - Almacena intentos fallidos de acceso (NO autoriza offline)
 * - Sincroniza automáticamente al reconectar
 * - Permite auditoría de intentos offline
 * 
 * ⚠️ IMPORTANTE: Esta cola NO autoriza accesos offline.
 * Solo registra intentos para sincronización de logs.
 * ============================================================================
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface QueuedRequest {
  id: string;
  type: 'access_attempt' | 'log_event';
  payload: unknown;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

interface OfflineQueueConfig {
  maxQueueSize: number;
  maxRetries: number;
  storageKey: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: OfflineQueueConfig = {
  maxQueueSize: 100,
  maxRetries: 3,
  storageKey: 'smart_retail_offline_queue',
};

// ─────────────────────────────────────────────────────────────────────────────
// OFFLINE QUEUE CLASS
// ─────────────────────────────────────────────────────────────────────────────

class OfflineQueue {
  private config: OfflineQueueConfig;
  private isProcessing = false;
  private syncCallback: ((item: QueuedRequest) => Promise<boolean>) | null =
    null;

  constructor(config: Partial<OfflineQueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupNetworkListener();
  }

  /**
   * Configura listener para detectar reconexión y sincronizar.
   */
  private setupNetworkListener(): void {
    NetInfo.addEventListener((state: NetInfoState) => {
      if (state.isConnected && state.isInternetReachable) {
        this.processQueue();
      }
    });
  }

  /**
   * Registra el callback que se ejecutará para sincronizar cada item.
   */
  setSyncCallback(callback: (item: QueuedRequest) => Promise<boolean>): void {
    this.syncCallback = callback;
  }

  /**
   * Agrega un item a la cola offline.
   * 
   * @param type - Tipo de request ('access_attempt' o 'log_event')
   * @param payload - Datos a sincronizar
   */
  async enqueue(
    type: QueuedRequest['type'],
    payload: unknown,
  ): Promise<string> {
    const queue = await this.getQueue();

    // Limitar tamaño de cola
    if (queue.length >= this.config.maxQueueSize) {
      // Remover items más antiguos
      queue.shift();
    }

    const item: QueuedRequest = {
      id: this.generateId(),
      type,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: this.config.maxRetries,
    };

    queue.push(item);
    await this.saveQueue(queue);

    return item.id;
  }

  /**
   * Procesa la cola cuando hay conexión.
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing || !this.syncCallback) return;

    const netState = await NetInfo.fetch();
    if (!netState.isConnected) return;

    this.isProcessing = true;

    try {
      const queue = await this.getQueue();
      const remainingItems: QueuedRequest[] = [];

      for (const item of queue) {
        try {
          const success = await this.syncCallback(item);

          if (!success) {
            item.retryCount++;
            if (item.retryCount < item.maxRetries) {
              remainingItems.push(item);
            }
            // Si excede maxRetries, se descarta
          }
          // Si success, el item se procesa y no se re-encola
        } catch (error) {
          item.retryCount++;
          if (item.retryCount < item.maxRetries) {
            remainingItems.push(item);
          }
        }
      }

      await this.saveQueue(remainingItems);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Obtiene el número de items pendientes.
   */
  async getPendingCount(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  }

  /**
   * Limpia toda la cola.
   */
  async clear(): Promise<void> {
    await AsyncStorage.removeItem(this.config.storageKey);
  }

  /**
   * Obtiene la cola desde AsyncStorage.
   */
  private async getQueue(): Promise<QueuedRequest[]> {
    try {
      const data = await AsyncStorage.getItem(this.config.storageKey);
      return data ? (JSON.parse(data) as QueuedRequest[]) : [];
    } catch {
      return [];
    }
  }

  /**
   * Guarda la cola en AsyncStorage.
   */
  private async saveQueue(queue: QueuedRequest[]): Promise<void> {
    await AsyncStorage.setItem(this.config.storageKey, JSON.stringify(queue));
  }

  /**
   * Genera un ID único para cada item.
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export const offlineQueue = new OfflineQueue();
export type { OfflineQueueConfig, QueuedRequest };

