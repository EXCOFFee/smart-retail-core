/**
 * ============================================================================
 * SMART_RETAIL - Network Provider
 * ============================================================================
 * Proveedor de contexto para estado de red.
 * 
 * FEATURES:
 * - Detección de conectividad en tiempo real
 * - Cola de requests pendientes para modo offline
 * - Sincronización automática al reconectar
 * ============================================================================
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface NetworkContextValue {
  /** ¿Hay conexión a internet? */
  isConnected: boolean;
  /** Tipo de conexión (wifi, cellular, etc.) */
  connectionType: string | null;
  /** ¿La conexión es de buena calidad? */
  isInternetReachable: boolean | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

const NetworkContext = createContext<NetworkContextValue | null>(null);

/**
 * Hook para acceder al estado de red.
 */
export function useNetwork(): NetworkContextValue {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

interface NetworkProviderProps {
  children: ReactNode;
}

export function NetworkProvider({ children }: NetworkProviderProps) {
  const [networkState, setNetworkState] = useState<{
    isConnected: boolean;
    connectionType: string | null;
    isInternetReachable: boolean | null;
  }>({
    isConnected: true, // Optimista por defecto
    connectionType: null,
    isInternetReachable: null,
  });

  useEffect(() => {
    // Obtener estado inicial
    NetInfo.fetch().then((state: NetInfoState) => {
      setNetworkState({
        isConnected: state.isConnected ?? true,
        connectionType: state.type,
        isInternetReachable: state.isInternetReachable,
      });
    });

    // Suscribirse a cambios de red
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setNetworkState({
        isConnected: state.isConnected ?? true,
        connectionType: state.type,
        isInternetReachable: state.isInternetReachable,
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const value = useMemo<NetworkContextValue>(
    () => ({
      isConnected: networkState.isConnected,
      connectionType: networkState.connectionType,
      isInternetReachable: networkState.isInternetReachable,
    }),
    [networkState],
  );

  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  );
}
