/**
 * ============================================================================
 * SMART_RETAIL - Forgot Password Screen
 * ============================================================================
 * Pantalla para solicitar restablecimiento de contraseña.
 * ============================================================================
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { useNetwork } from '@/providers/NetworkProvider';
import { apiClient } from '@/services/api/client';
import { colors, spacing, typography } from '@/theme';

export default function ForgotPasswordScreen() {
  const { isConnected } = useNetwork();

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Valida el email ingresado.
   */
  const validateEmail = (): boolean => {
    if (!email) {
      setError('El email es requerido');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Ingresa un email válido');
      return false;
    }
    setError(null);
    return true;
  };

  /**
   * Envía la solicitud de restablecimiento.
   */
  const handleSubmit = async () => {
    if (!validateEmail()) return;

    if (!isConnected) {
      Alert.alert(
        'Sin conexión',
        'Necesitas conexión a internet para continuar',
        [{ text: 'Entendido' }],
      );
      return;
    }

    setIsLoading(true);

    try {
      await apiClient.post('/auth/forgot-password', {
        email: email.toLowerCase().trim(),
      });

      setEmailSent(true);
    } catch (err) {
      // Por seguridad, mostramos éxito aunque el email no exista
      setEmailSent(true);
    } finally {
      setIsLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Email enviado
  // ─────────────────────────────────────────────────────────────────────────
  if (emailSent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContent}>
          <View style={styles.successIcon}>
            <Ionicons name="mail-outline" size={64} color={colors.success} />
          </View>
          <Text style={styles.successTitle}>Revisa tu email</Text>
          <Text style={styles.successText}>
            Si existe una cuenta asociada a {email}, recibirás un enlace para
            restablecer tu contraseña.
          </Text>
          <Button
            title="Volver al inicio"
            onPress={() => router.replace('/(auth)/login')}
            style={styles.successButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Formulario
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Back button */}
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Recuperar contraseña</Text>
          <Text style={styles.subtitle}>
            Ingresa tu email y te enviaremos instrucciones para restablecer tu
            contraseña.
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={[styles.inputWrapper, error && styles.inputError]}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={colors.textSecondary}
              />
              <TextInput
                style={styles.input}
                placeholder="tu@email.com"
                placeholderTextColor={colors.placeholder}
                value={email}
                onChangeText={(text: string) => {
                  setEmail(text);
                  if (error) setError(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>

          <Button
            title="Enviar instrucciones"
            onPress={handleSubmit}
            disabled={isLoading || !isConnected}
            loading={isLoading}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
    padding: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  header: {
    marginBottom: spacing.xxl,
  },
  title: {
    fontSize: 28,
    fontFamily: typography.fontBold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  form: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 14,
    fontFamily: typography.fontMedium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 52,
  },
  inputError: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: typography.fontRegular,
    color: colors.text,
    marginLeft: spacing.sm,
  },
  errorText: {
    fontSize: 12,
    fontFamily: typography.fontRegular,
    color: colors.error,
    marginTop: spacing.xs,
  },
  // Success state
  successContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${colors.success}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  successTitle: {
    fontSize: 24,
    fontFamily: typography.fontBold,
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  successText: {
    fontSize: 15,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xxl,
  },
  successButton: {
    minWidth: 200,
  },
});
