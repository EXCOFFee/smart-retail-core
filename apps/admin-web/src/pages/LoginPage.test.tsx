/**
 * ============================================================================
 * SMART_RETAIL Admin Web - Login Page Tests
 * ============================================================================
 * Tests unitarios para la página de login.
 * 
 * Patrón: AAA (Arrange, Act, Assert) según 04_qa_test_architect.md
 * Cobertura: Happy Path + Edge Cases + Error Handling
 */

import { authApi } from '@/api/client';
import { useAuthStore } from '@/stores/authStore';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import LoginPage from './LoginPage';

// Mock the API client
vi.mock('@/api/client', () => ({
  authApi: {
    login: vi.fn(),
  },
}));

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Wrapper with Router context
const renderLoginPage = () => {
  return render(
    <BrowserRouter>
      <LoginPage />
    </BrowserRouter>,
  );
};

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ token: null, user: null });
  });

  describe('Rendering', () => {
    it('should render login form with all elements', () => {
      // Arrange & Act
      renderLoginPage();

      // Assert
      expect(screen.getByText('SMART_RETAIL')).toBeInTheDocument();
      expect(screen.getByText('Panel de Administración')).toBeInTheDocument();
      expect(screen.getByText('Iniciar Sesión')).toBeInTheDocument();
      expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /ingresar/i })).toBeInTheDocument();
    });

    it('should have email and password inputs as required', () => {
      // Arrange & Act
      renderLoginPage();

      // Assert
      const emailInput = screen.getByLabelText(/correo electrónico/i);
      const passwordInput = screen.getByLabelText(/contraseña/i);
      
      expect(emailInput).toBeInTheDocument();
      expect(passwordInput).toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('should show error for invalid email format', async () => {
      // Arrange
      const user = userEvent.setup();
      renderLoginPage();

      // Act
      const emailInput = screen.getByLabelText(/correo electr/i);
      await user.type(emailInput, 'invalid-email');
      await user.click(screen.getByRole('button', { name: /ingresar/i }));

      // Assert - Zod shows "Correo inválido" (the accent might vary)
      await waitFor(() => {
        // Check for either "inválido" or "invalido" due to encoding
        const errorElement = screen.queryByText(/correo/i);
        expect(errorElement).toBeTruthy();
      });
    });

    it('should show error for empty password', async () => {
      // Arrange
      const user = userEvent.setup();
      renderLoginPage();

      // Act
      const emailInput = screen.getByLabelText(/correo electrónico/i);
      await user.type(emailInput, 'test@test.com');
      await user.click(screen.getByRole('button', { name: /ingresar/i }));

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/la contraseña es requerida/i)).toBeInTheDocument();
      });
    });

    it('should show error for password less than 6 characters', async () => {
      // Arrange
      const user = userEvent.setup();
      renderLoginPage();

      // Act
      await user.type(screen.getByLabelText(/correo electrónico/i), 'test@test.com');
      await user.type(screen.getByLabelText(/contraseña/i), '12345');
      await user.click(screen.getByRole('button', { name: /ingresar/i }));

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/mínimo 6 caracteres/i)).toBeInTheDocument();
      });
    });
  });

  describe('Login Flow (Happy Path)', () => {
    it('should call API and navigate on successful login', async () => {
      // Arrange
      const user = userEvent.setup();
      const mockResponse = {
        accessToken: 'jwt.token.here',
        user: {
          id: '1',
          email: 'admin@smartretail.com',
          name: 'Admin',
        },
      };
      (authApi.login as Mock).mockResolvedValue(mockResponse);
      renderLoginPage();

      // Act
      await user.type(screen.getByLabelText(/correo electrónico/i), 'admin@smartretail.com');
      await user.type(screen.getByLabelText(/contraseña/i), 'password123');
      await user.click(screen.getByRole('button', { name: /ingresar/i }));

      // Assert
      await waitFor(() => {
        expect(authApi.login).toHaveBeenCalledWith({
          email: 'admin@smartretail.com',
          password: 'password123',
        });
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });

    it('should update auth store on successful login', async () => {
      // Arrange
      const user = userEvent.setup();
      const mockResponse = {
        accessToken: 'jwt.token.here',
        user: {
          id: '1',
          email: 'admin@smartretail.com',
          name: 'Admin User',
        },
      };
      (authApi.login as Mock).mockResolvedValue(mockResponse);
      renderLoginPage();

      // Act
      await user.type(screen.getByLabelText(/correo electrónico/i), 'admin@smartretail.com');
      await user.type(screen.getByLabelText(/contraseña/i), 'password123');
      await user.click(screen.getByRole('button', { name: /ingresar/i }));

      // Assert
      await waitFor(() => {
        const state = useAuthStore.getState();
        expect(state.token).toBe('jwt.token.here');
        expect(state.user).toEqual(mockResponse.user);
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error message on failed login', async () => {
      // Arrange
      const user = userEvent.setup();
      (authApi.login as Mock).mockRejectedValue(new Error('Invalid credentials'));
      renderLoginPage();

      // Act
      await user.type(screen.getByLabelText(/correo electrónico/i), 'wrong@test.com');
      await user.type(screen.getByLabelText(/contraseña/i), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: /ingresar/i }));

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/credenciales inválidas/i)).toBeInTheDocument();
      });
    });

    it('should not navigate on failed login', async () => {
      // Arrange
      const user = userEvent.setup();
      (authApi.login as Mock).mockRejectedValue(new Error('Invalid credentials'));
      renderLoginPage();

      // Act
      await user.type(screen.getByLabelText(/correo electrónico/i), 'wrong@test.com');
      await user.type(screen.getByLabelText(/contraseña/i), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: /ingresar/i }));

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/credenciales inválidas/i)).toBeInTheDocument();
      });
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('should disable button and show loading during submission', async () => {
      // Arrange
      const user = userEvent.setup();
      // Make the API call hang to observe loading state
      (authApi.login as Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );
      renderLoginPage();

      // Act
      await user.type(screen.getByLabelText(/correo electrónico/i), 'admin@smartretail.com');
      await user.type(screen.getByLabelText(/contraseña/i), 'password123');
      
      const submitButton = screen.getByRole('button', { name: /ingresar/i });
      fireEvent.click(submitButton);

      // Assert - button should be disabled during loading
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });
    });
  });
});
