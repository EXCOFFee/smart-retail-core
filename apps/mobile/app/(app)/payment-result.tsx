/**
 * ============================================================================
 * SMART_RETAIL - Payment Result Screen
 * ============================================================================
 * Pantalla de resultado de pago (para callbacks de MODO).
 * ============================================================================
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '@/theme';

type PaymentStatus = 'success' | 'failure' | 'pending';

interface StatusConfig {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  color: string;
  bgColor: string;
}

const STATUS_CONFIGS: Record<PaymentStatus, StatusConfig> = {
  success: {
    icon: 'checkmark-circle',
    title: '¡Pago exitoso!',
    color: colors.success,
    bgColor: `${colors.success}20`,
  },
  failure: {
    icon: 'close-circle',
    title: 'Pago rechazado',
    color: colors.error,
    bgColor: `${colors.error}20`,
  },
  pending: {
    icon: 'time',
    title: 'Pago en proceso',
    color: colors.warning,
    bgColor: `${colors.warning}20`,
  },
};

export default function PaymentResultScreen() {
  const params = useLocalSearchParams<{
    status: PaymentStatus;
    transactionId: string;
    error?: string;
  }>();

  const status = params.status ?? 'pending';
  const config = STATUS_CONFIGS[status];

  // Feedback háptico al mostrar resultado
  useEffect(() => {
    if (status === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (status === 'failure') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [status]);

  const handleContinue = () => {
    router.replace('/(app)');
  };

  const handleRetry = () => {
    router.replace('/(app)/scan');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Status Icon */}
        <View style={[styles.iconContainer, { backgroundColor: config.bgColor }]}>
          <Ionicons name={config.icon} size={80} color={config.color} />
        </View>

        {/* Title */}
        <Text style={styles.title}>{config.title}</Text>

        {/* Details */}
        {status === 'success' && (
          <Text style={styles.message}>
            Tu acceso ha sido procesado correctamente.
          </Text>
        )}

        {status === 'failure' && (
          <Text style={styles.message}>
            {params.error ?? 'No se pudo procesar el pago. Intenta nuevamente.'}
          </Text>
        )}

        {status === 'pending' && (
          <Text style={styles.message}>
            Tu pago está siendo procesado. Recibirás una notificación cuando se
            complete.
          </Text>
        )}

        {/* Transaction ID */}
        {params.transactionId && (
          <View style={styles.transactionContainer}>
            <Text style={styles.transactionLabel}>ID de transacción</Text>
            <Text style={styles.transactionId}>{params.transactionId}</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {status === 'failure' && (
            <Pressable style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Intentar de nuevo</Text>
            </Pressable>
          )}

          <Pressable
            style={[
              styles.continueButton,
              status === 'failure' && styles.continueButtonSecondary,
            ]}
            onPress={handleContinue}
          >
            <Text
              style={[
                styles.continueButtonText,
                status === 'failure' && styles.continueButtonTextSecondary,
              ]}
            >
              Volver al inicio
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 28,
    fontFamily: typography.fontBold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  message: {
    fontSize: 16,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  transactionContainer: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  transactionLabel: {
    fontSize: 12,
    fontFamily: typography.fontMedium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  transactionId: {
    fontSize: 14,
    fontFamily: typography.fontMedium,
    color: colors.text,
  },
  actions: {
    width: '100%',
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  retryButtonText: {
    fontSize: 16,
    fontFamily: typography.fontSemiBold,
    color: '#FFF',
  },
  continueButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  continueButtonText: {
    fontSize: 16,
    fontFamily: typography.fontSemiBold,
    color: '#FFF',
  },
  continueButtonTextSecondary: {
    color: colors.text,
  },
});
