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
git clone https://github.com/EXCOFFee/smart-retail-core.git
cd smart-retail-core
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

El repo ya incluye `docker-compose.yml` (PostgreSQL 17 + Redis 7). El script de
init (`docker/init-scripts/01-init.sql`) crea la extensión `uuid-ossp` y el
schema `audit` automáticamente en el primer arranque.

```powershell
# Levanta solo Postgres + Redis (equivalente a: pnpm db:dev)
docker compose up -d postgres redis
```

Credenciales por defecto (definidas en `docker-compose.yml`, coinciden con
los defaults de `.env.example`):

| Dato | Valor |
|------|-------|
| Usuario | `smartRetail` |
| Password | `smart_retail_secret_2026` |
| Base | `smart_retail_db` |
| Puerto | `5432` |

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

### 5.1 Crear el archivo de entorno del Backend

La app carga `.env.local` (prioridad) y luego `.env`. Copiá el template:

```powershell
cd apps/backend
Copy-Item .env.example .env.local
```

`.env.example` ya trae los valores de **DB y Redis que coinciden con
`docker-compose.yml`**, así que en local no hace falta tocarlos. Lo único
obligatorio es completar las **claves JWT** (paso 5.2). `GATEWAY_MODE=mock`
viene por defecto: usa dobles en memoria para pagos/hardware, sin credenciales
reales.

> Nombres de variables (los reales que lee la app): `DB_HOST`, `DB_PORT`,
> `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `REDIS_HOST`, `REDIS_PORT`,
> `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `GATEWAY_MODE`, `MERCADOPAGO_ACCESS_TOKEN`.
> **No** usa `DATABASE_URL` ni `REDIS_URL`.

### 5.2 Generar claves JWT RS256

Los Access Tokens se firman con RS256, así que hacen falta un par de claves:

```powershell
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

Pegá el contenido en `.env.local`. `dotenv` soporta valores multilínea entre
comillas dobles, así que va tal cual (con los saltos de línea reales):

```env
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
...contenido de private.pem...
-----END PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
...contenido de public.pem...
-----END PUBLIC KEY-----"
```

> **Importante:** dejá `DB_SYNCHRONIZE=false` (el default). El esquema se crea
> con **migraciones reales** (paso 5.3), no con auto-sync. `synchronize=true`
> es solo un atajo de desarrollo y no debe usarse en el camino normal.

### 5.3 Migraciones y datos de prueba

Con Postgres arriba y el `.env.local` listo, creá el esquema y (opcional) cargá
datos de prueba:

```powershell
# Desde apps/backend
pnpm db:migrate       # crea todas las tablas (users, products, devices, transactions, audit.audit_logs)
pnpm db:seed:test     # opcional: usuarios + dispositivos + productos de ejemplo
```

El seed crea, entre otros, el usuario `test@smartretail.com` /
`TestPassword123!` (con password hasheada en bcrypt) para poder loguearte
enseguida.

---

## ▶️ 6. EJECUCIÓN LOCAL

### 6.1 Backend (API)

```powershell
cd apps/backend

# Modo desarrollo (hot reload)
pnpm dev
```

Al arrancar vas a ver: `🚀 SMART_RETAIL Backend corriendo en: http://localhost:3000`.

**Verificar que responde:**
- **Swagger (docs vivas):** http://localhost:3000/docs — desde acá podés probar
  `POST /auth/login` con `test@smartretail.com` / `TestPassword123!`.
- Todas las rutas de la API cuelgan de `/api/v1` (ej. `POST /api/v1/auth/login`,
  `POST /api/v1/access/request`).

> Nota: `GET /api/v1/health` está detrás del guard global de auth (responde 401
> sin token); usá `/docs` para el chequeo rápido de que la app está viva.

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
- [ ] Archivo `.env.local` creado en `apps/backend` (copiado de `.env.example`)
- [ ] Claves JWT generadas y pegadas en `.env.local`
- [ ] Migraciones corridas (`pnpm db:migrate`) — sin `DB_SYNCHRONIZE=true`
- [ ] (Opcional) Seed cargado (`pnpm db:seed:test`)
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
