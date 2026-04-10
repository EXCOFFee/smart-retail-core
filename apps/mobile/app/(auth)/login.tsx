/**
 * ============================================================================
 * SMART_RETAIL - Login Screen
 * ============================================================================
 * Pantalla de inicio de sesión.
 * 
 * FEATURES:
 * - Login con email/password
 * - Biometric authentication (Face ID / Touch ID)
 * - Manejo de estados offline
 * - Validación en tiempo real
 * ============================================================================
 */

import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
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
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';
import { colors, spacing, typography } from '@/theme';

export default function LoginScreen() {
  const { login, isLoading } = useAuth();
  const { isConnected } = useNetwork();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );

  /**
   * Valida el formulario antes de enviar.
   */
  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!email) {
      newErrors.email = 'El email es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Ingresa un email válido';
    }

    if (!password) {
      newErrors.password = 'La contraseña es requerida';
    } else if (password.length < 8) {
      newErrors.password = 'La contraseña debe tener al menos 8 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Maneja el submit del formulario.
   */
  const handleLogin = async () => {
    if (!validateForm()) return;

    if (!isConnected) {
      Alert.alert(
        'Sin conexión',
        'Necesitas conexión a internet para iniciar sesión',
        [{ text: 'Entendido' }],
      );
      return;
    }

    try {
      await login(email.toLowerCase().trim(), password);
      router.replace('/(app)');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error al iniciar sesión';
      Alert.alert('Error', message, [{ text: 'Intentar de nuevo' }]);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>SMART_RETAIL</Text>
          <Text style={styles.tagline}>Sistema de Aduana de Control</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Offline indicator */}
          {!isConnected && (
            <View style={styles.offlineBanner}>
              <Ionicons name="cloud-offline" size={16} color="#FFA500" />
              <Text style={styles.offlineText}>Sin conexión a internet</Text>
            </View>
          )}

          {/* Email input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View
              style={[styles.inputWrapper, errors.email && styles.inputError]}
            >
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
                  if (errors.email) setErrors((e: typeof errors) => ({ ...e, email: undefined }));
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>
            {errors.email && (
              <Text style={styles.errorText}>{errors.email}</Text>
            )}
          </View>

          {/* Password input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contraseña</Text>
            <View
              style={[
                styles.inputWrapper,
                errors.password && styles.inputError,
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={colors.textSecondary}
              />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.placeholder}
                value={password}
                onChangeText={(text: string) => {
                  setPassword(text);
                  if (errors.password)
                    setErrors((e: typeof errors) => ({ ...e, password: undefined }));
                }}
                secureTextEntry={!showPassword}
                autoComplete="password"
                editable={!isLoading}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>
            {errors.password && (
              <Text style={styles.errorText}>{errors.password}</Text>
            )}
          </View>

          {/* Forgot password link */}
          <Link href="/(auth)/forgot-password" asChild>
            <Pressable style={styles.forgotLink}>
              <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
            </Pressable>
          </Link>

          {/* Submit button */}
          <Button
            title="Iniciar Sesión"
            onPress={handleLogin}
            disabled={isLoading || !isConnected}
            loading={isLoading}
            style={styles.submitButton}
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>¿No tienes cuenta?</Text>
          <Link href="/(auth)/register" asChild>
            <Pressable>
              <Text style={styles.footerLink}> Regístrate</Text>
            </Pressable>
          </Link>
        </View>
      </KeyboardAvoidingView>

      {isLoading && <LoadingOverlay message="Iniciando sesión..." />}
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
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logo: {
    fontSize: 48,
    fontFamily: typography.fontBold,
    color: colors.primary,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 14,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    marginTop: spacing.xs,
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
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  offlineText: {
    color: '#FFA500',
    fontSize: 13,
    fontFamily: typography.fontMedium,
    marginLeft: spacing.xs,
  },
  inputGroup: {
    marginBottom: spacing.md,
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
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: spacing.lg,
  },
  forgotText: {
    fontSize: 14,
    fontFamily: typography.fontMedium,
    color: colors.primary,
  },
  submitButton: {
    marginTop: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    fontSize: 14,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
  },
  footerLink: {
    fontSize: 14,
    fontFamily: typography.fontSemiBold,
    color: colors.primary,
  },
});
