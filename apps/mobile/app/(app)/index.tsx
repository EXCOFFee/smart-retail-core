/**
 * ============================================================================
 * SMART_RETAIL - Home Screen (Dashboard)
 * ============================================================================
 * Pantalla principal con resumen y acceso rápido al escáner.
 * ============================================================================
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';
import { colors, radii, shadows, spacing, typography } from '@/theme';

export default function HomeScreen() {
  const { user } = useAuth();
  const { isConnected } = useNetwork();

  const greeting = getGreeting();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.userName}>{user?.fullName ?? 'Usuario'}</Text>
          </View>
          <Pressable
            style={styles.profileButton}
            onPress={() => router.push('/(app)/profile')}
          >
            <Ionicons name="person-circle" size={40} color={colors.primary} />
          </Pressable>
        </View>

        {/* Quick Scan Card */}
        <Pressable
          style={styles.scanCard}
          onPress={() => router.push('/(app)/scan')}
        >
          <View style={styles.scanCardContent}>
            <View style={styles.scanIconContainer}>
              <Ionicons name="qr-code" size={48} color="#FFF" />
            </View>
            <View style={styles.scanTextContainer}>
              <Text style={styles.scanTitle}>Escanear QR</Text>
              <Text style={styles.scanSubtitle}>
                Accede con tu código QR
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#FFF" />
        </Pressable>

        {/* Connection Status */}
        <View
          style={[
            styles.statusCard,
            !isConnected && styles.statusCardOffline,
          ]}
        >
          <Ionicons
            name={isConnected ? 'wifi' : 'cloud-offline'}
            size={24}
            color={isConnected ? colors.success : colors.warning}
          />
          <View style={styles.statusTextContainer}>
            <Text style={styles.statusTitle}>
              {isConnected ? 'Conectado' : 'Sin conexión'}
            </Text>
            <Text style={styles.statusSubtitle}>
              {isConnected
                ? 'Listo para escanear'
                : 'Verifica tu conexión a internet'}
            </Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Accesos rápidos</Text>
        <View style={styles.actionsGrid}>
          <ActionCard
            icon="receipt-outline"
            title="Historial"
            onPress={() => router.push('/(app)/history')}
          />
          <ActionCard
            icon="wallet-outline"
            title="Saldo"
            onPress={() => router.push('/(app)/profile')}
          />
          <ActionCard
            icon="help-circle-outline"
            title="Ayuda"
            onPress={() => {}}
          />
          <ActionCard
            icon="settings-outline"
            title="Ajustes"
            onPress={() => router.push('/(app)/profile')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

interface ActionCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  onPress: () => void;
}

function ActionCard({ icon, title, onPress }: ActionCardProps) {
  return (
    <Pressable style={styles.actionCard} onPress={onPress}>
      <View style={styles.actionIconContainer}>
        <Ionicons name={icon} size={24} color={colors.primary} />
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
    </Pressable>
  );
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
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  greeting: {
    fontSize: 14,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
  },
  userName: {
    fontSize: 24,
    fontFamily: typography.fontBold,
    color: colors.text,
  },
  profileButton: {
    padding: spacing.xs,
  },
  scanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.lg,
  },
  scanCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  scanTextContainer: {},
  scanTitle: {
    fontSize: 20,
    fontFamily: typography.fontBold,
    color: '#FFF',
  },
  scanSubtitle: {
    fontSize: 14,
    fontFamily: typography.fontRegular,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.xl,
    ...shadows.sm,
  },
  statusCardOffline: {
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: 'rgba(243, 156, 18, 0.05)',
  },
  statusTextContainer: {
    marginLeft: spacing.md,
  },
  statusTitle: {
    fontSize: 16,
    fontFamily: typography.fontSemiBold,
    color: colors.text,
  },
  statusSubtitle: {
    fontSize: 13,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: typography.fontSemiBold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  actionTitle: {
    fontSize: 14,
    fontFamily: typography.fontMedium,
    color: colors.text,
  },
});
