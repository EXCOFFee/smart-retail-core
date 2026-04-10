/**
 * ============================================================================
 * SMART_RETAIL Admin Web - Badge Component
 * ============================================================================
 * Etiquetas de estado con variantes semánticas.
 * ============================================================================
 */

import { HTMLAttributes, forwardRef } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';
type BadgeSize = 'sm' | 'md';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-(--color-background-subtle) text-(--color-text-secondary)',
  success: 'bg-(--color-success-light) text-(--color-success-dark)',
  warning: 'bg-(--color-warning-light) text-(--color-warning-dark)',
  error: 'bg-(--color-error-light) text-(--color-error-dark)',
  info: 'bg-(--color-info-light) text-(--color-info-dark)',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-(--color-text-tertiary)',
  success: 'bg-(--color-success)',
  warning: 'bg-(--color-warning)',
  error: 'bg-(--color-error)',
  info: 'bg-(--color-info)',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      variant = 'default',
      size = 'sm',
      dot = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    return (
      <span
        ref={ref}
        className={`
          inline-flex items-center gap-1.5
          font-medium rounded-full
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {dot && (
          <span
            className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`}
            aria-hidden="true"
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export default Badge;
