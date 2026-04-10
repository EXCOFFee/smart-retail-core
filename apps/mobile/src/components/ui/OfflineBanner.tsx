/**
 * ============================================================================
 * SMART_RETAIL - Offline Banner
 * ============================================================================
 * Banner persistente que indica estado offline o reconectando.
 * 
 * ESTADOS:
 * - Offline: Rojo con mensaje "Sin conexión a internet"
 * - Reconnecting: Amarillo con mensaje "Reconectando..." + countdown
 * 
 * SRS: "Debe mostrar 'Reconectando...' elegante" (Sección 3)
 * ============================================================================
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNetwork } from '@/providers/NetworkProvider';
import { spacing, typography } from '@/theme';

type BannerState = 'offline' | 'reconnecting' | 'hidden';

/** Intervalo de reintento en segundos */
const RETRY_INTERVAL_SECONDS = 5;

export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const { isConnected, isInternetReachable } = useNetwork();
  
  // Countdown para reintento automático
  const [retryCountdown, setRetryCountdown] = useState(RETRY_INTERVAL_SECONDS);
  
  // Animación para el indicador de "reconectando"
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Determinar estado del banner
  const getBannerState = (): BannerState => {
    // Sin conexión de red
    if (!isConnected) return 'offline';
    // Conectado pero verificando internet (null = checking)
    if (isInternetReachable === null) return 'reconnecting';
    // Conectado pero sin acceso a internet
    if (isInternetReachable === false) return 'offline';
    // Totalmente conectado
    return 'hidden';
  };

  const bannerState = getBannerState();

  // Countdown timer para estado offline
  useEffect(() => {
    if (bannerState === 'offline') {
      setRetryCountdown(RETRY_INTERVAL_SECONDS);
      
      const interval = setInterval(() => {
        setRetryCountdown((prev) => {
          if (prev <= 1) {
            // Reiniciar countdown
            return RETRY_INTERVAL_SECONDS;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [bannerState]);

  // Animación de pulso para estado "reconectando"
  useEffect(() => {
    if (bannerState === 'reconnecting') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.6,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [bannerState, pulseAnim]);

  // No mostrar si está conectado
  if (bannerState === 'hidden') return null;

  const isReconnecting = bannerState === 'reconnecting';

  // Mensaje según estado
  const getMessage = (): string => {
    if (isReconnecting) {
      return 'Reconectando...';
    }
    return `Sin conexión • Reintentando en ${retryCountdown}s`;
  };

  return (
    <View 
      style={[
        styles.container, 
        { paddingTop: insets.top },
        isReconnecting && styles.reconnectingContainer,
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      accessibilityLabel={isReconnecting ? 'Reconectando a internet' : `Sin conexión. Reintentando en ${retryCountdown} segundos`}
    >
      <View style={styles.content}>
        <Animated.View style={{ opacity: isReconnecting ? pulseAnim : 1 }}>
          <Ionicons 
            name={isReconnecting ? 'sync' : 'cloud-offline'} 
            size={16} 
            color="#FFF" 
          />
        </Animated.View>
        <Text style={styles.text}>
          {getMessage()}
        </Text>
        {!isReconnecting && (
          <View style={styles.countdownBadge}>
            <Text style={styles.countdownText}>{retryCountdown}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E74C3C',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  reconnectingContainer: {
    backgroundColor: '#F39C12', // Amarillo/naranja para reconectando
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  text: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: typography.fontMedium,
    marginLeft: spacing.xs,
  },
  countdownBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: spacing.xs,
  },
  countdownText: {
    color: '#FFF',
    fontSize: 11,
    fontFamily: typography.fontBold,
  },
});
