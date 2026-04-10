/**
 * ============================================================================
 * SMART_RETAIL - Transaction History Screen
 * ============================================================================
 * Lista de transacciones del usuario.
 * ============================================================================
 */

import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiClient } from '@/services/api/client';
import { colors, radii, shadows, spacing, typography } from '@/theme';

interface Transaction {
  id: string;
  status: 'COMPLETED' | 'FAILED' | 'REFUNDED_HW_FAILURE' | 'PENDING';
  amountCents: number;
  productName: string | null;
  locationName: string;
  createdAt: string;
}

export default function HistoryScreen() {
  const {
    data: transactions,
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const response = await apiClient.get<{ data: Transaction[] }>(
        '/transactions/me',
      );
      return response.data.data;
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Historial</Text>
      </View>

      {/* Content */}
      <FlatList
        data={transactions ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TransactionItem transaction={item} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {isLoading ? (
              <Text style={styles.emptyText}>Cargando...</Text>
            ) : error ? (
              <>
                <Ionicons
                  name="warning-outline"
                  size={48}
                  color={colors.textSecondary}
                />
                <Text style={styles.emptyText}>Error al cargar</Text>
              </>
            ) : (
              <>
                <Ionicons
                  name="receipt-outline"
                  size={48}
                  color={colors.textSecondary}
                />
                <Text style={styles.emptyText}>
                  No hay transacciones aún
                </Text>
              </>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function TransactionItem({ transaction }: { transaction: Transaction }) {
  const statusConfig = getStatusConfig(transaction.status);
  const formattedAmount = formatCurrency(transaction.amountCents);
  const formattedDate = formatDate(transaction.createdAt);

  return (
    <View style={styles.transactionCard}>
      <View style={styles.transactionLeft}>
        <View
          style={[
            styles.statusIcon,
            { backgroundColor: `${statusConfig.color}20` },
          ]}
        >
          <Ionicons
            name={statusConfig.icon}
            size={20}
            color={statusConfig.color}
          />
        </View>
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionTitle}>
            {transaction.productName ?? 'Acceso'}
          </Text>
          <Text style={styles.transactionSubtitle}>
            {transaction.locationName}
          </Text>
          <Text style={styles.transactionDate}>{formattedDate}</Text>
        </View>
      </View>
      <View style={styles.transactionRight}>
        <Text
          style={[
            styles.transactionAmount,
            transaction.status === 'REFUNDED_HW_FAILURE' &&
              styles.transactionAmountRefunded,
          ]}
        >
          {transaction.status === 'REFUNDED_HW_FAILURE' ? '+' : '-'}
          {formattedAmount}
        </Text>
        <Text style={[styles.transactionStatus, { color: statusConfig.color }]}>
          {statusConfig.label}
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getStatusConfig(status: Transaction['status']) {
  const configs = {
    COMPLETED: {
      icon: 'checkmark-circle' as const,
      color: colors.success,
      label: 'Completado',
    },
    FAILED: {
      icon: 'close-circle' as const,
      color: colors.error,
      label: 'Fallido',
    },
    REFUNDED_HW_FAILURE: {
      icon: 'refresh-circle' as const,
      color: colors.warning,
      label: 'Reembolsado',
    },
    PENDING: {
      icon: 'time' as const,
      color: colors.textSecondary,
      label: 'Pendiente',
    },
  };
  return configs[status] ?? configs.PENDING;
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  listContent: {
    padding: spacing.lg,
    flexGrow: 1,
  },
  transactionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 15,
    fontFamily: typography.fontSemiBold,
    color: colors.text,
  },
  transactionSubtitle: {
    fontSize: 13,
    fontFamily: typography.fontRegular,
    color: colors.textSecondary,
    marginTop: 2,
  },
  transactionDate: {
    fontSize: 12,
    fontFamily: typography.fontRegular,
    color: colors.textTertiary,
    marginTop: 2,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 16,
    fontFamily: typography.fontSemiBold,
    color: colors.text,
  },
  transactionAmountRefunded: {
    color: colors.success,
  },
  transactionStatus: {
    fontSize: 12,
    fontFamily: typography.fontMedium,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: typography.fontMedium,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});
