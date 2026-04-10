/**
 * ============================================================================
 * SMART_RETAIL - Loading Overlay
 * ============================================================================
 * Overlay de carga semitransparente sobre contenido existente.
 * ============================================================================
 */

import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/theme';

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({
  message = 'Procesando...',
}: LoadingOverlayProps) {
  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xxl,
    borderRadius: radii.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  message: {
    marginTop: spacing.md,
    fontSize: 16,
    fontFamily: typography.fontMedium,
    color: colors.text,
  },
});
