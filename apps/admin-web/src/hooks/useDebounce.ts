/**
 * ============================================================================
 * SMART_RETAIL Admin-Web - useDebounce Hook
 * ============================================================================
 * Hook para debouncing de valores.
 * 
 * Útil para:
 * - Búsquedas en tiempo real
 * - Filtros de tablas
 * - Auto-guardado
 * ============================================================================
 */

import { useEffect, useState } from 'react';

/**
 * Debounce un valor por un tiempo especificado.
 *
 * @param value - El valor a debouncear
 * @param delay - Tiempo de delay en milisegundos (default: 300ms)
 * @returns El valor debounceado
 *
 * @example
 * ```tsx
 * function SearchInput() {
 *   const [search, setSearch] = useState('');
 *   const debouncedSearch = useDebounce(search, 500);
 *
 *   useEffect(() => {
 *     // Solo se ejecuta cuando debouncedSearch cambia
 *     fetchResults(debouncedSearch);
 *   }, [debouncedSearch]);
 *
 *   return <input value={search} onChange={e => setSearch(e.target.value)} />;
 * }
 * ```
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
