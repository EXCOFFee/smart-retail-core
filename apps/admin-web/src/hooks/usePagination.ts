/**
 * ============================================================================
 * SMART_RETAIL Admin-Web - usePagination Hook
 * ============================================================================
 * Hook para manejo de paginación en tablas.
 * 
 * Features:
 * - Estado de página actual
 * - Tamaño de página configurable
 * - Cálculo de total de páginas
 * - Navegación (siguiente, anterior, ir a página)
 * ============================================================================
 */

import { useCallback, useMemo, useState } from 'react';

interface UsePaginationOptions {
  /** Tamaño de página inicial (default: 10) */
  initialPageSize?: number;
  /** Página inicial (default: 1) */
  initialPage?: number;
  /** Tamaños de página disponibles */
  pageSizeOptions?: number[];
}

interface UsePaginationReturn {
  /** Página actual (1-based) */
  page: number;
  /** Tamaño de página actual */
  pageSize: number;
  /** Total de páginas */
  totalPages: number;
  /** Si hay página anterior */
  hasPreviousPage: boolean;
  /** Si hay página siguiente */
  hasNextPage: boolean;
  /** Tamaños de página disponibles */
  pageSizeOptions: number[];
  /** Ir a página específica */
  goToPage: (page: number) => void;
  /** Ir a página siguiente */
  nextPage: () => void;
  /** Ir a página anterior */
  previousPage: () => void;
  /** Cambiar tamaño de página */
  setPageSize: (size: number) => void;
  /** Calcular índices para slice de datos */
  getSliceIndices: () => { start: number; end: number };
  /** Resetear a primera página */
  reset: () => void;
  /** Total de elementos (necesario setear externamente) */
  totalItems: number;
  /** Actualizar total de elementos */
  setTotalItems: (total: number) => void;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/**
 * Hook para manejar la paginación de tablas.
 *
 * @param options - Opciones de configuración
 * @returns Estado y funciones de paginación
 *
 * @example
 * ```tsx
 * function ProductsTable() {
 *   const {
 *     page,
 *     pageSize,
 *     totalPages,
 *     goToPage,
 *     nextPage,
 *     previousPage,
 *     setTotalItems,
 *   } = usePagination({ initialPageSize: 25 });
 *
 *   const { data } = useQuery({
 *     queryKey: ['products', page, pageSize],
 *     queryFn: () => fetchProducts({ page, limit: pageSize }),
 *     onSuccess: (data) => setTotalItems(data.total),
 *   });
 *
 *   return (
 *     <>
 *       <Table data={data.items} />
 *       <Pagination
 *         page={page}
 *         totalPages={totalPages}
 *         onPageChange={goToPage}
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export function usePagination(
  options: UsePaginationOptions = {},
): UsePaginationReturn {
  const {
    initialPageSize = 10,
    initialPage = 1,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  } = options;

  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [totalItems, setTotalItems] = useState(0);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalItems / pageSize));
  }, [totalItems, pageSize]);

  const hasPreviousPage = page > 1;
  const hasNextPage = page < totalPages;

  const goToPage = useCallback(
    (newPage: number) => {
      const validPage = Math.max(1, Math.min(newPage, totalPages));
      setPage(validPage);
    },
    [totalPages],
  );

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setPage((p) => p + 1);
    }
  }, [hasNextPage]);

  const previousPage = useCallback(() => {
    if (hasPreviousPage) {
      setPage((p) => p - 1);
    }
  }, [hasPreviousPage]);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    // Resetear a primera página cuando cambia el tamaño
    setPage(1);
  }, []);

  const getSliceIndices = useCallback(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return { start, end };
  }, [page, pageSize]);

  const reset = useCallback(() => {
    setPage(initialPage);
  }, [initialPage]);

  return {
    page,
    pageSize,
    totalPages,
    hasPreviousPage,
    hasNextPage,
    pageSizeOptions,
    goToPage,
    nextPage,
    previousPage,
    setPageSize,
    getSliceIndices,
    reset,
    totalItems,
    setTotalItems,
  };
}
