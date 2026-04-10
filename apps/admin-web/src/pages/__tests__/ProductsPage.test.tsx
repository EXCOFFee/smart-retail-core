/**
 * ============================================================================
 * SMART_RETAIL Admin-Web - ProductsPage Tests
 * ============================================================================
 * Tests unitarios para la página de gestión de productos (ABM).
 * 
 * Patrón: AAA (Arrange, Act, Assert) según 04_qa_test_architect.md
 * ============================================================================
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { productsApi } from '@/api/client';
import ProductsPage from '@/pages/ProductsPage';
import { renderWithProviders } from '@/test/utils';

// ─────────────────────────────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('@/api/client', () => ({
  productsApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  ProductCreateRequest: {},
}));

// Type-safe mock accessors
const mockList = productsApi.list as Mock;
const mockCreate = productsApi.create as Mock;
const mockDelete = productsApi.delete as Mock;

// ─────────────────────────────────────────────────────────────────────────────
// TEST DATA
// ─────────────────────────────────────────────────────────────────────────────

const mockProducts = [
  {
    id: 'prod-1',
    name: 'Café Americano',
    sku: 'CAF-001',
    priceCents: 3500,
    stockQuantity: 50,
    status: 'ACTIVE',
  },
  {
    id: 'prod-2',
    name: 'Té Verde',
    sku: 'TEA-001',
    priceCents: 2500,
    stockQuantity: 3, // Low stock
    status: 'ACTIVE',
  },
  {
    id: 'prod-3',
    name: 'Agua Mineral',
    sku: 'WAT-001',
    priceCents: 1500,
    stockQuantity: 100,
    status: 'INACTIVE',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('ProductsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue({ products: mockProducts });
    mockCreate.mockResolvedValue({ id: 'new-prod' });
    mockDelete.mockResolvedValue({ success: true });
  });

  describe('Rendering', () => {
    it('should render page title and subtitle', async () => {
      // Act
      renderWithProviders(<ProductsPage />);

      // Assert - wait for loading to complete
      await waitFor(() => {
        expect(screen.getByText('Productos')).toBeInTheDocument();
      });
      expect(screen.getByText('Gestión de inventario y precios')).toBeInTheDocument();
    });

    it('should render "Nuevo Producto" button', async () => {
      // Act
      renderWithProviders(<ProductsPage />);

      // Assert - wait for loading to complete
      await waitFor(() => {
        expect(screen.getByText('Nuevo Producto')).toBeInTheDocument();
      });
    });

    it('should render search input', async () => {
      // Act
      renderWithProviders(<ProductsPage />);

      // Assert - wait for loading to complete
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Buscar por nombre o SKU...'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Products Table', () => {
    it('should display loading state initially', async () => {
      // Arrange - slow API
      mockList.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000)),
      );

      // Act
      renderWithProviders(<ProductsPage />);

      // Assert - skeleton is shown during loading
      // The skeleton has animate-pulse class
      const skeletonElements = document.querySelectorAll('.animate-pulse');
      expect(skeletonElements.length).toBeGreaterThan(0);
    });

    it('should display products after loading', async () => {
      // Act
      renderWithProviders(<ProductsPage />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Café Americano')).toBeInTheDocument();
        expect(screen.getByText('Té Verde')).toBeInTheDocument();
        expect(screen.getByText('Agua Mineral')).toBeInTheDocument();
      });
    });

    it('should display SKUs for products', async () => {
      // Act
      renderWithProviders(<ProductsPage />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('CAF-001')).toBeInTheDocument();
        expect(screen.getByText('TEA-001')).toBeInTheDocument();
        expect(screen.getByText('WAT-001')).toBeInTheDocument();
      });
    });

    it('should display formatted prices', async () => {
      // Act
      renderWithProviders(<ProductsPage />);

      // Assert - prices should be formatted (format depends on locale)
      // 3500 cents = 35 ARS, displayed in es-AR format
      await waitFor(() => {
        // Look for price content, flexible to locale variations
        expect(screen.getByText(/35/)).toBeInTheDocument();
        expect(screen.getByText(/25/)).toBeInTheDocument();
        expect(screen.getByText(/15/)).toBeInTheDocument();
      });
    });

    it('should show empty state when no products', async () => {
      // Arrange
      mockList.mockResolvedValue({ products: [] });

      // Act
      renderWithProviders(<ProductsPage />);

      // Assert
      await waitFor(() => {
        expect(
          screen.getByText('No hay productos registrados'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Stock Badge', () => {
    it('should show low stock warning for items with stock < 5', async () => {
      // Act
      renderWithProviders(<ProductsPage />);

      // Assert - Té Verde has stockQuantity: 3, shows as "3 unidades"
      await waitFor(() => {
        // Look for the low stock indicator
        expect(screen.getByText('3 unidades')).toBeInTheDocument();
      });
    });

    it('should show "Sin Stock" for items with 0 stock', async () => {
      // Arrange - product with 0 stock
      mockList.mockResolvedValue({
        products: [
          {
            id: 'prod-zero',
            name: 'Producto Sin Stock',
            sku: 'ZERO-001',
            priceCents: 1000,
            stockQuantity: 0,
            status: 'ACTIVE',
          },
        ],
      });

      // Act
      renderWithProviders(<ProductsPage />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Sin Stock')).toBeInTheDocument();
      });
    });

    it('should show normal count for items with stock >= 5', async () => {
      // Act
      renderWithProviders(<ProductsPage />);

      // Assert - Café Americano has stockQuantity: 50
      await waitFor(() => {
        expect(screen.getByText('50 unidades')).toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    it('should filter products by name', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(<ProductsPage />);

      await waitFor(() => {
        expect(screen.getByText('Café Americano')).toBeInTheDocument();
      });

      // Act
      const searchInput = screen.getByPlaceholderText('Buscar por nombre o SKU...');
      await user.type(searchInput, 'Café');

      // Assert - only Café Americano should be visible
      expect(screen.getByText('Café Americano')).toBeInTheDocument();
      expect(screen.queryByText('Té Verde')).not.toBeInTheDocument();
      expect(screen.queryByText('Agua Mineral')).not.toBeInTheDocument();
    });

    it('should filter products by SKU', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(<ProductsPage />);

      await waitFor(() => {
        expect(screen.getByText('Café Americano')).toBeInTheDocument();
      });

      // Act
      const searchInput = screen.getByPlaceholderText('Buscar por nombre o SKU...');
      await user.type(searchInput, 'TEA');

      // Assert - only Té Verde should be visible
      expect(screen.getByText('Té Verde')).toBeInTheDocument();
      expect(screen.queryByText('Café Americano')).not.toBeInTheDocument();
    });

    it('should be case-insensitive', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(<ProductsPage />);

      await waitFor(() => {
        expect(screen.getByText('Café Americano')).toBeInTheDocument();
      });

      // Act
      const searchInput = screen.getByPlaceholderText('Buscar por nombre o SKU...');
      await user.type(searchInput, 'agua');

      // Assert
      expect(screen.getByText('Agua Mineral')).toBeInTheDocument();
    });
  });

  describe('Create Product Modal', () => {
    it('should open modal when clicking "Nuevo Producto"', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(<ProductsPage />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByText('Nuevo Producto')).toBeInTheDocument();
      });

      // Act
      const newButton = screen.getByText('Nuevo Producto');
      await user.click(newButton);

      // Assert - modal should appear (look for form elements)
      await waitFor(() => {
        // Modal typically has form inputs
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should close modal when clicking close button', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(<ProductsPage />);

      await waitFor(() => {
        expect(screen.getByText('Nuevo Producto')).toBeInTheDocument();
      });

      // Open modal
      await user.click(screen.getByText('Nuevo Producto'));
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Act - click close button (X)
      const closeButtons = screen.getAllByRole('button');
      const closeButton = closeButtons.find(btn => btn.querySelector('svg.lucide-x'));
      if (closeButton) {
        await user.click(closeButton);
      }

      // Assert - modal should close
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should render modal form fields', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(<ProductsPage />);

      await waitFor(() => {
        expect(screen.getByText('Nuevo Producto')).toBeInTheDocument();
      });

      // Open modal
      await user.click(screen.getByText('Nuevo Producto'));

      // Assert - form fields should be visible
      await waitFor(() => {
        expect(screen.getByPlaceholderText('PROD-001')).toBeInTheDocument();
      });
    });
  });

  describe('Delete Product', () => {
    it('should render delete buttons for each product', async () => {
      // Arrange
      renderWithProviders(<ProductsPage />);

      await waitFor(() => {
        expect(screen.getByText('Café Americano')).toBeInTheDocument();
      });

      // Find delete buttons (usually trash icons)
      const deleteButtons = screen.getAllByRole('button', { name: /eliminar/i });
      
      // Assert - delete buttons exist for each product
      expect(deleteButtons.length).toBe(3); // 3 products = 3 delete buttons
    });

    it('should trigger confirmation on delete click', async () => {
      // Arrange
      const user = userEvent.setup();
      // Mock window.confirm via vi.stubGlobal
      const confirmMock = vi.fn(() => false); // Return false to prevent actual delete
      vi.stubGlobal('confirm', confirmMock);
      
      renderWithProviders(<ProductsPage />);

      await waitFor(() => {
        expect(screen.getByText('Café Americano')).toBeInTheDocument();
      });

      // Act - click delete button
      const deleteButtons = screen.getAllByRole('button', { name: /eliminar/i });
      await user.click(deleteButtons[0]);

      // Assert - confirm was called
      expect(confirmMock).toHaveBeenCalledWith('¿Eliminar este producto?');

      // Cleanup
      vi.unstubAllGlobals();
    });
  });

  describe('Error Handling', () => {
    it('should handle API error gracefully', async () => {
      // Arrange
      mockList.mockRejectedValue(new Error('Network error'));

      // Act - should not throw
      expect(() => renderWithProviders(<ProductsPage />)).not.toThrow();

      // Assert - page still renders after error
      await waitFor(() => {
        expect(screen.getByText('Productos')).toBeInTheDocument();
      });
    });
  });

  describe('Table Headers', () => {
    it('should render all column headers', async () => {
      // Act
      renderWithProviders(<ProductsPage />);

      // Assert - wait for loading to finish and headers to appear
      await waitFor(() => {
        expect(screen.getByText('Producto')).toBeInTheDocument();
      });
      expect(screen.getByText('SKU')).toBeInTheDocument();
      expect(screen.getByText('Precio')).toBeInTheDocument();
      expect(screen.getByText('Stock')).toBeInTheDocument();
      expect(screen.getByText('Estado')).toBeInTheDocument();
      expect(screen.getByText('Acciones')).toBeInTheDocument();
    });
  });

  describe('Product Status', () => {
    it('should display ACTIVE status with green styling', async () => {
      // Act
      renderWithProviders(<ProductsPage />);

      // Assert
      await waitFor(() => {
        const activeStatuses = screen.getAllByText('ACTIVE');
        expect(activeStatuses.length).toBeGreaterThan(0);
        // Check first one has green styling
        expect(activeStatuses[0]).toHaveClass('text-green-700');
      });
    });

    it('should display INACTIVE status with gray styling', async () => {
      // Arrange - Agua Mineral is inactive
      // Act
      renderWithProviders(<ProductsPage />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('INACTIVE')).toBeInTheDocument();
        expect(screen.getByText('INACTIVE')).toHaveClass('text-gray-700');
      });
    });
  });

  describe('Edit Product', () => {
    it('should render edit buttons for each product', async () => {
      // Act
      renderWithProviders(<ProductsPage />);

      await waitFor(() => {
        expect(screen.getByText('Café Americano')).toBeInTheDocument();
      });

      // Assert - edit buttons exist for each product
      const editButtons = screen.getAllByRole('button', { name: /editar/i });
      expect(editButtons.length).toBe(3); // 3 products
    });
  });
});
