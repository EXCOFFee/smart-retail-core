/**
 * ============================================================================
 * SMART_RETAIL Admin Web - Error Boundary
 * ============================================================================
 * Captura errores en el árbol de componentes React para evitar pantallas blancas.
 * Cumple con 00_Instrucciones §5: "0% Pantallas Blancas"
 * ============================================================================
 */

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary para capturar errores en el árbol de componentes.
 * 
 * Por qué class component: React Error Boundaries solo funcionan con
 * class components y el lifecycle method componentDidCatch.
 * 
 * Uso:
 * ```tsx
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // En producción, enviar a servicio de monitoreo (Sentry, etc.)
    // Por ahora solo guardamos en el estado para mostrar en UI de desarrollo
    if (import.meta.env.DEV) {
      // Solo en desarrollo mostramos el error detallado
      // En producción el usuario ve un mensaje genérico
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Si hay un fallback personalizado, usarlo
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Fallback por defecto: pantalla de error amigable
      return (
        <div className="min-h-screen flex items-center justify-center bg-(--color-background) p-4">
          <div className="max-w-md w-full text-center">
            {/* Icon */}
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-(--color-error-light) mb-6">
              <AlertTriangle className="h-8 w-8 text-(--color-error)" />
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-(--color-text-primary) mb-2">
              Algo salió mal
            </h1>

            {/* Description */}
            <p className="text-(--color-text-secondary) mb-6">
              Ha ocurrido un error inesperado. Puedes intentar recargar la página
              o volver a intentarlo.
            </p>

            {/* Error details (solo en desarrollo) */}
            {import.meta.env.DEV && this.state.error && (
              <details className="mb-6 text-left p-4 bg-(--color-background-subtle) rounded-xl">
                <summary className="cursor-pointer text-sm font-medium text-(--color-text-secondary) mb-2">
                  Detalles del error (solo desarrollo)
                </summary>
                <pre className="text-xs text-(--color-error) overflow-auto max-h-40 p-2 bg-(--color-surface) rounded-lg">
                  {this.state.error.message}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 
                  text-(--color-text-primary) bg-(--color-surface) 
                  border border-(--color-border) rounded-xl
                  hover:bg-(--color-background-subtle) transition-colors"
              >
                Intentar de nuevo
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 
                  text-white bg-(--color-accent) rounded-xl
                  hover:bg-(--color-accent-hover) transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Recargar página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
