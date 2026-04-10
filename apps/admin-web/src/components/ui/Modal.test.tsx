/**
 * ============================================================================
 * SMART_RETAIL Admin Web - Modal Component Tests
 * ============================================================================
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Modal, ModalFooter } from './Modal';

describe('Modal', () => {
  describe('rendering', () => {
    it('does not render when isOpen is false', () => {
      render(
        <Modal isOpen={false} onClose={vi.fn()}>
          Content
        </Modal>
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders when isOpen is true', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('renders children', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Modal Content
        </Modal>
      );
      expect(screen.getByText('Modal Content')).toBeInTheDocument();
    });

    it('renders title when provided', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Modal Title">
          Content
        </Modal>
      );
      expect(screen.getByText('Modal Title')).toBeInTheDocument();
    });

    it('renders description when provided', () => {
      render(
        <Modal
          isOpen={true}
          onClose={vi.fn()}
          title="Title"
          description="Modal description"
        >
          Content
        </Modal>
      );
      expect(screen.getByText('Modal description')).toBeInTheDocument();
    });
  });

  describe('close button', () => {
    it('renders close button by default', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>
      );
      expect(screen.getByLabelText('Cerrar')).toBeInTheDocument();
    });

    it('hides close button when showCloseButton is false', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} showCloseButton={false}>
          Content
        </Modal>
      );
      expect(screen.queryByLabelText('Cerrar')).not.toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose}>
          Content
        </Modal>
      );

      await user.click(screen.getByLabelText('Cerrar'));
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('backdrop', () => {
    it('calls onClose when backdrop is clicked', async () => {
      const user = userEvent.setup();
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose}>
          Content
        </Modal>
      );

      // El backdrop tiene aria-hidden="true"
      const backdrop = document.querySelector('[aria-hidden="true"]');
      if (backdrop) {
        await user.click(backdrop);
        expect(handleClose).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('keyboard interactions', () => {
    it('closes on Escape key', async () => {
      const user = userEvent.setup();
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose}>
          Content
        </Modal>
      );

      await user.keyboard('{Escape}');
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('sizes', () => {
    it('renders medium size by default', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} data-testid="modal">
          Content
        </Modal>
      );
      const modal = screen.getByTestId('modal');
      expect(modal.className).toContain('max-w-lg');
    });

    it('renders small size', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} size="sm" data-testid="modal">
          Content
        </Modal>
      );
      expect(screen.getByTestId('modal').className).toContain('max-w-md');
    });

    it('renders large size', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} size="lg" data-testid="modal">
          Content
        </Modal>
      );
      expect(screen.getByTestId('modal').className).toContain('max-w-2xl');
    });

    it('renders extra large size', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} size="xl" data-testid="modal">
          Content
        </Modal>
      );
      expect(screen.getByTestId('modal').className).toContain('max-w-4xl');
    });
  });

  describe('accessibility', () => {
    it('has role="dialog"', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has aria-modal="true"', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>
      );
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('has aria-labelledby when title is provided', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Modal Title">
          Content
        </Modal>
      );
      expect(screen.getByRole('dialog')).toHaveAttribute(
        'aria-labelledby',
        'modal-title'
      );
    });

    it('has aria-describedby when description is provided', () => {
      render(
        <Modal
          isOpen={true}
          onClose={vi.fn()}
          title="Title"
          description="Description"
        >
          Content
        </Modal>
      );
      expect(screen.getByRole('dialog')).toHaveAttribute(
        'aria-describedby',
        'modal-description'
      );
    });

    it('locks body scroll when open', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>
      );
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores body scroll when closed', () => {
      const { rerender } = render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>
      );

      rerender(
        <Modal isOpen={false} onClose={vi.fn()}>
          Content
        </Modal>
      );

      expect(document.body.style.overflow).toBe('');
    });
  });
});

describe('ModalFooter', () => {
  it('renders children', () => {
    render(
      <ModalFooter>
        <button>Cancel</button>
        <button>Confirm</button>
      </ModalFooter>
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });

  it('applies flex and border styles', () => {
    render(<ModalFooter data-testid="footer">Footer</ModalFooter>);
    const footer = screen.getByTestId('footer');
    expect(footer.className).toContain('flex');
    expect(footer.className).toContain('border-t');
  });

  it('forwards ref correctly', () => {
    const ref = { current: null };
    render(<ModalFooter ref={ref}>Footer</ModalFooter>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('supports custom className', () => {
    render(
      <ModalFooter className="custom-footer" data-testid="footer">
        Footer
      </ModalFooter>
    );
    expect(screen.getByTestId('footer').className).toContain('custom-footer');
  });
});
