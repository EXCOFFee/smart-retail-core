/**
 * ============================================================================
 * SMART_RETAIL Admin Web - Badge Component Tests
 * ============================================================================
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';

describe('Badge', () => {
  describe('rendering', () => {
    it('renders children correctly', () => {
      render(<Badge>Active</Badge>);
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('renders as a span element', () => {
      render(<Badge>Status</Badge>);
      expect(screen.getByText('Status').tagName).toBe('SPAN');
    });
  });

  describe('variants', () => {
    it('renders default variant', () => {
      render(<Badge variant="default">Default</Badge>);
      const badge = screen.getByText('Default');
      expect(badge.className).toContain('bg-(--color-background-subtle)');
    });

    it('renders success variant', () => {
      render(<Badge variant="success">Success</Badge>);
      const badge = screen.getByText('Success');
      expect(badge.className).toContain('bg-(--color-success-light)');
    });

    it('renders warning variant', () => {
      render(<Badge variant="warning">Warning</Badge>);
      const badge = screen.getByText('Warning');
      expect(badge.className).toContain('bg-(--color-warning-light)');
    });

    it('renders error variant', () => {
      render(<Badge variant="error">Error</Badge>);
      const badge = screen.getByText('Error');
      expect(badge.className).toContain('bg-(--color-error-light)');
    });

    it('renders info variant', () => {
      render(<Badge variant="info">Info</Badge>);
      const badge = screen.getByText('Info');
      expect(badge.className).toContain('bg-(--color-info-light)');
    });
  });

  describe('sizes', () => {
    it('renders small size by default', () => {
      render(<Badge>Small</Badge>);
      const badge = screen.getByText('Small');
      expect(badge.className).toContain('text-xs');
    });

    it('renders medium size', () => {
      render(<Badge size="md">Medium</Badge>);
      const badge = screen.getByText('Medium');
      expect(badge.className).toContain('text-sm');
    });
  });

  describe('dot indicator', () => {
    it('does not render dot by default', () => {
      render(<Badge>No Dot</Badge>);
      const badge = screen.getByText('No Dot');
      // Should not have a dot sibling
      expect(badge.querySelector('[aria-hidden="true"]')).toBeNull();
    });

    it('renders dot when dot prop is true', () => {
      render(<Badge dot>With Dot</Badge>);
      const badge = screen.getByText('With Dot').closest('span');
      expect(badge?.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    });

    it('dot is hidden from screen readers', () => {
      render(<Badge dot>Accessible</Badge>);
      const badge = screen.getByText('Accessible').closest('span');
      const dot = badge?.querySelector('[aria-hidden="true"]');
      expect(dot).toHaveAttribute('aria-hidden', 'true');
    });

    it('dot color matches variant', () => {
      render(<Badge dot variant="success">Success Dot</Badge>);
      const badge = screen.getByText('Success Dot').closest('span');
      const dot = badge?.querySelector('[aria-hidden="true"]');
      expect(dot?.className).toContain('bg-(--color-success)');
    });
  });

  describe('accessibility', () => {
    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(<Badge ref={ref}>Ref Badge</Badge>);
      expect(ref.current).toBeInstanceOf(HTMLSpanElement);
    });

    it('supports custom className', () => {
      render(<Badge className="custom-badge">Custom</Badge>);
      expect(screen.getByText('Custom').className).toContain('custom-badge');
    });

    it('spreads additional props', () => {
      render(<Badge data-testid="test-badge">Props</Badge>);
      expect(screen.getByTestId('test-badge')).toBeInTheDocument();
    });

    it('supports role attribute', () => {
      render(<Badge role="status">Status Badge</Badge>);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });
});
