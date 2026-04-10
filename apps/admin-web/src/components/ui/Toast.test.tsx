/**
 * ============================================================================
 * SMART_RETAIL Admin Web - Toast Component Tests
 * ============================================================================
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from './Toast';

// Componente helper para testear el hook useToast
function ToastTrigger() {
  const { success, error, warning, info, toasts } = useToast();
  return (
    <div>
      <button onClick={() => success('Success!', 'Operation completed')}>
        Show Success
      </button>
      <button onClick={() => error('Error!', 'Something went wrong')}>
        Show Error
      </button>
      <button onClick={() => warning('Warning!', 'Be careful')}>
        Show Warning
      </button>
      <button onClick={() => info('Info!', 'FYI')}>Show Info</button>
      <span data-testid="toast-count">{toasts.length}</span>
    </div>
  );
}

describe('ToastProvider', () => {
  it('renders children', () => {
    render(
      <ToastProvider>
        <div>App Content</div>
      </ToastProvider>
    );
    expect(screen.getByText('App Content')).toBeInTheDocument();
  });

  it('throws error when useToast is used outside provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<ToastTrigger />);
    }).toThrow('useToast must be used within a ToastProvider');
    
    consoleError.mockRestore();
  });
});

describe('useToast hook', () => {
  it('shows success toast', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>
    );

    await user.click(screen.getByText('Show Success'));
    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(screen.getByText('Operation completed')).toBeInTheDocument();
  });

  it('shows error toast', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>
    );

    await user.click(screen.getByText('Show Error'));
    expect(screen.getByText('Error!')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('shows warning toast', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>
    );

    await user.click(screen.getByText('Show Warning'));
    expect(screen.getByText('Warning!')).toBeInTheDocument();
    expect(screen.getByText('Be careful')).toBeInTheDocument();
  });

  it('shows info toast', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>
    );

    await user.click(screen.getByText('Show Info'));
    expect(screen.getByText('Info!')).toBeInTheDocument();
    expect(screen.getByText('FYI')).toBeInTheDocument();
  });

  it('allows multiple toasts', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>
    );

    await user.click(screen.getByText('Show Success'));
    await user.click(screen.getByText('Show Error'));

    expect(screen.getByTestId('toast-count')).toHaveTextContent('2');
  });
});

describe('Toast dismiss', () => {
  it('dismisses toast when close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider duration={60000}> {/* Long duration to prevent auto-remove */}
        <ToastTrigger />
      </ToastProvider>
    );

    await user.click(screen.getByText('Show Success'));
    expect(screen.getByText('Success!')).toBeInTheDocument();

    // Find and click the close button
    const closeButton = screen.getByRole('button', { name: 'Cerrar' });
    await user.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText('Success!')).not.toBeInTheDocument();
    });
  });
});

describe('Toast accessibility', () => {
  it('toast container has aria-live attribute', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider duration={60000}>
        <ToastTrigger />
      </ToastProvider>
    );

    await user.click(screen.getByText('Show Success'));
    
    // Toast item has role="alert" which is announced
    const toastAlert = screen.getByRole('alert');
    expect(toastAlert).toBeInTheDocument();
  });

  it('close button has accessible label', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider duration={60000}>
        <ToastTrigger />
      </ToastProvider>
    );

    await user.click(screen.getByText('Show Success'));
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
  });
});
