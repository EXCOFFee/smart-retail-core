/**
 * ============================================================================
 * SMART_RETAIL Admin Web - Card Component Tests
 * ============================================================================
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './Card';

describe('Card', () => {
  describe('base rendering', () => {
    it('renders children correctly', () => {
      render(<Card>Card Content</Card>);
      expect(screen.getByText('Card Content')).toBeInTheDocument();
    });

    it('renders as a div element', () => {
      render(<Card data-testid="card">Content</Card>);
      expect(screen.getByTestId('card').tagName).toBe('DIV');
    });
  });

  describe('variants', () => {
    it('renders default variant', () => {
      render(<Card data-testid="card">Default</Card>);
      const card = screen.getByTestId('card');
      expect(card.className).toContain('shadow-(--shadow-sm)');
      expect(card.className).toContain('border');
    });

    it('renders outlined variant', () => {
      render(<Card variant="outlined" data-testid="card">Outlined</Card>);
      const card = screen.getByTestId('card');
      expect(card.className).toContain('border');
      expect(card.className).not.toContain('shadow-(--shadow-sm)');
    });

    it('renders elevated variant', () => {
      render(<Card variant="elevated" data-testid="card">Elevated</Card>);
      const card = screen.getByTestId('card');
      expect(card.className).toContain('shadow-(--shadow-lg)');
    });
  });

  describe('padding', () => {
    it('applies medium padding by default', () => {
      render(<Card data-testid="card">Content</Card>);
      expect(screen.getByTestId('card').className).toContain('p-6');
    });

    it('applies no padding when padding="none"', () => {
      render(<Card padding="none" data-testid="card">Content</Card>);
      const card = screen.getByTestId('card');
      expect(card.className).not.toContain('p-4');
      expect(card.className).not.toContain('p-6');
      expect(card.className).not.toContain('p-8');
    });

    it('applies small padding', () => {
      render(<Card padding="sm" data-testid="card">Content</Card>);
      expect(screen.getByTestId('card').className).toContain('p-4');
    });

    it('applies large padding', () => {
      render(<Card padding="lg" data-testid="card">Content</Card>);
      expect(screen.getByTestId('card').className).toContain('p-8');
    });
  });

  describe('accessibility', () => {
    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(<Card ref={ref}>Card</Card>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it('supports custom className', () => {
      render(<Card className="custom-card" data-testid="card">Content</Card>);
      expect(screen.getByTestId('card').className).toContain('custom-card');
    });
  });
});

describe('Card subcomponents', () => {
  describe('CardHeader', () => {
    it('renders children', () => {
      render(<CardHeader>Header Content</CardHeader>);
      expect(screen.getByText('Header Content')).toBeInTheDocument();
    });

    it('renders with action', () => {
      render(
        <CardHeader action={<button>Action</button>}>
          Header
        </CardHeader>
      );
      expect(screen.getByText('Header')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(<CardHeader ref={ref}>Header</CardHeader>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('CardTitle', () => {
    it('renders as h3', () => {
      render(<CardTitle>Title</CardTitle>);
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Title');
    });

    it('applies title styles', () => {
      render(<CardTitle data-testid="title">Title</CardTitle>);
      const title = screen.getByTestId('title');
      expect(title.className).toContain('font-semibold');
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(<CardTitle ref={ref}>Title</CardTitle>);
      expect(ref.current).toBeInstanceOf(HTMLHeadingElement);
    });
  });

  describe('CardDescription', () => {
    it('renders as paragraph', () => {
      render(<CardDescription>Description text</CardDescription>);
      expect(screen.getByText('Description text').tagName).toBe('P');
    });

    it('applies description styles', () => {
      render(<CardDescription data-testid="desc">Desc</CardDescription>);
      const desc = screen.getByTestId('desc');
      expect(desc.className).toContain('text-sm');
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(<CardDescription ref={ref}>Desc</CardDescription>);
      expect(ref.current).toBeInstanceOf(HTMLParagraphElement);
    });
  });

  describe('CardContent', () => {
    it('renders children', () => {
      render(<CardContent>Main content</CardContent>);
      expect(screen.getByText('Main content')).toBeInTheDocument();
    });

    it('applies margin top', () => {
      render(<CardContent data-testid="content">Content</CardContent>);
      expect(screen.getByTestId('content').className).toContain('mt-4');
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(<CardContent ref={ref}>Content</CardContent>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('CardFooter', () => {
    it('renders children', () => {
      render(<CardFooter>Footer content</CardFooter>);
      expect(screen.getByText('Footer content')).toBeInTheDocument();
    });

    it('applies border and flex styles', () => {
      render(<CardFooter data-testid="footer">Footer</CardFooter>);
      const footer = screen.getByTestId('footer');
      expect(footer.className).toContain('border-t');
      expect(footer.className).toContain('flex');
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(<CardFooter ref={ref}>Footer</CardFooter>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });
});

describe('Card compound pattern', () => {
  it('renders complete card with all subcomponents', () => {
    render(
      <Card>
        <Card.Header action={<button>Edit</button>}>
          <Card.Title>Card Title</Card.Title>
          <Card.Description>Card description text</Card.Description>
        </Card.Header>
        <Card.Content>
          <p>Main content here</p>
        </Card.Content>
        <Card.Footer>
          <button>Cancel</button>
          <button>Save</button>
        </Card.Footer>
      </Card>
    );

    expect(screen.getByRole('heading', { name: 'Card Title' })).toBeInTheDocument();
    expect(screen.getByText('Card description text')).toBeInTheDocument();
    expect(screen.getByText('Main content here')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });
});
