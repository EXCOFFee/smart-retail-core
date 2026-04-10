# SMART_RETAIL Admin Web

Panel de administración para SMART_RETAIL - Smart Retail & Logistics.

## Stack Tecnológico

- **React 19** - UI Framework
- **Vite 6** - Build Tool
- **Tailwind CSS v4** - Styling
- **TanStack Query** - Data Fetching
- **React Router 7** - Routing
- **Zustand** - State Management
- **React Hook Form** - Forms
- **Lucide React** - Icons

## Instalación

```bash
# Desde la raíz del proyecto
cd apps/admin-web
pnpm install
```

## Desarrollo

```bash
# Iniciar servidor de desarrollo
pnpm dev
```

Abre http://localhost:5173 en tu navegador.

## Build para Producción

```bash
pnpm build
pnpm preview
```

## Estructura del Proyecto

```
src/
├── api/          # Cliente HTTP y definiciones de API
├── components/   # Componentes reutilizables
├── pages/        # Páginas/vistas de la aplicación
├── stores/       # Estado global (Zustand)
├── App.tsx       # Componente principal con routing
├── main.tsx      # Entry point
└── index.css     # Estilos globales (Tailwind)
```

## Variables de Entorno

Copia `.env.example` a `.env`:

```bash
cp .env.example .env
```

| Variable | Descripción | Default |
|----------|-------------|---------|
| `VITE_API_URL` | URL del backend API | `/api` |

## Páginas

- **Login** - Autenticación de administradores
- **Dashboard** - Resumen de métricas del sistema
- **Productos** - ABM de productos y stock (CU-13)
- **Dispositivos** - Lista y provisioning de IoT (CU-10, CU-12, CU-20)
- **Transacciones** - Auditoría de operaciones

## Deploy

Este proyecto está configurado para desplegarse en **Vercel**.

1. Conecta el repositorio a Vercel
2. Configura el root directory como `apps/admin-web`
3. Configura la variable `VITE_API_URL` con la URL del backend en Fly.io
