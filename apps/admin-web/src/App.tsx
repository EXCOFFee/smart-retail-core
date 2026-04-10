/**
 * ============================================================================
 * SMART_RETAIL Admin Web - App Component
 * ============================================================================
 * Componente principal que maneja el routing y layout.
 */

import Layout from '@/components/Layout';
import DashboardPage from '@/pages/DashboardPage';
import DevicesPage from '@/pages/DevicesPage';
import LoginPage from '@/pages/LoginPage';
import ProductsPage from '@/pages/ProductsPage';
import TransactionsPage from '@/pages/TransactionsPage';
import { useAuthStore } from '@/stores/authStore';
import { Navigate, Route, Routes } from 'react-router-dom';

/**
 * Componente de ruta protegida.
 * Redirige a login si no hay token.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((state) => state.token);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Ruta pública */}
      <Route path="/login" element={<LoginPage />} />

      {/* Rutas protegidas */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
