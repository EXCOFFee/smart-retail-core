/**
 * ============================================================================
 * SMART_RETAIL Admin-Web - Skeleton Components
 * ============================================================================
 * Componentes de loading skeleton para mejor UX durante carga.
 * 
 * Por qué Skeletons: Mejora percepción de velocidad vs spinner estático.
 * Referencia: 03_frontend_react.md - UX Validation con Skeletons.
 * ============================================================================
 */

import { cn } from '../../lib/utils';

interface SkeletonProps {
  className?: string;
}

/**
 * Skeleton base con animación pulse.
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-(--color-border-light)',
        className,
      )}
    />
  );
}

/**
 * Skeleton para texto de una línea.
 */
export function SkeletonText({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-4 w-full', className)} />;
}

/**
 * Skeleton para avatar/imagen circular.
 */
export function SkeletonAvatar({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-10 w-10 rounded-full', className)} />;
}

/**
 * Skeleton para botón.
 */
export function SkeletonButton({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-10 w-24 rounded-lg', className)} />;
}

/**
 * Skeleton para card completa.
 */
export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-(--color-border-light) p-6 space-y-4',
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <SkeletonAvatar />
        <div className="flex-1 space-y-2">
          <SkeletonText className="w-1/2" />
          <SkeletonText className="w-1/4" />
        </div>
      </div>
      <SkeletonText />
      <SkeletonText className="w-3/4" />
    </div>
  );
}

/**
 * Skeleton para fila de tabla.
 */
export function SkeletonTableRow({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b border-(--color-border-light)">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <SkeletonText className={i === 0 ? 'w-32' : 'w-20'} />
        </td>
      ))}
    </tr>
  );
}

/**
 * Skeleton para tabla completa.
 */
export function SkeletonTable({
  rows = 5,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-6 py-3 text-left">
                <SkeletonText className="w-16 h-3" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonTableRow key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Skeleton para stat card del Dashboard.
 */
export function SkeletonStatCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-6 space-y-3">
      <div className="flex items-center justify-between">
        <SkeletonText className="w-24 h-3" />
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>
      <SkeletonText className="w-16 h-8" />
      <SkeletonText className="w-20 h-3" />
    </div>
  );
}

/**
 * Skeleton para Dashboard completo.
 */
export function SkeletonDashboard() {
  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="space-y-2">
        <SkeletonText className="w-32 h-6" />
        <SkeletonText className="w-48 h-4" />
      </div>

      {/* Stats Grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>

      {/* Cards Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

/**
 * Skeleton para lista de productos.
 */
export function SkeletonProductList() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <SkeletonText className="w-24 h-6" />
          <SkeletonText className="w-48 h-4" />
        </div>
        <SkeletonButton />
      </div>

      {/* Search */}
      <Skeleton className="h-10 w-full rounded-lg" />

      {/* Table */}
      <SkeletonTable rows={8} columns={6} />
    </div>
  );
}
