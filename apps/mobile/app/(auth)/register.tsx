/**
 * ============================================================================
 * SMART_RETAIL - Register Screen (Placeholder)
 * ============================================================================
 * Pantalla de registro de usuarios.
 * TODO: Implementar formulario completo de registro.
 * ============================================================================
 */

import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '@/theme';

export default function RegisterScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Back button */}
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Crear cuenta</Text>
          <Text style={styles.subtitle}>
            El registro de usuarios está disponible solo para operadores
            autorizados.
          </Text>
        </View>

        {/* Info card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={48} color={colors.info} />
          <Text style={styles.infoText}>
            Para acceder al sistema SMART_RETAIL, contacta con el administrador de tu
            organización.
          </Text>
        </View>

        {/* Back to login */}
        <Link href="/(auth)/login" asChild>
          <Pressable style={styles.loginLink}>
            <Text style={styles.loginLinkText}>Volver al inicio de sesión</Text>
          </Pressable>
        </Link>
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
    fontSize: 32,
    fontFamily: typography.fontBold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  infoText: {
    fontSize: 14,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 22,
  },
  loginLink: {
    marginTop: spacing.xxl,
    alignSelf: 'center',
  },
  loginLinkText: {
    fontSize: 16,
    fontFamily: typography.fontSemiBold,
    color: colors.primary,
  },
});
