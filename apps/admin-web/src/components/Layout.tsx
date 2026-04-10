/**
 * ============================================================================
 * SMART_RETAIL Admin Web - Layout Component (Rediseñado)
 * ============================================================================
 * Layout principal con sidebar de navegación.
 * Diseño SMART_RETAIL Slate: minimalista, sofisticado, con animaciones sutiles.
 * ============================================================================
 */

import { Button } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import {
    LayoutDashboard,
    LogOut,
    Menu,
    Monitor,
    Package,
    Receipt,
    X,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Productos', href: '/products', icon: Package },
  { name: 'Dispositivos', href: '/devices', icon: Monitor },
  { name: 'Transacciones', href: '/transactions', icon: Receipt },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-(--color-background)">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden animate-fadeIn"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-(--color-primary) 
          transform transition-transform duration-300 ease-out lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-(--color-accent) flex items-center justify-center">
              <span className="text-lg font-bold text-white">S</span>
            </div>
            <span className="text-lg font-semibold text-white">SMART_RETAIL</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-col h-[calc(100vh-4rem)]">
          {/* Navigation Links */}
          <div className="flex-1 px-4 py-6 space-y-1">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-(--color-accent) text-white shadow-lg shadow-(--color-accent)/30'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`
                }
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </NavLink>
            ))}
          </div>

          {/* User Section */}
          <div className="border-t border-white/10 p-4">
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="h-10 w-10 rounded-xl bg-(--color-accent) flex items-center justify-center">
                <span className="text-sm font-semibold text-white">
                  {user?.name?.charAt(0).toUpperCase() || 'A'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.name || 'Administrador'}
                </p>
                <p className="text-xs text-white/50 truncate">
                  {user?.email || 'admin@smartretail.com'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </nav>
      </aside>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-(--color-border-light) bg-(--color-surface)/80 backdrop-blur-md px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg text-(--color-text-secondary) hover:bg-(--color-background-subtle) transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <span className="text-sm text-(--color-text-tertiary)">
            {new Date().toLocaleDateString('es-AR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </header>

        {/* Page content */}
        <main className="p-5 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
