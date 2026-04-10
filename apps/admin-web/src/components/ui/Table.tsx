/**
 * ============================================================================
 * SMART_RETAIL Admin Web - Table Component
 * ============================================================================
 * Componente de tabla reutilizable con soporte para:
 * - Loading states
 * - Empty states  
 * - Responsive design
 * - Sortable headers (preparado)
 * - Custom cell rendering
 * 
 * Por qué componente genérico: Evita duplicación en ProductsPage,
 * TransactionsPage y futuros listados. Mantiene consistencia visual.
 * ============================================================================
 */

import { Loader2 } from 'lucide-react';
import { ReactNode } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface TableColumn<T> {
  /** Clave única de la columna */
  key: string;
  /** Texto del header */
  header: string;
  /** Función para renderizar la celda */
  render: (item: T, index: number) => ReactNode;
  /** Clases adicionales para el header */
  headerClassName?: string;
  /** Clases adicionales para la celda */
  cellClassName?: string;
  /** Ancho de la columna (ej: 'w-32', 'w-1/4') */
  width?: string;
  /** Alineación del texto */
  align?: 'left' | 'center' | 'right';
}

export interface TableProps<T> {
  /** Datos a mostrar */
  data: T[];
  /** Definición de columnas */
  columns: TableColumn<T>[];
  /** Función para obtener la key única de cada fila */
  getRowKey: (item: T, index: number) => string;
  /** Estado de carga */
  isLoading?: boolean;
  /** Mensaje cuando no hay datos */
  emptyMessage?: string;
  /** Ícono para estado vacío */
  emptyIcon?: ReactNode;
  /** Callback al hacer click en una fila */
  onRowClick?: (item: T) => void;
  /** Clase adicional para el contenedor */
  className?: string;
  /** Mostrar rayas alternadas */
  striped?: boolean;
  /** Mostrar hover en filas */
  hoverable?: boolean;
  /** Tamaño compacto */
  compact?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function Table<T>({
  data,
  columns,
  getRowKey,
  isLoading = false,
  emptyMessage = 'No hay datos para mostrar',
  emptyIcon,
  onRowClick,
  className = '',
  striped = false,
  hoverable = true,
  compact = false,
}: TableProps<T>) {
  // Helper para alineación de texto
  const getAlignClass = (align?: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'center':
        return 'text-center';
      case 'right':
        return 'text-right';
      default:
        return 'text-left';
    }
  };

  // Padding según tamaño
  const cellPadding = compact ? 'px-4 py-2' : 'px-6 py-4';
  const headerPadding = compact ? 'px-4 py-2' : 'px-6 py-3';

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border overflow-hidden ${className}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          {/* Header */}
          <thead className="bg-(--color-surface) border-b border-(--color-border)">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`
                    ${headerPadding}
                    ${getAlignClass(column.align)}
                    ${column.width || ''}
                    text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider
                    ${column.headerClassName || ''}
                  `}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-(--color-border)">
            {/* Loading State */}
            {isLoading && (
              <tr>
                <td
                  colSpan={columns.length}
                  className={`${cellPadding} py-12 text-center`}
                >
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-(--color-text-muted)" />
                  <p className="mt-2 text-sm text-(--color-text-secondary)">
                    Cargando...
                  </p>
                </td>
              </tr>
            )}

            {/* Empty State */}
            {!isLoading && data.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className={`${cellPadding} py-12 text-center`}
                >
                  {emptyIcon && (
                    <div className="flex justify-center mb-3 text-(--color-text-muted)">
                      {emptyIcon}
                    </div>
                  )}
                  <p className="text-(--color-text-secondary)">{emptyMessage}</p>
                </td>
              </tr>
            )}

            {/* Data Rows */}
            {!isLoading &&
              data.map((item, rowIndex) => (
                <tr
                  key={getRowKey(item, rowIndex)}
                  className={`
                    ${striped && rowIndex % 2 === 1 ? 'bg-(--color-surface)' : ''}
                    ${hoverable ? 'hover:bg-(--color-surface) transition-colors' : ''}
                    ${onRowClick ? 'cursor-pointer' : ''}
                  `}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`
                        ${cellPadding}
                        ${getAlignClass(column.align)}
                        ${column.cellClassName || ''}
                      `}
                    >
                      {column.render(item, rowIndex)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Celda con badge de estado
 */
export interface StatusBadgeProps {
  status: string;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default';
}

export function StatusBadge({ status, variant = 'default' }: StatusBadgeProps) {
  const variantStyles = {
    success: 'bg-(--color-success-light) text-(--color-success-dark)',
    warning: 'bg-(--color-warning-light) text-(--color-warning-dark)',
    error: 'bg-(--color-error-light) text-(--color-error-dark)',
    info: 'bg-(--color-info-light) text-(--color-info-dark)',
    default: 'bg-(--color-surface) text-(--color-text-secondary)',
  };

  return (
    <span
      className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${variantStyles[variant]}`}
    >
      {status}
    </span>
  );
}

/**
 * Celda con acciones (botones)
 */
export interface ActionsCellProps {
  children: ReactNode;
}

export function ActionsCell({ children }: ActionsCellProps) {
  return <div className="flex items-center justify-end gap-2">{children}</div>;
}

/**
 * Botón de acción para tabla
 */
export interface ActionButtonProps {
  onClick: () => void;
  icon: ReactNode;
  label: string;
  variant?: 'default' | 'danger';
}

export function ActionButton({
  onClick,
  icon,
  label,
  variant = 'default',
}: ActionButtonProps) {
  const variantStyles = {
    default:
      'text-(--color-text-muted) hover:text-(--color-primary) hover:bg-(--color-primary)/10',
    danger:
      'text-(--color-text-muted) hover:text-(--color-error) hover:bg-(--color-error)/10',
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`p-2 rounded-lg transition-colors ${variantStyles[variant]}`}
      title={label}
      aria-label={label}
    >
      {icon}
    </button>
  );
}

export default Table;
