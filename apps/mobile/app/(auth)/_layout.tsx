/**
 * ============================================================================
 * SMART_RETAIL - Auth Layout
 * ============================================================================
 * Layout para pantallas de autenticación (login, registro, etc.)
 * ============================================================================
 */

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: {
          backgroundColor: '#1E3A5F', // Primary color
        },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
