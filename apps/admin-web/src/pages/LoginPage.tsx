/**
 * ============================================================================
 * SMART_RETAIL Admin Web - Login Page (Rediseñada)
 * ============================================================================
 * Pantalla de autenticación para administradores.
 * Diseño SMART_RETAIL Slate: minimalista, sofisticado, con animaciones sutiles.
 * Usa Zod + @hookform/resolvers para validación (00_Instrucciones §4).
 * ============================================================================
 */

import { authApi } from '@/api/client';
import { Button, Card, Input } from '@/components/ui';
import { LoginFormData, loginSchema } from '@/lib/schemas';
import { useAuthStore } from '@/stores/authStore';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Lock, Mail } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  // Por qué zodResolver: Validación runtime con Zod según 00_Instrucciones §4
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await authApi.login(data);
      login(response.accessToken, response.user);
      navigate('/');
    } catch {
      setError('Credenciales inválidas. Por favor, intente nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-(--color-background) px-4">
      <div className="w-full max-w-md animate-slideUp">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-(--color-primary) mb-4">
            <span className="text-2xl font-bold text-white">S</span>
          </div>
          <h1 className="text-3xl font-bold text-(--color-text-primary)">
            SMART_RETAIL
          </h1>
          <p className="mt-2 text-(--color-text-secondary)">
            Panel de Administración
          </p>
        </div>

        {/* Login Card */}
        <Card variant="elevated" padding="lg">
          <h2 className="text-xl font-semibold text-(--color-text-primary) mb-6">
            Iniciar Sesión
          </h2>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 flex items-center gap-3 p-4 bg-(--color-error-light) text-(--color-error-dark) rounded-lg animate-slideDown">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email Field */}
            <Input
              label="Correo Electrónico"
              type="email"
              autoComplete="email"
              placeholder="admin@smartretail.com"
              leftIcon={<Mail className="h-5 w-5" />}
              error={errors.email?.message}
              {...register('email', {
                required: 'El correo es requerido',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Correo inválido',
                },
              })}
            />

            {/* Password Field */}
            <Input
              label="Contraseña"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              leftIcon={<Lock className="h-5 w-5" />}
              error={errors.password?.message}
              {...register('password', {
                required: 'La contraseña es requerida',
                minLength: {
                  value: 6,
                  message: 'Mínimo 6 caracteres',
                },
              })}
            />

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full"
            >
              {isLoading ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </form>

          {/* Demo credentials hint */}
          <div className="mt-6 p-4 bg-(--color-background-subtle) rounded-lg">
            <p className="text-xs text-(--color-text-tertiary) text-center">
              Demo: admin@smartretail.com / admin123
            </p>
          </div>
        </Card>

        {/* Footer */}
        <p className="mt-8 text-center text-sm text-(--color-text-tertiary)">
          © 2026 SMART_RETAIL. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}
