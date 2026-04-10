/**
 * ============================================================================
 * SMART_RETAIL Admin Web - Modal Component
 * ============================================================================
 * Diálogo modal con animaciones sutiles y backdrop.
 * ============================================================================
 */

import { X } from 'lucide-react';
import { HTMLAttributes, forwardRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
}

const sizeStyles = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      isOpen,
      onClose,
      title,
      description,
      size = 'md',
      showCloseButton = true,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    // Cerrar con Escape
    useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };

      if (isOpen) {
        document.addEventListener('keydown', handleEscape);
        document.body.style.overflow = 'hidden';
      }

      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = '';
      };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const modalContent = (
      <div
        className="fixed inset-0 z-(--z-modal-backdrop) flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-describedby={description ? 'modal-description' : undefined}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Modal panel */}
        <div
          ref={ref}
          className={`
            relative w-full ${sizeStyles[size]}
            bg-(--color-surface) rounded-2xl
            shadow-(--shadow-2xl)
            animate-scaleIn
            ${className}
          `}
          {...props}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-start justify-between gap-4 p-6 pb-0">
              <div>
                {title && (
                  <h2
                    id="modal-title"
                    className="text-xl font-semibold text-(--color-text-primary)"
                  >
                    {title}
                  </h2>
                )}
                {description && (
                  <p
                    id="modal-description"
                    className="mt-1 text-sm text-(--color-text-secondary)"
                  >
                    {description}
                  </p>
                )}
              </div>
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="
                    p-2 -m-2
                    text-(--color-text-tertiary)
                    hover:text-(--color-text-primary)
                    hover:bg-(--color-background-subtle)
                    rounded-lg
                    transition-all duration-200
                  "
                  aria-label="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          )}

          {/* Content */}
          <div className="p-6">{children}</div>
        </div>
      </div>
    );

    return createPortal(modalContent, document.body);
  }
);

Modal.displayName = 'Modal';

// ─────────────────────────────────────────────────────────────────────────────
// MODAL SUBCOMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

export const ModalFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          flex items-center justify-end gap-3
          pt-4 border-t border-(--color-border)
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ModalFooter.displayName = 'ModalFooter';

export default Modal;
