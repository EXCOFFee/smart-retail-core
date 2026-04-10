/**
 * ============================================================================
 * SMART_RETAIL Admin Web - Table Component Tests
 * ============================================================================
 * Tests unitarios para el componente Table.
 * 
 * Patrón: AAA (Arrange, Act, Assert) según 04_qa_test_architect.md
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { Package } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { ActionButton, ActionsCell, StatusBadge, Table, TableColumn } from './Table';

// Mock data type
interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  status: string;
}

// Sample columns
const sampleColumns: TableColumn<Product>[] = [
  {
    key: 'name',
    header: 'Nombre',
    render: (item) => item.name,
  },
  {
    key: 'sku',
    header: 'SKU',
    render: (item) => item.sku,
  },
  {
    key: 'price',
    header: 'Precio',
    render: (item) => `$${item.price}`,
    align: 'right',
  },
  {
    key: 'status',
    header: 'Estado',
    render: (item) => <StatusBadge status={item.status} variant="success" />,
  },
];

// Sample data
const sampleData: Product[] = [
  { id: '1', name: 'Producto A', sku: 'SKU-001', price: 100, status: 'ACTIVE' },
  { id: '2', name: 'Producto B', sku: 'SKU-002', price: 200, status: 'ACTIVE' },
  { id: '3', name: 'Producto C', sku: 'SKU-003', price: 300, status: 'INACTIVE' },
];

describe('Table', () => {
  describe('Rendering', () => {
    it('should render table headers correctly', () => {
      // Arrange & Act
      render(
        <Table
          data={sampleData}
          columns={sampleColumns}
          getRowKey={(item) => item.id}
        />,
      );

      // Assert
      expect(screen.getByText('Nombre')).toBeInTheDocument();
      expect(screen.getByText('SKU')).toBeInTheDocument();
      expect(screen.getByText('Precio')).toBeInTheDocument();
      expect(screen.getByText('Estado')).toBeInTheDocument();
    });

    it('should render data rows correctly', () => {
      // Arrange & Act
      render(
        <Table
          data={sampleData}
          columns={sampleColumns}
          getRowKey={(item) => item.id}
        />,
      );

      // Assert
      expect(screen.getByText('Producto A')).toBeInTheDocument();
      expect(screen.getByText('SKU-001')).toBeInTheDocument();
      expect(screen.getByText('$100')).toBeInTheDocument();
    });

    it('should render all rows', () => {
      // Arrange & Act
      render(
        <Table
          data={sampleData}
          columns={sampleColumns}
          getRowKey={(item) => item.id}
        />,
      );

      // Assert
      expect(screen.getByText('Producto A')).toBeInTheDocument();
      expect(screen.getByText('Producto B')).toBeInTheDocument();
      expect(screen.getByText('Producto C')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner when isLoading is true', () => {
      // Arrange & Act
      render(
        <Table
          data={[]}
          columns={sampleColumns}
          getRowKey={(item) => item.id}
          isLoading={true}
        />,
      );

      // Assert
      expect(screen.getByText('Cargando...')).toBeInTheDocument();
    });

    it('should not show data when loading', () => {
      // Arrange & Act
      render(
        <Table
          data={sampleData}
          columns={sampleColumns}
          getRowKey={(item) => item.id}
          isLoading={true}
        />,
      );

      // Assert
      expect(screen.queryByText('Producto A')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty message when data is empty', () => {
      // Arrange & Act
      render(
        <Table
          data={[]}
          columns={sampleColumns}
          getRowKey={(item) => item.id}
          emptyMessage="No hay productos"
        />,
      );

      // Assert
      expect(screen.getByText('No hay productos')).toBeInTheDocument();
    });

    it('should show default empty message when not specified', () => {
      // Arrange & Act
      render(
        <Table
          data={[]}
          columns={sampleColumns}
          getRowKey={(item) => item.id}
        />,
      );

      // Assert
      expect(screen.getByText('No hay datos para mostrar')).toBeInTheDocument();
    });

    it('should render empty icon when provided', () => {
      // Arrange & Act
      render(
        <Table
          data={[]}
          columns={sampleColumns}
          getRowKey={(item) => item.id}
          emptyIcon={<Package data-testid="empty-icon" />}
        />,
      );

      // Assert
      expect(screen.getByTestId('empty-icon')).toBeInTheDocument();
    });
  });

  describe('Row Click', () => {
    it('should call onRowClick when row is clicked', () => {
      // Arrange
      const handleRowClick = vi.fn();
      render(
        <Table
          data={sampleData}
          columns={sampleColumns}
          getRowKey={(item) => item.id}
          onRowClick={handleRowClick}
        />,
      );

      // Act
      fireEvent.click(screen.getByText('Producto A').closest('tr')!);

      // Assert
      expect(handleRowClick).toHaveBeenCalledWith(sampleData[0]);
    });

    it('should not throw when onRowClick is not provided', () => {
      // Arrange
      render(
        <Table
          data={sampleData}
          columns={sampleColumns}
          getRowKey={(item) => item.id}
        />,
      );

      // Act & Assert - should not throw
      expect(() => {
        fireEvent.click(screen.getByText('Producto A').closest('tr')!);
      }).not.toThrow();
    });
  });

  describe('Styling Options', () => {
    it('should apply custom className', () => {
      // Arrange & Act
      const { container } = render(
        <Table
          data={sampleData}
          columns={sampleColumns}
          getRowKey={(item) => item.id}
          className="custom-class"
        />,
      );

      // Assert
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});

describe('StatusBadge', () => {
  it('should render status text', () => {
    // Arrange & Act
    render(<StatusBadge status="ACTIVE" />);

    // Assert
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it.each(['success', 'warning', 'error', 'info', 'default'] as const)(
    'should render with %s variant',
    (variant) => {
      // Arrange & Act
      render(<StatusBadge status="TEST" variant={variant} />);

      // Assert
      expect(screen.getByText('TEST')).toBeInTheDocument();
    },
  );
});

describe('ActionsCell', () => {
  it('should render children', () => {
    // Arrange & Act
    render(
      <ActionsCell>
        <button>Action 1</button>
        <button>Action 2</button>
      </ActionsCell>,
    );

    // Assert
    expect(screen.getByText('Action 1')).toBeInTheDocument();
    expect(screen.getByText('Action 2')).toBeInTheDocument();
  });
});

describe('ActionButton', () => {
  it('should render with icon and label', () => {
    // Arrange
    const handleClick = vi.fn();

    // Act
    render(
      <ActionButton
        onClick={handleClick}
        icon={<span data-testid="icon">🔧</span>}
        label="Edit"
      />,
    );

    // Assert
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Edit');
  });

  it('should call onClick when clicked', () => {
    // Arrange
    const handleClick = vi.fn();
    render(
      <ActionButton
        onClick={handleClick}
        icon={<span>🔧</span>}
        label="Edit"
      />,
    );

    // Act
    fireEvent.click(screen.getByRole('button'));

    // Assert
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should stop propagation on click', () => {
    // Arrange
    const handleClick = vi.fn();
    const handleRowClick = vi.fn();
    render(
      <div onClick={handleRowClick}>
        <ActionButton
          onClick={handleClick}
          icon={<span>🔧</span>}
          label="Edit"
        />
      </div>,
    );

    // Act
    fireEvent.click(screen.getByRole('button'));

    // Assert
    expect(handleClick).toHaveBeenCalled();
    expect(handleRowClick).not.toHaveBeenCalled();
  });
});
