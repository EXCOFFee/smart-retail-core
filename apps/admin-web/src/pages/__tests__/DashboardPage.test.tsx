/**
 * ============================================================================
 * SMART_RETAIL Admin-Web - DashboardPage Tests
 * ============================================================================
 * Tests unitarios para la página principal del dashboard.
 * 
 * Patrón: AAA (Arrange, Act, Assert) según 04_qa_test_architect.md
 * ============================================================================
 */

import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import DashboardPage from '@/pages/DashboardPage';
import { renderWithProviders } from '@/test/utils';

// ─────────────────────────────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('@/api/client', () => ({
  devicesApi: {
    list: vi.fn(),
  },
  transactionsApi: {
    list: vi.fn(),
  },
  productsApi: {
    list: vi.fn(),
  },
}));

import { devicesApi, productsApi, transactionsApi } from '@/api/client';

const mockDevicesApi = devicesApi as unknown as { list: ReturnType<typeof vi.fn> };
const mockTransactionsApi = transactionsApi as unknown as { list: ReturnType<typeof vi.fn> };
const mockProductsApi = productsApi as unknown as { list: ReturnType<typeof vi.fn> };

// ─────────────────────────────────────────────────────────────────────────────
// TEST DATA
// ─────────────────────────────────────────────────────────────────────────────

const mockDevices = [
  {
    id: 'dev-1',
    name: 'Terminal A',
    serialNumber: 'SN-001',
    status: 'ONLINE',
    locationId: 'loc-1',
  },
  {
    id: 'dev-2',
    name: 'Terminal B',
    serialNumber: 'SN-002',
    status: 'OFFLINE',
    locationId: 'loc-1',
  },
];

const mockTransactions = [
  {
    id: 'tx-1',
    status: 'PAID',
    amountCents: 5000,
  },
  {
    id: 'tx-2',
    status: 'PAID',
    amountCents: 3000,
  },
  {
    id: 'tx-3',
    status: 'PENDING',
    amountCents: 2000,
  },
];

const mockProducts = [
  {
    id: 'prod-1',
    name: 'Producto 1',
    sku: 'SKU-001',
    stockQuantity: 10,
    priceCents: 1000,
  },
  {
    id: 'prod-2',
    name: 'Producto 2',
    sku: 'SKU-002',
    stockQuantity: 2, // Low stock
    priceCents: 2000,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    mockDevicesApi.list.mockResolvedValue({ devices: mockDevices });
    mockTransactionsApi.list.mockResolvedValue({ transactions: mockTransactions });
    mockProductsApi.list.mockResolvedValue({ products: mockProducts });
  });

  describe('Rendering', () => {
    it('should render dashboard title', async () => {
      // Act
      renderWithProviders(<DashboardPage />);

      // Assert - wait for loading to finish
      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      });
      expect(screen.getByText('Resumen general del sistema')).toBeInTheDocument();
    });

    it('should render all stat cards', async () => {
      // Act
      renderWithProviders(<DashboardPage />);

      // Assert - wait for data to load
      await waitFor(() => {
        expect(screen.getByText('Dispositivos Online')).toBeInTheDocument();
        expect(screen.getByText('Productos Activos')).toBeInTheDocument();
        expect(screen.getByText('Transacciones')).toBeInTheDocument();
        expect(screen.getByText('Ingresos del Día')).toBeInTheDocument();
      });
    });
  });

  describe('Device Stats', () => {
    it('should display online device count', async () => {
      // Act
      renderWithProviders(<DashboardPage />);

      // Assert
      await waitFor(() => {
        // 1 device is online in mock data
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });

    it('should display offline device count in subtitle', async () => {
      // Act
      renderWithProviders(<DashboardPage />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('1 offline')).toBeInTheDocument();
      });
    });
  });

  describe('Product Stats', () => {
    it('should display total product count', async () => {
      // Act
      renderWithProviders(<DashboardPage />);

      // Assert
      await waitFor(() => {
        // 2 products in mock data
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });

    it('should display low stock count', async () => {
      // Act
      renderWithProviders(<DashboardPage />);

      // Assert - 1 product has stock < 5
      await waitFor(() => {
        expect(screen.getByText('1 con stock bajo')).toBeInTheDocument();
      });
    });
  });

  describe('Transaction Stats', () => {
    it('should display transaction count', async () => {
      // Act
      renderWithProviders(<DashboardPage />);

      // Assert
      await waitFor(() => {
        // 3 transactions in mock data
        expect(screen.getByText('3')).toBeInTheDocument();
      });
    });

    it('should display completed transactions count', async () => {
      // Act
      renderWithProviders(<DashboardPage />);

      // Assert - 2 PAID transactions
      await waitFor(() => {
        expect(screen.getByText('2 completadas')).toBeInTheDocument();
      });
    });
  });

  describe('Revenue Stats', () => {
    it('should display total revenue from paid transactions', async () => {
      // Act
      renderWithProviders(<DashboardPage />);

      // Assert - 5000 + 3000 = 8000 cents = 80 ARS (format varies by locale)
      await waitFor(() => {
        expect(screen.getByText(/80/)).toBeInTheDocument();
      });
    });
  });

  describe('Device Status Section', () => {
    it('should display device list', async () => {
      // Act
      renderWithProviders(<DashboardPage />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Estado de Dispositivos')).toBeInTheDocument();
        expect(screen.getByText('Terminal A')).toBeInTheDocument();
        expect(screen.getByText('Terminal B')).toBeInTheDocument();
      });
    });

    it('should show status badges for devices', async () => {
      // Act
      renderWithProviders(<DashboardPage />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('SN-001')).toBeInTheDocument();
        expect(screen.getByText('SN-002')).toBeInTheDocument();
      });
    });

    it('should show empty state when no devices', async () => {
      // Arrange
      mockDevicesApi.list.mockResolvedValue({ devices: [] });

      // Act
      renderWithProviders(<DashboardPage />);

      // Assert
      await waitFor(() => {
        expect(
          screen.getByText('No hay dispositivos registrados'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Low Stock Alerts', () => {
    it('should display alerts section', async () => {
      // Act
      renderWithProviders(<DashboardPage />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Alertas Recientes')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      // Arrange - API fails
      mockDevicesApi.list.mockRejectedValue(new Error('API Error'));
      mockTransactionsApi.list.mockRejectedValue(new Error('API Error'));
      mockProductsApi.list.mockRejectedValue(new Error('API Error'));

      // Act - should not throw
      expect(() => renderWithProviders(<DashboardPage />)).not.toThrow();

      // Assert - page eventually renders (after error handling)
      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      });
    });
  });
});
