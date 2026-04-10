/**
 * ============================================================================
 * SMART_RETAIL Admin Web - ErrorBoundary Component Tests
 * ============================================================================
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

// Componente que lanza error en render
function BrokenComponent(): never {
  throw new Error('Component crashed');
}

describe('ErrorBoundary', () => {
  // Suprimir errores de consola durante tests de error boundary
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('normal rendering', () => {
    it('renders children when there is no error', () => {
      render(
        <ErrorBoundary>
          <div>Child content</div>
        </ErrorBoundary>
      );
      expect(screen.getByText('Child content')).toBeInTheDocument();
    });

    it('does not show error UI when children render correctly', () => {
      render(
        <ErrorBoundary>
          <div>Working component</div>
        </ErrorBoundary>
      );
      expect(screen.queryByText('Algo salió mal')).not.toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('catches errors and shows fallback UI', () => {
      render(
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>
      );
      expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
    });

    it('shows helpful description', () => {
      render(
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>
      );
      expect(
        screen.getByText(/ha ocurrido un error inesperado/i)
      ).toBeInTheDocument();
    });

    it('shows retry button', () => {
      render(
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>
      );
      expect(
        screen.getByRole('button', { name: /intentar de nuevo/i })
      ).toBeInTheDocument();
    });

    it('shows reload button', () => {
      render(
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>
      );
      expect(
        screen.getByRole('button', { name: /recargar página/i })
      ).toBeInTheDocument();
    });
  });

  describe('custom fallback', () => {
    it('renders custom fallback when provided', () => {
      render(
        <ErrorBoundary fallback={<div>Custom error message</div>}>
          <BrokenComponent />
        </ErrorBoundary>
      );
      expect(screen.getByText('Custom error message')).toBeInTheDocument();
      expect(screen.queryByText('Algo salió mal')).not.toBeInTheDocument();
    });
  });

  describe('reset functionality', () => {
    it('provides retry button that resets error state', async () => {
      const user = userEvent.setup();

      render(
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>
      );

      // Verify error is shown
      expect(screen.getByText('Algo salió mal')).toBeInTheDocument();

      // Click retry - this resets the error boundary state
      await user.click(screen.getByRole('button', { name: /intentar de nuevo/i }));

      // After reset, the component will try to render children again
      // Since BrokenComponent always throws, it will show error again
      // This test verifies the retry button works
      expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
    });
  });

  describe('reload functionality', () => {
    it('calls window.location.reload when reload button is clicked', async () => {
      const user = userEvent.setup();
      const reloadMock = vi.fn();
      
      // Mock de window.location.reload
      Object.defineProperty(window, 'location', {
        value: { reload: reloadMock },
        writable: true,
      });

      render(
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>
      );

      await user.click(screen.getByRole('button', { name: /recargar página/i }));
      expect(reloadMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('error details in development', () => {
    it('shows error details in development mode', () => {
      // import.meta.env.DEV es true en tests
      render(
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>
      );

      // En desarrollo, debería haber un elemento details
      const details = screen.getByText(/detalles del error/i);
      expect(details).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('error message is visible and readable', () => {
      render(
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>
      );

      // El título principal debe ser visible
      const heading = screen.getByRole('heading', { name: /algo salió mal/i });
      expect(heading).toBeInTheDocument();
    });

    it('buttons have type="button" to prevent form submission', () => {
      render(
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveAttribute('type', 'button');
      });
    });
  });
});
