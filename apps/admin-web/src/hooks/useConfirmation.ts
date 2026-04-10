/**
 * ============================================================================
 * SMART_RETAIL Admin-Web - useConfirmation Hook
 * ============================================================================
 * Hook para diálogos de confirmación.
 * 
 * Features:
 * - Estado del modal de confirmación
 * - Promesa de resolución
 * - Customización de mensajes
 * ============================================================================
 */

import { useCallback, useState } from 'react';

interface ConfirmationOptions {
  /** Título del diálogo */
  title?: string;
  /** Mensaje de confirmación */
  message: string;
  /** Texto del botón de confirmación */
  confirmText?: string;
  /** Texto del botón de cancelación */
  cancelText?: string;
  /** Variante visual (peligro para acciones destructivas) */
  variant?: 'default' | 'danger';
}

interface ConfirmationState extends ConfirmationOptions {
  isOpen: boolean;
  resolve: ((confirmed: boolean) => void) | null;
}

interface UseConfirmationReturn {
  /** Estado actual del diálogo */
  confirmationState: ConfirmationState;
  /** Mostrar diálogo de confirmación (retorna promesa) */
  confirm: (options: ConfirmationOptions) => Promise<boolean>;
  /** Manejar confirmación */
  handleConfirm: () => void;
  /** Manejar cancelación */
  handleCancel: () => void;
  /** Cerrar diálogo */
  close: () => void;
}

const initialState: ConfirmationState = {
  isOpen: false,
  title: '',
  message: '',
  confirmText: 'Confirmar',
  cancelText: 'Cancelar',
  variant: 'default',
  resolve: null,
};

/**
 * Hook para mostrar diálogos de confirmación.
 *
 * @returns Estado y funciones para manejar confirmaciones
 *
 * @example
 * ```tsx
 * function DeleteButton({ onDelete }: { onDelete: () => void }) {
 *   const { confirmationState, confirm, handleConfirm, handleCancel } =
 *     useConfirmation();
 *
 *   const handleClick = async () => {
 *     const confirmed = await confirm({
 *       title: '¿Eliminar producto?',
 *       message: 'Esta acción no se puede deshacer.',
 *       confirmText: 'Eliminar',
 *       variant: 'danger',
 *     });
 *
 *     if (confirmed) {
 *       onDelete();
 *     }
 *   };
 *
 *   return (
 *     <>
 *       <button onClick={handleClick}>Eliminar</button>
 *       <ConfirmDialog
 *         isOpen={confirmationState.isOpen}
 *         title={confirmationState.title}
 *         message={confirmationState.message}
 *         confirmText={confirmationState.confirmText}
 *         cancelText={confirmationState.cancelText}
 *         variant={confirmationState.variant}
 *         onConfirm={handleConfirm}
 *         onCancel={handleCancel}
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export function useConfirmation(): UseConfirmationReturn {
  const [state, setState] = useState<ConfirmationState>(initialState);

  const confirm = useCallback((options: ConfirmationOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        title: options.title ?? '¿Confirmar acción?',
        message: options.message,
        confirmText: options.confirmText ?? 'Confirmar',
        cancelText: options.cancelText ?? 'Cancelar',
        variant: options.variant ?? 'default',
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState(initialState);
  }, [state.resolve]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState(initialState);
  }, [state.resolve]);

  const close = useCallback(() => {
    state.resolve?.(false);
    setState(initialState);
  }, [state.resolve]);

  return {
    confirmationState: state,
    confirm,
    handleConfirm,
    handleCancel,
    close,
  };
}
