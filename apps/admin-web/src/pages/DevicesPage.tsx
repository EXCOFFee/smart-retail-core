/**
 * ============================================================================
 * SMART_RETAIL Admin Web - Devices Page
 * ============================================================================
 * Gestión de dispositivos IoT: Lista, Provisioning (CU-10), Status (CU-12, CU-20).
 * 
 * Por qué zodResolver: SRS §6 Regla 1 exige validación estricta.
 * Garantiza que los dispositivos se registren con datos válidos.
 */

import { DeviceProvisionRequest, DeviceProvisionResponse, devicesApi } from '@/api/client';
import { deviceSchema, type DeviceFormData } from '@/lib/schemas';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    AlertTriangle,
    Check,
    Copy,
    Loader2,
    Monitor,
    Plus,
    Settings,
    Shield,
    Wifi,
    WifiOff,
    Wrench,
    X,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

export default function DevicesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [credentials, setCredentials] = useState<DeviceProvisionResponse | null>(null);
  const queryClient = useQueryClient();

  // Fetch devices
  const { data, isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: devicesApi.list,
  });

  const devices = data?.devices || [];

  // Provision device mutation
  const provisionMutation = useMutation({
    mutationFn: devicesApi.provision,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setIsModalOpen(false);
      setCredentials(data); // Show credentials modal
    },
  });

  // Update status mutation
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      devicesApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dispositivos</h1>
          <p className="text-gray-500">
            Gestión de molinetes, lockers y puertas
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          Provisionar Dispositivo
        </button>
      </div>

      {/* Devices Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : devices.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            No hay dispositivos registrados
          </div>
        ) : (
          devices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              onStatusChange={(status) =>
                statusMutation.mutate({ id: device.id, status })
              }
            />
          ))
        )}
      </div>

      {/* Provision Modal */}
      {isModalOpen && (
        <ProvisionModal
          onClose={() => setIsModalOpen(false)}
          onSubmit={(data) => provisionMutation.mutate(data)}
          isLoading={provisionMutation.isPending}
        />
      )}

      {/* Credentials Modal */}
      {credentials && (
        <CredentialsModal
          credentials={credentials}
          onClose={() => setCredentials(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCOMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

interface DeviceCardProps {
  device: {
    id: string;
    serialNumber: string;
    name: string;
    type: string;
    status: string;
    lastHeartbeat: string | null;
  };
  onStatusChange: (status: string) => void;
}

function DeviceCard({ device, onStatusChange }: DeviceCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const statusConfig: Record<
    string,
    { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    ONLINE: { bg: 'bg-green-100', text: 'text-green-700', icon: Wifi },
    OFFLINE: { bg: 'bg-gray-100', text: 'text-gray-700', icon: WifiOff },
    MAINTENANCE: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Wrench },
    COMPROMISED: { bg: 'bg-red-100', text: 'text-red-700', icon: Shield },
  };

  const config = statusConfig[device.status] || statusConfig.OFFLINE;
  const StatusIcon = config.icon;

  return (
    <div className="bg-white rounded-xl shadow-sm border p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-lg ${config.bg}`}>
            <Monitor className={`h-6 w-6 ${config.text}`} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{device.name}</h3>
            <p className="text-sm text-gray-500">{device.serialNumber}</p>
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <Settings className="h-5 w-5 text-gray-400" />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-1 w-48 bg-white rounded-lg shadow-lg border py-1">
                <button
                  type="button"
                  onClick={() => {
                    onStatusChange('MAINTENANCE');
                    setMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <Wrench className="h-4 w-4" />
                  Modo Mantenimiento
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onStatusChange('OFFLINE');
                    setMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <WifiOff className="h-4 w-4" />
                  Marcar Offline
                </button>
                <hr className="my-1" />
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('¿Marcar este dispositivo como COMPROMETIDO? Esta acción revocará sus credenciales.')) {
                      onStatusChange('COMPROMISED');
                      setMenuOpen(false);
                    }
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Shield className="h-4 w-4" />
                  Marcar Comprometido
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Tipo</span>
          <span className="font-medium">{device.type}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Estado</span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
          >
            <StatusIcon className="h-3 w-3" />
            {device.status}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Último Heartbeat</span>
          <span className="text-gray-700">
            {device.lastHeartbeat
              ? new Date(device.lastHeartbeat).toLocaleString('es-AR')
              : 'Nunca'}
          </span>
        </div>
      </div>
    </div>
  );
}

interface ProvisionModalProps {
  onClose: () => void;
  onSubmit: (data: DeviceProvisionRequest) => void;
  isLoading: boolean;
}

/**
 * Modal de provisioning con validación Zod.
 * 
 * Por qué zodResolver: Valida serialNumber, name, type y locationId
 * antes de enviar al backend, evitando errores de registro.
 */
function ProvisionModal({ onClose, onSubmit, isLoading }: ProvisionModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DeviceFormData>({
    resolver: zodResolver(deviceSchema),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Provisionar Dispositivo</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Número de Serie
            </label>
            <input
              {...register('serialNumber', { required: 'Requerido' })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="SN-2026-MOLINETE-001"
            />
            {errors.serialNumber && (
              <p className="mt-1 text-sm text-red-600">{errors.serialNumber.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre
            </label>
            <input
              {...register('name', { required: 'Requerido' })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Molinete Entrada Norte"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo
            </label>
            <select
              {...register('type', { required: 'Requerido' })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar...</option>
              <option value="TURNSTILE">Molinete</option>
              <option value="LOCKER">Locker</option>
              <option value="DOOR">Puerta</option>
              <option value="KIOSK">Kiosco</option>
            </select>
            {errors.type && (
              <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location ID
            </label>
            <input
              {...register('locationId', { required: 'Requerido' })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="550e8400-e29b-41d4-a716-446655440001"
            />
            {errors.locationId && (
              <p className="mt-1 text-sm text-red-600">{errors.locationId.message}</p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Provisionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface CredentialsModalProps {
  credentials: DeviceProvisionResponse;
  onClose: () => void;
}

function CredentialsModal({ credentials, onClose }: CredentialsModalProps) {
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const copyToClipboard = async (text: string, type: 'apiKey' | 'secret') => {
    await navigator.clipboard.writeText(text);
    if (type === 'apiKey') {
      setCopiedApiKey(true);
      setTimeout(() => setCopiedApiKey(false), 2000);
    } else {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b bg-amber-50">
          <div className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Credenciales del Dispositivo</h2>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700 font-medium">
              ⚠️ IMPORTANTE: Copie estas credenciales AHORA. El secret NO se mostrará
              nuevamente.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dispositivo
              </label>
              <p className="text-gray-900">{credentials.name}</p>
              <p className="text-sm text-gray-500">{credentials.serialNumber}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key
              </label>
              <div className="flex gap-2">
                <code className="flex-1 p-2 bg-gray-100 rounded font-mono text-sm break-all">
                  {credentials.apiKey}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(credentials.apiKey, 'apiKey')}
                  className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                  {copiedApiKey ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Secret
              </label>
              <div className="flex gap-2">
                <code className="flex-1 p-2 bg-gray-100 rounded font-mono text-xs break-all">
                  {credentials.secret}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(credentials.secret, 'secret')}
                  className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                  {copiedSecret ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Entendido, he copiado las credenciales
          </button>
        </div>
      </div>
    </div>
  );
}
