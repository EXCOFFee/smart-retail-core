/**
 * ============================================================================
 * SMART_RETAIL - Root Layout (Expo Router)
 * ============================================================================
 * Layout principal de la aplicación móvil.
 * 
 * ARQUITECTURA:
 * - Expo Router para navegación file-based
 * - Providers globales (Auth, Query, Theme)
 * - Splash screen control
 * - Fallback a fuentes del sistema si Inter no está disponible
 * ============================================================================
 */

import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { AuthProvider } from '@/providers/AuthProvider';
import { NetworkProvider } from '@/providers/NetworkProvider';

// Prevenir que el splash screen se oculte automáticamente
SplashScreen.preventAutoHideAsync();

// ─────────────────────────────────────────────────────────────────────────────
// FONT CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

interface FontContextValue {
  /** True si estamos usando fuentes del sistema en lugar de Inter */
  useSystemFonts: boolean;
  /** True si las fuentes están cargadas */
  fontsReady: boolean;
}

const FontContext = createContext<FontContextValue>({
  useSystemFonts: false,
  fontsReady: false,
});

/**
 * Hook para acceder al estado de fuentes.
 * Útil para componentes que necesitan ajustar estilos según la fuente.
 */
export function useFontContext(): FontContextValue {
  return useContext(FontContext);
}

// ─────────────────────────────────────────────────────────────────────────────
// REACT QUERY CLIENT
// ─────────────────────────────────────────────────────────────────────────────

// Cliente de React Query con configuración optimizada
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry con backoff exponencial
      retry: 2,
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 10000),
      // Stale time para reducir requests
      staleTime: 1000 * 60 * 5, // 5 minutos
      // Garbage collection
      gcTime: 1000 * 60 * 10, // 10 minutos
    },
    mutations: {
      retry: 1,
    },
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ROOT LAYOUT
// ─────────────────────────────────────────────────────────────────────────────

export default function RootLayout() {
  const colorScheme = useColorScheme();
  
  // Estado para controlar si usamos fuentes personalizadas o del sistema
  const [useSystemFonts, setUseSystemFonts] = useState(false);

  /**
   * Intentamos cargar fuentes personalizadas (Inter).
   * Si fallan (archivo no encontrado), usaremos fuentes del sistema.
   * 
   * NOTA: Para habilitar Inter, descarga las fuentes de Google Fonts
   * y colócalas en assets/fonts/
   */
  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-Medium': require('../assets/fonts/Inter-Medium.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
    'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),
  });

  // Determinar si usar fuentes del sistema como fallback
  useEffect(() => {
    if (fontError) {
      // Silently fallback to system fonts if custom fonts fail
      setUseSystemFonts(true);
    }
  }, [fontError]);

  // Ocultar splash screen cuando todo esté listo
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Memoizar el valor del contexto de fuentes
  const fontContextValue = useMemo<FontContextValue>(() => ({
    useSystemFonts,
    fontsReady: fontsLoaded || fontError !== null,
  }), [useSystemFonts, fontsLoaded, fontError]);

  // Mientras cargan las fuentes, no renderizar nada
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <FontContext.Provider value={fontContextValue}>
      <QueryClientProvider client={queryClient}>
        <NetworkProvider>
          <AuthProvider>
            <ThemeProvider
              value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
            >
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: 'slide_from_right',
                  gestureEnabled: true,
                }}
              >
                {/* Auth flow */}
                <Stack.Screen
                  name="(auth)"
                  options={{
                    animation: 'fade',
                  }}
                />

                {/* Main app */}
                <Stack.Screen
                  name="(app)"
                  options={{
                    animation: 'fade',
                  }}
                />

                {/* Modal screens */}
                <Stack.Screen
                  name="modal"
                  options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                  }}
                />
              </Stack>
              <StatusBar style="auto" />
            </ThemeProvider>
          </AuthProvider>
        </NetworkProvider>
      </QueryClientProvider>
    </FontContext.Provider>
  );
}
