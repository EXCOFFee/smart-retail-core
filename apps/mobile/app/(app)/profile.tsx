/**
 * ============================================================================
 * SMART_RETAIL - Profile Screen
 * ============================================================================
 * Pantalla de perfil y configuración del usuario.
 * ============================================================================
 */

import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/providers/AuthProvider';
import { colors, radii, shadows, spacing, typography } from '@/theme';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: logout,
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Perfil</Text>
        </View>

        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {getInitials(user?.fullName ?? 'U')}
            </Text>
          </View>
          <Text style={styles.userName}>{user?.fullName ?? 'Usuario'}</Text>
          <Text style={styles.userEmail}>{user?.email ?? ''}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{getRoleLabel(user?.role)}</Text>
          </View>
        </View>

        {/* Menu Sections */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Cuenta</Text>
          <MenuItem
            icon="person-outline"
            title="Editar perfil"
            onPress={() => {}}
          />
          <MenuItem
            icon="wallet-outline"
            title="Mi saldo"
            onPress={() => {}}
          />
          <MenuItem
            icon="notifications-outline"
            title="Notificaciones"
            onPress={() => {}}
          />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Seguridad</Text>
          <MenuItem
            icon="lock-closed-outline"
            title="Cambiar contraseña"
            onPress={() => {}}
          />
          <MenuItem
            icon="finger-print-outline"
            title="Biometría"
            onPress={() => {}}
          />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Soporte</Text>
          <MenuItem
            icon="help-circle-outline"
            title="Ayuda"
            onPress={() => {}}
          />
          <MenuItem
            icon="document-text-outline"
            title="Términos y condiciones"
            onPress={() => {}}
          />
          <MenuItem
            icon="shield-checkmark-outline"
            title="Política de privacidad"
            onPress={() => {}}
          />
        </View>

        {/* Logout Button */}
        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </Pressable>

        {/* Version */}
        <Text style={styles.version}>SMART_RETAIL v0.1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  onPress: () => void;
}

function MenuItem({ icon, title, onPress }: MenuItemProps) {
  return (
    <Pressable style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuItemLeft}>
        <Ionicons name={icon} size={20} color={colors.text} />
        <Text style={styles.menuItemTitle}>{title}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getRoleLabel(role?: string): string {
  const labels: Record<string, string> = {
    consumer: 'Consumidor',
    merchant: 'Comerciante',
    operator: 'Operador',
    admin: 'Administrador',
  };
  return labels[role ?? ''] ?? 'Usuario';
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: typography.fontBold,
    color: colors.text,
  },
  userCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: 28,
    fontFamily: typography.fontBold,
    color: '#FFF',
  },
  userName: {
    fontSize: 20,
    fontFamily: typography.fontSemiBold,
    color: colors.text,
  },
  userEmail: {
    fontSize: 14,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  roleBadge: {
    backgroundColor: `${colors.primary}15`,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    marginTop: spacing.sm,
  },
  roleText: {
    fontSize: 12,
    fontFamily: typography.fontMedium,
    color: colors.primary,
  },
  menuSection: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: typography.fontSemiBold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
    ...shadows.sm,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemTitle: {
    fontSize: 15,
    fontFamily: typography.fontMedium,
    color: colors.text,
    marginLeft: spacing.md,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radii.lg,
  },
  logoutText: {
    fontSize: 16,
    fontFamily: typography.fontSemiBold,
    color: colors.error,
    marginLeft: spacing.sm,
  },
  version: {
    fontSize: 12,
    fontFamily: typography.fontRegular,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
