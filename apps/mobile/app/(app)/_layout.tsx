/**
 * ============================================================================
 * SMART_RETAIL - App Layout (Authenticated)
 * ============================================================================
 * Layout para pantallas de la aplicación autenticada.
 * Incluye navegación por tabs.
 * ============================================================================
 */

import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';

import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';
import { colors } from '@/theme';
import { View } from 'react-native';

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const { isConnected } = useNetwork();

  // Mientras carga, mostrar loading
  if (isLoading) {
    return <LoadingScreen message="Cargando..." />;
  }

  // Si no está autenticado, redirigir a login
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Banner de offline persistente */}
      {!isConnected && <OfflineBanner />}

      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingBottom: 8,
            paddingTop: 8,
            height: 60,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500',
          },
          headerShown: false,
        }}
      >
        {/* Home / Dashboard */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Inicio',
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
          }}
        />

        {/* QR Scanner - CRITICAL PATH */}
        <Tabs.Screen
          name="scan"
          options={{
            title: 'Escanear',
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <Ionicons name="qr-code-outline" size={size} color={color} />
            ),
            // Destacar el botón de escaneo
            tabBarIconStyle: {
              transform: [{ scale: 1.2 }],
            },
          }}
        />

        {/* Historial de transacciones */}
        <Tabs.Screen
          name="history"
          options={{
            title: 'Historial',
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <Ionicons name="receipt-outline" size={size} color={color} />
            ),
          }}
        />

        {/* Perfil y configuración */}
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
