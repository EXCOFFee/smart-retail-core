/**
 * ============================================================================
 * SMART_RETAIL - Index (Entry Point)
 * ============================================================================
 * Punto de entrada que redirige según el estado de autenticación.
 * ============================================================================
 */

import { Redirect } from 'expo-router';

import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAuth } from '@/providers/AuthProvider';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();

  // Mientras carga el estado de auth, mostrar loading
  if (isLoading) {
    return <LoadingScreen message="Iniciando SMART_RETAIL..." />;
  }

  // Redirigir según estado de autenticación
  if (isAuthenticated) {
    return <Redirect href="/(app)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
