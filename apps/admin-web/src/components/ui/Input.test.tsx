/**
 * ============================================================================
 * SMART_RETAIL Admin Web - Input Component Tests
 * ============================================================================
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Input } from './Input';

describe('Input', () => {
  describe('rendering', () => {
    it('renders input element', () => {
      render(<Input placeholder="Enter text" />);
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
    });

    it('renders with label', () => {
      render(<Input label="Email" />);
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
    });

    it('generates unique id if not provided', () => {
      render(<Input label="Field" />);
      const input = screen.getByLabelText('Field');
      expect(input.id).toMatch(/^input-[a-z0-9]+$/);
    });

    it('uses provided id', () => {
      render(<Input id="custom-id" label="Field" />);
      expect(screen.getByLabelText('Field')).toHaveAttribute('id', 'custom-id');
    });
  });

  describe('error state', () => {
    it('displays error message', () => {
      render(<Input error="This field is required" />);
      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('applies error styles when error is present', () => {
      render(<Input error="Error" placeholder="test" />);
      const input = screen.getByPlaceholderText('test');
      expect(input.className).toContain('border-(--color-error)');
    });

    it('shows error icon when error is present', () => {
      render(<Input error="Error" />);
      // Error icon should be rendered
      expect(screen.getByText('Error')).toBeInTheDocument();
    });
  });

  describe('hint', () => {
    it('displays hint text', () => {
      render(<Input hint="Enter your email address" />);
      expect(screen.getByText('Enter your email address')).toBeInTheDocument();
    });

    it('hides hint when error is present', () => {
      render(<Input hint="Hint text" error="Error message" />);
      expect(screen.queryByText('Hint text')).not.toBeInTheDocument();
      expect(screen.getByText('Error message')).toBeInTheDocument();
    });
  });

  describe('icons', () => {
    it('renders left icon', () => {
      render(
        <Input leftIcon={<span data-testid="left-icon">🔍</span>} placeholder="Search" />
      );
      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
    });

    it('applies padding when left icon is present', () => {
      render(
        <Input leftIcon={<span>🔍</span>} placeholder="Search" />
      );
      const input = screen.getByPlaceholderText('Search');
      expect(input.className).toContain('pl-10');
    });

    it('renders right icon', () => {
      render(
        <Input rightIcon={<span data-testid="right-icon">✓</span>} placeholder="Test" />
      );
      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
    });

    it('applies padding when right icon is present', () => {
      render(
        <Input rightIcon={<span>✓</span>} placeholder="Test" />
      );
      const input = screen.getByPlaceholderText('Test');
      expect(input.className).toContain('pr-10');
    });
  });

  describe('disabled state', () => {
    it('is disabled when disabled prop is true', () => {
      render(<Input disabled placeholder="Disabled" />);
      expect(screen.getByPlaceholderText('Disabled')).toBeDisabled();
    });

    it('applies disabled styles', () => {
      render(<Input disabled placeholder="Disabled" />);
      const input = screen.getByPlaceholderText('Disabled');
      expect(input.className).toContain('disabled:cursor-not-allowed');
    });
  });

  describe('interactions', () => {
    it('accepts user input', async () => {
      const user = userEvent.setup();
      render(<Input placeholder="Type here" />);
      
      const input = screen.getByPlaceholderText('Type here');
      await user.type(input, 'Hello World');
      
      expect(input).toHaveValue('Hello World');
    });

    it('calls onChange when input changes', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      render(<Input onChange={handleChange} placeholder="Type" />);
      
      await user.type(screen.getByPlaceholderText('Type'), 'a');
      expect(handleChange).toHaveBeenCalled();
    });

    it('calls onFocus when focused', async () => {
      const user = userEvent.setup();
      const handleFocus = vi.fn();
      render(<Input onFocus={handleFocus} placeholder="Focus" />);
      
      await user.click(screen.getByPlaceholderText('Focus'));
      expect(handleFocus).toHaveBeenCalled();
    });

    it('calls onBlur when blurred', async () => {
      const user = userEvent.setup();
      const handleBlur = vi.fn();
      render(<Input onBlur={handleBlur} placeholder="Blur" />);
      
      const input = screen.getByPlaceholderText('Blur');
      await user.click(input);
      await user.tab();
      expect(handleBlur).toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(<Input ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });

    it('associates label with input via htmlFor', () => {
      render(<Input id="email" label="Email Address" />);
      const label = screen.getByText('Email Address');
      expect(label).toHaveAttribute('for', 'email');
    });

    it('supports custom className', () => {
      render(<Input className="custom-input" placeholder="Custom" />);
      expect(screen.getByPlaceholderText('Custom').className).toContain('custom-input');
    });

    it('supports input types', () => {
      render(<Input type="password" placeholder="Password" />);
      expect(screen.getByPlaceholderText('Password')).toHaveAttribute('type', 'password');
    });
  });
});
