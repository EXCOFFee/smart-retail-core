/**
 * ============================================================================
 * SMART_RETAIL - QR Scanner Screen
 * ============================================================================
 * Pantalla de escaneo de códigos QR - CRITICAL PATH.
 * 
 * IMPLEMENTA: CU-01, CU-02, CU-03
 * 
 * FEATURES:
 * - react-native-vision-camera v4+ para escaneo rápido
 * - Detección automática de códigos QR
 * - Feedback háptico al escanear
 * - UI resiliente a errores
 * - Overlay con guía visual
 * ============================================================================
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Camera,
    Code,
    useCameraDevice,
    useCameraPermission,
    useCodeScanner,
} from 'react-native-vision-camera';

import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { useNetwork } from '@/providers/NetworkProvider';
import { useAccessStore } from '@/stores/accessStore';
import { colors, spacing, typography } from '@/theme';

/**
 * Estados posibles del escáner
 */
type ScannerState = 'scanning' | 'processing' | 'success' | 'error';

export default function ScanScreen() {
  const { isConnected } = useNetwork();
  const { processAccess, isProcessing } = useAccessStore();

  // Estado del escáner
  const [scannerState, setScannerState] = useState<ScannerState>('scanning');
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cooldown para evitar escaneos múltiples
  const cooldownRef = useRef(false);
  const COOLDOWN_MS = 2000;

  // Permisos de cámara
  const { hasPermission, requestPermission } = useCameraPermission();

  // Dispositivo de cámara (trasera)
  const device = useCameraDevice('back');

  // Solicitar permisos al montar
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  /**
   * Callback cuando se detecta un código QR.
   */
  const onCodeScanned = useCallback(
    async (codes: Code[]) => {
      // Ignorar si estamos en cooldown o procesando
      if (cooldownRef.current || scannerState !== 'scanning') return;

      const qrCode = codes.find((code) => code.type === 'qr' && code.value);
      if (!qrCode?.value) return;

      // Evitar escanear el mismo código múltiples veces
      if (qrCode.value === lastScannedCode) return;

      // Activar cooldown
      cooldownRef.current = true;
      setTimeout(() => {
        cooldownRef.current = false;
      }, COOLDOWN_MS);

      setLastScannedCode(qrCode.value);
      setScannerState('processing');

      // Feedback háptico
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Verificar conexión
      if (!isConnected) {
        setScannerState('error');
        setErrorMessage('Sin conexión. Por favor verifica tu internet.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      try {
        // Procesar acceso en el backend
        const result = await processAccess(qrCode.value);

        if (result.success) {
          setScannerState('success');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

          // Mostrar resultado y volver a escanear
          setTimeout(() => {
            setScannerState('scanning');
            setLastScannedCode(null);
          }, 3000);
        } else {
          setScannerState('error');
          setErrorMessage(result.message || 'Error al procesar el acceso');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } catch (error) {
        setScannerState('error');
        setErrorMessage(
          error instanceof Error ? error.message : 'Error inesperado',
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [scannerState, lastScannedCode, isConnected, processAccess],
  );

  // Configuración del escáner de códigos
  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned,
  });

  /**
   * Resetea el escáner para intentar de nuevo.
   */
  const handleRetry = () => {
    setScannerState('scanning');
    setLastScannedCode(null);
    setErrorMessage(null);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Sin permisos
  // ─────────────────────────────────────────────────────────────────────────
  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={80} color={colors.primary} />
          <Text style={styles.permissionTitle}>Acceso a la cámara</Text>
          <Text style={styles.permissionText}>
            SMART_RETAIL necesita acceso a la cámara para escanear códigos QR y
            procesar tus accesos.
          </Text>
          <Pressable style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Permitir acceso</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Sin dispositivo de cámara
  // ─────────────────────────────────────────────────────────────────────────
  if (!device) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="warning-outline" size={80} color={colors.error} />
          <Text style={styles.permissionTitle}>Cámara no disponible</Text>
          <Text style={styles.permissionText}>
            No se pudo acceder a la cámara del dispositivo.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Escáner activo
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Cámara */}
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={scannerState === 'scanning'}
        codeScanner={codeScanner}
      />

      {/* Overlay oscuro con ventana de escaneo */}
      <View style={styles.overlay}>
        {/* Header */}
        <SafeAreaView style={styles.header}>
          <Text style={styles.headerTitle}>Escanear QR</Text>
          {!isConnected && (
            <View style={styles.offlineBadge}>
              <Ionicons name="cloud-offline" size={14} color="#FFA500" />
              <Text style={styles.offlineText}>Offline</Text>
            </View>
          )}
        </SafeAreaView>

        {/* Área de escaneo */}
        <View style={styles.scanArea}>
          <View style={styles.scanFrame}>
            {/* Esquinas decorativas */}
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
          </View>
        </View>

        {/* Footer con instrucciones o estado */}
        <View style={styles.footer}>
          {scannerState === 'scanning' && (
            <Text style={styles.instruction}>
              Apunta al código QR para escanear
            </Text>
          )}

          {scannerState === 'processing' && (
            <View style={styles.statusContainer}>
              <Text style={styles.statusText}>Procesando acceso...</Text>
            </View>
          )}

          {scannerState === 'success' && (
            <View style={[styles.statusContainer, styles.successContainer]}>
              <Ionicons name="checkmark-circle" size={48} color="#4CAF50" />
              <Text style={styles.successText}>¡Acceso permitido!</Text>
            </View>
          )}

          {scannerState === 'error' && (
            <View style={[styles.statusContainer, styles.errorContainer]}>
              <Ionicons name="close-circle" size={48} color={colors.error} />
              <Text style={styles.errorText}>{errorMessage}</Text>
              <Pressable style={styles.retryButton} onPress={handleRetry}>
                <Text style={styles.retryButtonText}>Intentar de nuevo</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>

      {/* Loading overlay mientras procesa */}
      {isProcessing && <LoadingOverlay message="Procesando..." />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: typography.fontSemiBold,
    color: '#FFF',
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    marginLeft: spacing.md,
  },
  offlineText: {
    color: '#FFA500',
    fontSize: 12,
    fontFamily: typography.fontMedium,
    marginLeft: 4,
  },
  scanArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 280,
    height: 280,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: colors.primary,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },
  instruction: {
    fontSize: 16,
    fontFamily: typography.fontMedium,
    color: '#FFF',
    textAlign: 'center',
  },
  statusContainer: {
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 16,
    minWidth: 200,
  },
  statusText: {
    fontSize: 16,
    fontFamily: typography.fontMedium,
    color: '#FFF',
  },
  successContainer: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  successText: {
    fontSize: 18,
    fontFamily: typography.fontSemiBold,
    color: '#4CAF50',
    marginTop: spacing.sm,
  },
  errorContainer: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
  },
  errorText: {
    fontSize: 14,
    fontFamily: typography.fontMedium,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: typography.fontSemiBold,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  permissionTitle: {
    fontSize: 24,
    fontFamily: typography.fontBold,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  permissionText: {
    fontSize: 16,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  permissionButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: typography.fontSemiBold,
  },
});
