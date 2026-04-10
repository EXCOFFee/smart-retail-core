/**
 * ============================================================================
 * SMART_RETAIL Admin Web - Test Utilities
 * ============================================================================
 * Utilitarios para facilitar el testing de componentes React.
 * ============================================================================
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, RenderOptions } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';

/**
 * Crea un QueryClient para tests.
 * Configura retry: false y gcTime: Infinity para evitar efectos secundarios.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface AllProvidersProps {
  children: ReactNode;
}

/**
 * Wrapper con todos los providers necesarios para tests.
 */
function AllProviders({ children }: AllProvidersProps): ReactElement {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
}

/**
 * Custom render que incluye todos los providers.
 * Uso: renderWithProviders(<MyComponent />)
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

/**
 * Re-exportamos todo de testing-library para conveniencia.
 */
export * from '@testing-library/react';
export { renderWithProviders as render };

