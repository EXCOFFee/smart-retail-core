/**
 * ============================================================================
 * SMART_RETAIL Admin Web - Utility Functions
 * ============================================================================
 * Funciones utilitarias compartidas.
 */

type ClassValue = string | undefined | null | false;

/**
 * Combina clases de Tailwind de forma segura.
 * Filtra valores falsy y une las clases.
 * 
 * @example
 * cn('p-4', isActive && 'bg-blue-500', 'text-white')
 * // Resultado: "p-4 bg-blue-500 text-white" (si isActive es true)
 */
export function cn(...inputs: ClassValue[]): string {
  return inputs.filter(Boolean).join(' ');
}
