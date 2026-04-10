/**
 * ============================================================================
 * SMART_RETAIL - Services Index
 * ============================================================================
 * Barrel export de todos los servicios de la aplicación.
 * ============================================================================
 */

// API
export { apiClient } from './api/client';

// Auth
export { biometricService } from './auth/biometricService';

// Audio
export { audioFeedback } from './audio/audioFeedback';

// Offline
export { offlineQueue } from './offline/offlineQueue';
export type { OfflineQueueConfig, QueuedRequest } from './offline/offlineQueue';

// Deep Links
export { deepLinkService } from './linking/deepLinkService';
export type { PaymentCallback } from './linking/deepLinkService';

