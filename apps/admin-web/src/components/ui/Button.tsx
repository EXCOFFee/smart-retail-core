/**
 * ============================================================================
 * SMART_RETAIL Admin Web - Button Component
 * ============================================================================
 * Botón con variantes y estados siguiendo el design system SMART_RETAIL Slate.
 * ============================================================================
 */

import { Loader2 } from 'lucide-react';
import { ButtonHTMLAttributes, forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-(--color-accent) text-white
    hover:bg-(--color-accent-dark)
    focus-visible:shadow-(--shadow-focus)
  `,
  secondary: `
    bg-(--color-primary) text-white
    hover:bg-(--color-primary-light)
    focus-visible:shadow-(--shadow-focus)
  `,
  outline: `
    bg-transparent text-(--color-text-primary)
    border border-(--color-border)
    hover:bg-(--color-background-subtle)
    focus-visible:shadow-(--shadow-focus)
  `,
  ghost: `
    bg-transparent text-(--color-text-secondary)
    hover:bg-(--color-background-subtle)
    hover:text-(--color-text-primary)
    focus-visible:shadow-(--shadow-focus)
  `,
  danger: `
    bg-(--color-error) text-white
    hover:bg-(--color-error-dark)
    focus-visible:shadow-(--shadow-focus-error)
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-13 px-6 text-base gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type="button"
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center
          font-medium rounded-lg
          transition-all duration-200 ease-out
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
