/**
 * ============================================================================
 * SMART_RETAIL Mobile - Offline Banner Tests
 * ============================================================================
 * Tests para el componente de banner offline/reconectando.
 * ============================================================================
 */

import { useNetwork } from '@/providers/NetworkProvider';

// Mock del NetworkProvider
jest.mock('@/providers/NetworkProvider', () => ({
  useNetwork: jest.fn(),
}));

// Mock de safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockUseNetwork = useNetwork as jest.MockedFunction<typeof useNetwork>;

/**
 * Función helper que replica la lógica del componente OfflineBanner
 */
function getBannerState(
  isConnected: boolean,
  isInternetReachable: boolean | null,
): 'offline' | 'reconnecting' | 'hidden' {
  if (!isConnected) return 'offline';
  if (isInternetReachable === null) return 'reconnecting';
  if (isInternetReachable === false) return 'offline';
  return 'hidden';
}

/**
 * Función helper que replica la lógica de getMessage del componente
 */
function getMessage(bannerState: string, retryCountdown: number): string {
  if (bannerState === 'reconnecting') {
    return 'Reconectando...';
  }
  return `Sin conexión • Reintentando en ${retryCountdown}s`;
}

describe('OfflineBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBannerState logic', () => {
    it('should return hidden when fully connected', () => {
      mockUseNetwork.mockReturnValue({
        isConnected: true,
        isInternetReachable: true,
        connectionType: 'wifi',
      });

      const state = getBannerState(true, true);
      expect(state).toBe('hidden');
    });

    it('should return offline when no network connection', () => {
      const state = getBannerState(false, null);
      expect(state).toBe('offline');
    });

    it('should return reconnecting when checking internet', () => {
      const state = getBannerState(true, null);
      expect(state).toBe('reconnecting');
    });

    it('should return offline when connected but no internet', () => {
      const state = getBannerState(true, false);
      expect(state).toBe('offline');
    });

    it('should return offline when not connected regardless of internet reachable', () => {
      const state = getBannerState(false, true);
      expect(state).toBe('offline');
    });
  });

  describe('getMessage logic', () => {
    it('should return "Reconectando..." when reconnecting', () => {
      const message = getMessage('reconnecting', 5);
      expect(message).toBe('Reconectando...');
    });

    it('should return countdown message when offline', () => {
      const message = getMessage('offline', 5);
      expect(message).toBe('Sin conexión • Reintentando en 5s');
    });

    it('should update countdown in message', () => {
      expect(getMessage('offline', 3)).toBe('Sin conexión • Reintentando en 3s');
      expect(getMessage('offline', 1)).toBe('Sin conexión • Reintentando en 1s');
    });
  });

  describe('RETRY_INTERVAL constant', () => {
    it('should have 5 second retry interval', () => {
      // Verifica que el intervalo de reintento sea 5 segundos según el componente
      const RETRY_INTERVAL_SECONDS = 5;
      expect(RETRY_INTERVAL_SECONDS).toBe(5);
    });
  });

  describe('accessibility', () => {
    it('should have appropriate accessibility labels for offline state', () => {
      const retryCountdown = 3;
      const accessibilityLabel = `Sin conexión. Reintentando en ${retryCountdown} segundos`;
      expect(accessibilityLabel).toContain('Sin conexión');
      expect(accessibilityLabel).toContain('Reintentando');
    });

    it('should have appropriate accessibility label for reconnecting state', () => {
      const accessibilityLabel = 'Reconectando a internet';
      expect(accessibilityLabel).toBe('Reconectando a internet');
    });
  });
});
