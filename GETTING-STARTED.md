# 🚀 SMART_RETAIL - Guía de Inicialización Completa

> **Sistema de Smart Retail & Logística**  
> Versión: MVP Semana 5  
> Última actualización: Enero 2026

---

## 🌐 SERVICIOS EN PRODUCCIÓN

| Servicio | Plataforma | URL |
|----------|------------|-----|
| **Backend API** | Railway | https://backend-production-bd9a.up.railway.app |
| **Admin Web** | Vercel | https://smart-retail-admin.vercel.app |
| **Swagger Docs** | Railway | https://backend-production-bd9a.up.railway.app/docs |

---

## 📋 TABLA DE CONTENIDOS

1. [Requisitos Previos](#-1-requisitos-previos)
2. [Configuración del Entorno](#-2-configuración-del-entorno)
3. [Instalación de Dependencias](#-3-instalación-de-dependencias)
4. [Configuración de Base de Datos](#-4-configuración-de-base-de-datos)
5. [Variables de Entorno](#-5-variables-de-entorno)
6. [Ejecución Local](#-6-ejecución-local)
7. [Ejecución de Tests](#-7-ejecución-de-tests)
8. [Despliegue a Producción](#-8-despliegue-a-producción)
9. [Troubleshooting](#-9-troubleshooting)

---

## 🔧 1. REQUISITOS PREVIOS

### Software Necesario

| Herramienta | Versión Mínima | Instalación |
|-------------|----------------|-------------|
| **Node.js** | v22+ LTS | [nodejs.org](https://nodejs.org/) |
| **pnpm** | v10+ | `npm install -g pnpm@latest` |
| **Docker** | v24+ | [docker.com](https://www.docker.com/) |
| **Git** | v2.40+ | [git-scm.com](https://git-scm.com/) |
| **PostgreSQL** | 17+ | Vía Docker (ver abajo) |
| **Redis** | 7+ | Vía Docker (ver abajo) |

### Verificar Instalaciones

```powershell
# Verificar Node.js
node --version
# Debe mostrar: v22.x.x o superior

# Verificar pnpm
pnpm --version
# Debe mostrar: 10.x.x

# Verificar Docker
docker --version
# Debe mostrar: Docker version 24.x.x
```

---

## ⚙️ 2. CONFIGURACIÓN DEL ENTORNO

### 2.1 Clonar el Repositorio

```powershell
git clone https://github.com/EXCOFFee/smartRetail.git
cd smartRetail
```

### 2.2 Estructura del Proyecto

```
SMART_RETAIL/
├── apps/
│   ├── backend/       # NestJS API (Puerto 3000)
│   ├── admin-web/     # React 19 + Vite Admin Panel
│   └── mobile/        # React Native + Expo SDK 52
├── tests/
│   └── e2e/           # Tests End-to-End
├── scripts/           # Scripts de utilidad
├── monitoring/        # Dashboards Grafana
├── docs/              # Documentación
└── docker/            # Docker configs
```

---

## 📦 3. INSTALACIÓN DE DEPENDENCIAS

### 3.1 Instalación Principal

```powershell
# Desde la raíz del proyecto
pnpm install
```

### 3.2 Instalación por Aplicación

```powershell
# Backend
cd apps/backend
pnpm install
cd ../..

# Admin Web
cd apps/admin-web
pnpm install
cd ../..

# Mobile
cd apps/mobile
pnpm install
cd ../..
```

---

## 🗃️ 4. CONFIGURACIÓN DE BASE DE DATOS

### 4.1 Iniciar Servicios con Docker

```powershell
# Iniciar PostgreSQL y Redis
docker-compose up -d
```

Si no existe `docker-compose.yml`, créalo:

```yaml
# docker-compose.yml
version: '3.9'

services:
  postgres:
    image: postgres:17-alpine
    container_name: smart-retail-postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: smartRetail
      POSTGRES_PASSWORD: smart_retail_dev
      POSTGRES_DB: smartRetail
    volumes:
      - smart_retail_postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: smart-retail-redis
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - smart_retail_redis_data:/data

volumes:
  smart_retail_postgres_data:
  smart_retail_redis_data:
```

### 4.2 Verificar Conexión

```powershell
# Verificar PostgreSQL
docker exec -it smart-retail-postgres psql -U smartRetail -d smartRetail -c "SELECT 1"

# Verificar Redis
docker exec -it smart-retail-redis redis-cli ping
# Debe responder: PONG
```

---

## 🔐 5. VARIABLES DE ENTORNO

### 5.1 Crear Archivo .env para Backend

```powershell
cd apps/backend
Copy-Item .env.example .env
```

### 5.2 Contenido del .env

```env
# ═══════════════════════════════════════════════════════════════
# SMART_RETAIL - Backend Environment Variables
# ═══════════════════════════════════════════════════════════════

# ─── AMBIENTE ───────────────────────────────────────────────────
NODE_ENV=development
PORT=3000

# ─── BASE DE DATOS ──────────────────────────────────────────────
DATABASE_URL=postgresql://smartRetail:smart_retail_dev@localhost:5432/smartRetail

# ─── REDIS ──────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ─── JWT (Generar claves únicas para producción!) ───────────────
# Generar: openssl genrsa -out private.pem 2048
#          openssl rsa -in private.pem -pubout -out public.pem
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
... tu clave privada ...
-----END RSA PRIVATE KEY-----"

JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
... tu clave pública ...
-----END PUBLIC KEY-----"

JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# ─── PASARELA DE PAGOS ──────────────────────────────────────────
MERCADOPAGO_ACCESS_TOKEN=TEST-xxxx-xxxx-xxxx
MERCADOPAGO_PUBLIC_KEY=TEST-xxxx-xxxx-xxxx

# ─── TIMEOUTS ───────────────────────────────────────────────────
PAYMENT_TIMEOUT_MS=3000
HARDWARE_ACK_TIMEOUT_MS=5000
REDIS_LOCK_TTL=30

# ─── RATE LIMITING ──────────────────────────────────────────────
RATE_LIMIT_GLOBAL_MAX=100
RATE_LIMIT_GLOBAL_WINDOW_SECONDS=60
RATE_LIMIT_ACCESS_MAX=10
RATE_LIMIT_ACCESS_WINDOW_SECONDS=60
```

### 5.3 Generar Claves JWT RS256

```powershell
# En PowerShell/CMD con OpenSSL instalado
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem

# Copiar contenido a .env (escapar saltos de línea o usar comillas)
```

---

## ▶️ 6. EJECUCIÓN LOCAL

### 6.1 Backend (API)

```powershell
cd apps/backend

# Modo desarrollo (hot reload)
pnpm dev

# Verificar que funciona
# Health: http://localhost:3000/health
# Swagger: http://localhost:3000/docs
```

### 6.2 Admin Web (React + Vite)

```powershell
cd apps/admin-web

# Modo desarrollo
pnpm dev

# Abrir: http://localhost:5173
```

### 6.3 Mobile (Expo)

```powershell
cd apps/mobile

# Iniciar Expo
pnpm start

# Opciones:
# - Presionar 'a' para Android
# - Presionar 'i' para iOS
# - Escanear QR con Expo Go
```

### 6.4 Todos Simultáneamente (Turbo)

```powershell
# Desde la raíz del proyecto
pnpm dev

# Esto inicia backend + admin-web + mobile en paralelo
```

### 6.5 Puertos Utilizados

| Servicio | Puerto | URL |
|----------|--------|-----|
| Backend | 3000 | http://localhost:3000 |
| Admin Web | 5173 | http://localhost:5173 |
| Expo | 8081 | Expo Go app |
| PostgreSQL | 5432 | localhost:5432 |
| Redis | 6379 | localhost:6379 |

---

## 🧪 7. EJECUCIÓN DE TESTS

### 7.1 Tests Unitarios (Backend)

```powershell
cd apps/backend

# Ejecutar tests
pnpm test

# Con cobertura
pnpm test:cov

# Watch mode
pnpm test:watch
```

### 7.2 Tests E2E

```powershell
cd tests/e2e

# Instalar dependencias
pnpm install

# Ejecutar tests E2E
pnpm test

# Tests específicos
pnpm test -- --grep "CU-01"
```

### 7.3 Lint

```powershell
cd apps/backend
pnpm lint

# Corregir automáticamente
pnpm lint --fix
```

---

## 🚀 8. DESPLIEGUE A PRODUCCIÓN

### 8.1 Plataformas Utilizadas

| Servicio | Plataforma | Notas |
|----------|------------|-------|
| **Backend API** | Railway | PostgreSQL + Redis incluidos |
| **Admin Web** | Vercel | Deploy automático desde GitHub |
| **Mobile** | Expo EAS | Build y distribución |

### 8.2 Configurar Railway (Backend)

```powershell
# Instalar CLI de Railway
npm install -g @railway/cli

# Login
railway login

# Vincular proyecto existente
railway link

# Configurar variables de entorno
railway variables set NODE_ENV=production
railway variables set JWT_PRIVATE_KEY="..."
railway variables set JWT_PUBLIC_KEY="..."
railway variables set MERCADOPAGO_ACCESS_TOKEN="..."

# Deploy
railway up

# Ver logs
railway logs
```

### 8.3 Configurar Vercel (Admin Web)

```powershell
# Instalar CLI de Vercel
npm install -g vercel

# Login
vercel login

# Deploy
cd apps/admin-web
vercel

# Producción
vercel --prod
```

### 8.4 Configurar GitHub Actions

1. Ir a **Settings → Secrets and Variables → Actions**
2. Agregar secrets:
   - `RAILWAY_TOKEN` (desde Railway → Account Settings)
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`

### 8.5 Deploy Automático

Cada push a `main` ejecuta:
- **CI**: Lint + TypeScript + Tests
- **CD Backend**: Deploy a Railway
- **CD Admin Web**: Deploy a Vercel

---

## 🔧 9. TROUBLESHOOTING

### ❌ Error: "Cannot find module 'typeorm'"

```powershell
cd apps/backend
pnpm install
```

### ❌ Error: "Connection refused to PostgreSQL"

```powershell
# Verificar que Docker está corriendo
docker ps

# Reiniciar contenedor
docker-compose restart postgres
```

### ❌ Error: "Redis connection failed"

```powershell
# Verificar Redis
docker exec -it smart-retail-redis redis-cli ping

# Si falla, reiniciar
docker-compose restart redis
```

### ❌ Error: "JWT_PUBLIC_KEY is required"

Asegúrate de que el `.env` tiene las claves JWT correctamente formateadas.

### ❌ Error: "Port 3000 already in use"

```powershell
# Windows - Encontrar proceso
netstat -ano | findstr :3000

# Matar proceso (reemplazar PID)
taskkill /PID <PID> /F
```

### ❌ Error de Expo "Metro bundler failed"

```powershell
cd apps/mobile
pnpm start --clear

# O borrar cache
rm -rf node_modules/.cache
pnpm start
```

---

## 📞 SOPORTE

- **Documentación**: `docs/`
- **SRS**: [SRS.md](./SRS.md)
- **Reglas de Desarrollo**: [agent.md](./agent.md)

---

## ✅ CHECKLIST DE INICIALIZACIÓN

- [ ] Node.js v22+ instalado
- [ ] pnpm v10+ instalado
- [ ] Docker instalado y corriendo
- [ ] `pnpm install` ejecutado en raíz
- [ ] Docker Compose levantado (postgres + redis)
- [ ] Archivo `.env.local` configurado en raíz
- [ ] Claves JWT generadas
- [ ] Backend arranca sin errores (`cd apps/backend; pnpm dev`)
- [ ] Swagger accesible en http://localhost:3000/docs
- [ ] Admin Web arranca (`cd apps/admin-web; pnpm dev`)
- [ ] Admin Web accesible en http://localhost:5173
- [ ] Tests pasan (`pnpm test`)
- [ ] Mobile arranca con Expo (`cd apps/mobile; pnpm start`)

---

## 🔗 ENLACES ÚTILES

| Recurso | URL |
|---------|-----|
| Backend API (Prod) | https://backend-production-bd9a.up.railway.app |
| Admin Web (Prod) | https://smart-retail-admin.vercel.app |
| Swagger (Prod) | https://backend-production-bd9a.up.railway.app/docs |
| Railway Dashboard | https://railway.app/dashboard |
| Vercel Dashboard | https://vercel.com/dashboard |

---

**¡Listo para desarrollar! 🎉**
