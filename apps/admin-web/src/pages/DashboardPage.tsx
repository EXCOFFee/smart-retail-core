/**
 * ============================================================================
 * SMART_RETAIL Admin Web - Dashboard Page (Rediseñada)
 * ============================================================================
 * Página principal con resumen de métricas.
 * Diseño SMART_RETAIL Slate: minimalista, sofisticado, con animaciones sutiles.
 * ============================================================================
 */

import { devicesApi, productsApi, transactionsApi } from '@/api/client';
import { Badge, Card, SkeletonDashboard } from '@/components/ui';
import { useQuery } from '@tanstack/react-query';
import {
    AlertTriangle,
    CheckCircle,
    Monitor,
    Package,
    Receipt,
    TrendingUp,
    WifiOff,
} from 'lucide-react';

export default function DashboardPage() {
  // Fetch devices
  const { data: devicesData, isLoading: loadingDevices } = useQuery({
    queryKey: ['devices'],
    queryFn: devicesApi.list,
  });

  // Fetch transactions (últimas 24h simulado)
  const { data: transactionsData, isLoading: loadingTransactions } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => transactionsApi.list({ limit: 100 }),
  });

  // Fetch products
  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: productsApi.list,
  });

  // Loading state - mostrar Skeleton para mejor UX
  const isLoading = loadingDevices || loadingTransactions || loadingProducts;
  if (isLoading) {
    return <SkeletonDashboard />;
  }

  // Calcular métricas
  const devices = devicesData?.devices || [];
  const onlineDevices = devices.filter((d) => d.status === 'ONLINE').length;
  const offlineDevices = devices.filter((d) => d.status === 'OFFLINE').length;

  const transactions = transactionsData?.transactions || [];
  const paidTransactions = transactions.filter((t) => t.status === 'PAID');
  const totalRevenue = paidTransactions.reduce((sum, t) => sum + t.amountCents, 0);

  const products = productsData?.products || [];
  const lowStockProducts = products.filter((p) => p.stockQuantity < 5);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-(--color-text-primary)">
          Dashboard
        </h1>
        <p className="text-(--color-text-secondary)">
          Resumen general del sistema
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Dispositivos Online */}
        <StatCard
          title="Dispositivos Online"
          value={onlineDevices}
          subtitle={`${offlineDevices} offline`}
          icon={Monitor}
          variant="success"
        />

        {/* Productos */}
        <StatCard
          title="Productos Activos"
          value={products.length}
          subtitle={`${lowStockProducts.length} con stock bajo`}
          icon={Package}
          variant="info"
        />

        {/* Transacciones Hoy */}
        <StatCard
          title="Transacciones"
          value={transactions.length}
          subtitle={`${paidTransactions.length} completadas`}
          icon={Receipt}
          variant="primary"
        />

        {/* Ingresos */}
        <StatCard
          title="Ingresos del Día"
          value={formatCurrency(totalRevenue)}
          subtitle="Total recaudado"
          icon={TrendingUp}
          variant="warning"
        />
      </div>

      {/* Quick Status */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Device Status */}
        <Card variant="default">
          <Card.Header>
            <Card.Title>Estado de Dispositivos</Card.Title>
          </Card.Header>
          <Card.Content className="space-y-3">
            {devices.length === 0 ? (
              <p className="text-(--color-text-secondary) text-sm py-4 text-center">
                No hay dispositivos registrados
              </p>
            ) : (
              devices.slice(0, 5).map((device, index) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-4 bg-(--color-background-subtle) rounded-lg transition-all duration-200 hover:bg-(--color-border-light)"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-(--color-surface) rounded-md">
                      <Monitor className="h-5 w-5 text-(--color-text-secondary)" />
                    </div>
                    <div>
                      <p className="font-medium text-(--color-text-primary)">
                        {device.name}
                      </p>
                      <p className="text-sm text-(--color-text-tertiary)">
                        {device.serialNumber}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={device.status} />
                </div>
              ))
            )}
          </Card.Content>
        </Card>

        {/* Recent Alerts */}
        <Card variant="default">
          <Card.Header>
            <Card.Title>Alertas Recientes</Card.Title>
          </Card.Header>
          <Card.Content className="space-y-3">
            {lowStockProducts.length > 0 ? (
              lowStockProducts.slice(0, 5).map((product, index) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 p-4 bg-(--color-warning-light) rounded-lg"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="p-2 bg-(--color-surface) rounded-md">
                    <AlertTriangle className="h-5 w-5 text-(--color-warning)" />
                  </div>
                  <div>
                    <p className="font-medium text-(--color-text-primary)">
                      Stock Bajo
                    </p>
                    <p className="text-sm text-(--color-text-secondary)">
                      {product.name} - Solo {product.stockQuantity} unidades
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-3 p-4 bg-(--color-success-light) rounded-lg">
                <div className="p-2 bg-(--color-surface) rounded-md">
                  <CheckCircle className="h-5 w-5 text-(--color-success)" />
                </div>
                <p className="text-(--color-text-secondary)">
                  Sin alertas pendientes
                </p>
              </div>
            )}
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCOMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

type StatVariant = 'success' | 'info' | 'primary' | 'warning';

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: StatVariant;
}

const variantStyles: Record<
  StatVariant,
  { bg: string; iconBg: string; iconColor: string }
> = {
  success: {
    bg: 'bg-(--color-success-light)',
    iconBg: 'bg-(--color-success)',
    iconColor: 'text-white',
  },
  info: {
    bg: 'bg-(--color-info-light)',
    iconBg: 'bg-(--color-info)',
    iconColor: 'text-white',
  },
  primary: {
    bg: 'bg-(--color-accent-light)',
    iconBg: 'bg-(--color-accent)',
    iconColor: 'text-white',
  },
  warning: {
    bg: 'bg-(--color-warning-light)',
    iconBg: 'bg-(--color-warning)',
    iconColor: 'text-white',
  },
};

function StatCard({ title, value, subtitle, icon: Icon, variant }: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <Card variant="elevated" className="overflow-hidden group">
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-(--color-text-secondary)">
              {title}
            </p>
            <p className="text-3xl font-bold text-(--color-text-primary) tracking-tight">
              {value}
            </p>
            <p className="text-sm text-(--color-text-tertiary)">{subtitle}</p>
          </div>
          <div
            className={`${styles.iconBg} p-3 rounded-lg transition-transform duration-200 group-hover:scale-110`}
          >
            <Icon className={`h-6 w-6 ${styles.iconColor}`} />
          </div>
        </div>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { variant: 'success' | 'default' | 'warning' | 'error'; icon: React.ComponentType<{ className?: string }> }
  > = {
    ONLINE: { variant: 'success', icon: CheckCircle },
    OFFLINE: { variant: 'default', icon: WifiOff },
    MAINTENANCE: { variant: 'warning', icon: AlertTriangle },
    COMPROMISED: { variant: 'error', icon: AlertTriangle },
  };

  const { variant, icon: Icon } = config[status] || config.OFFLINE;

  return (
    <Badge variant={variant} size="sm" dot>
      <Icon className="h-3 w-3 mr-1" />
      {status}
    </Badge>
  );
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(cents / 100);
}
