/**
 * ============================================================================
 * SMART_RETAIL Admin Web - Transactions Page
 * ============================================================================
 * Auditoría de transacciones: Historial y detalle de operaciones.
 */

import { transactionsApi, TransactionSearchParams } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import {
    AlertTriangle,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    Clock,
    Filter,
    Loader2,
    Receipt,
    RefreshCw,
    XCircle
} from 'lucide-react';
import { useState } from 'react';

const PAGE_SIZE = 20;

export default function TransactionsPage() {
  const [filters, setFilters] = useState<TransactionSearchParams>({
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [showFilters, setShowFilters] = useState(false);

  // Fetch transactions
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => transactionsApi.list(filters),
  });

  const transactions = data?.transactions || [];
  const total = data?.total || 0;
  const currentPage = Math.floor((filters.offset || 0) / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const goToPage = (page: number) => {
    setFilters((prev) => ({
      ...prev,
      offset: (page - 1) * PAGE_SIZE,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transacciones</h1>
          <p className="text-gray-500">Historial y auditoría de operaciones</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg ${
              showFilters
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filtros
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <select
                value={filters.status || ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    status: e.target.value || undefined,
                    offset: 0,
                  }))
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="PAID">Pagado</option>
                <option value="PENDING">Pendiente</option>
                <option value="FAILED">Fallido</option>
                <option value="REFUNDED">Reembolsado</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Desde
              </label>
              <input
                type="date"
                value={filters.fromDate || ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    fromDate: e.target.value || undefined,
                    offset: 0,
                  }))
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hasta
              </label>
              <input
                type="date"
                value={filters.toDate || ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    toDate: e.target.value || undefined,
                    offset: 0,
                  }))
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() =>
                  setFilters({ limit: PAGE_SIZE, offset: 0 })
                }
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Limpiar Filtros
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Total"
          value={total}
          icon={Receipt}
          color="blue"
        />
        <StatCard
          label="Pagadas"
          value={transactions.filter((t) => t.status === 'PAID').length}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          label="Fallidas"
          value={transactions.filter((t) => t.status === 'FAILED').length}
          icon={XCircle}
          color="red"
        />
        <StatCard
          label="Pendientes"
          value={transactions.filter((t) => t.status === 'PENDING').length}
          icon={Clock}
          color="amber"
        />
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Usuario
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Dispositivo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Monto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Fecha
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No hay transacciones registradas
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <code className="text-xs text-gray-500">
                        {tx.id.slice(0, 8)}...
                      </code>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {tx.userId.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {tx.deviceId.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {formatCurrency(tx.amountCents)}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={tx.status} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(tx.createdAt).toLocaleString('es-AR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
            <p className="text-sm text-gray-500">
              Mostrando {(filters.offset || 0) + 1} a{' '}
              {Math.min((filters.offset || 0) + PAGE_SIZE, total)} de {total}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 border rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 py-2 text-sm">
                Página {currentPage} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 border rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCOMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'red' | 'amber';
}

function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  const colors = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
    amber: 'bg-amber-100 text-amber-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    PAID: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
    PENDING: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock },
    FAILED: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
    REFUNDED: { bg: 'bg-purple-100', text: 'text-purple-700', icon: RefreshCw },
    REFUNDED_HW_FAILURE: { bg: 'bg-orange-100', text: 'text-orange-700', icon: AlertTriangle },
  };

  const { bg, text, icon: Icon } = config[status] || {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    icon: Clock,
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}
    >
      <Icon className="h-3 w-3" />
      {status}
    </span>
  );
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(cents / 100);
}
