# SMART_RETAIL - Guía de Deploy

## 🚀 Configuración de Deploy (GitHub Actions + Fly.io + Vercel)

Esta guía explica cómo configurar el deploy automático de SMART_RETAIL.

### Requisitos Previos

1. **Cuenta de GitHub**: https://github.com/EXCOFFee
2. **Cuenta de Fly.io**: https://fly.io (gratis para empezar)
3. **Cuenta de Vercel**: https://vercel.com (gratis para proyectos personales)

---

## 📦 Paso 1: Crear Repositorio en GitHub

```bash
# En la raíz del proyecto
git init
git add .
git commit -m "Initial commit: SMART_RETAIL MVP Week 5"
git branch -M main
git remote add origin https://github.com/EXCOFFee/smartRetail.git
git push -u origin main
```

---

## 🔧 Paso 2: Configurar Fly.io (Backend)

### 2.1 Instalar Fly CLI

```bash
# Windows (PowerShell)
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

# O con scoop
scoop install flyctl
```

### 2.2 Login y Crear App

```bash
flyctl auth login
cd apps/backend
flyctl launch --name smart-retail-backend --region gru
# gru = São Paulo (baja latencia para Argentina/Chile)
```

### 2.3 Configurar Secrets en Fly.io

```bash
flyctl secrets set \
  DATABASE_URL="postgres://user:pass@db.host:5432/smartRetail" \
  REDIS_URL="redis://default:pass@redis.host:6379" \
  JWT_ACCESS_SECRET="tu-secret-rs256-access" \
  JWT_REFRESH_SECRET="tu-secret-rs256-refresh" \
  MERCADOPAGO_ACCESS_TOKEN="tu-mp-token" \
  NODE_ENV="production"
```

### 2.4 Obtener API Token para GitHub

```bash
flyctl tokens create deploy -x 999999h
# Copia el token generado
```

---

## 🌐 Paso 3: Configurar Vercel (Admin Web)

### 3.1 Instalar Vercel CLI

```bash
npm install -g vercel
```

### 3.2 Login y Vincular Proyecto

```bash
vercel login
cd apps/admin-web
vercel link
```

### 3.3 Obtener IDs para GitHub

```bash
# El org-id y project-id se muestran al hacer vercel link
# También puedes verlos en .vercel/project.json
cat .vercel/project.json
```

### 3.4 Crear Token de Deploy

1. Ve a https://vercel.com/account/tokens
2. Click "Create Token"
3. Nombre: "SMART_RETAIL GitHub Actions"
4. Copia el token

---

## 🔐 Paso 4: Configurar Secrets en GitHub

Ve a: `https://github.com/EXCOFFee/smartRetail/settings/secrets/actions`

### Secrets Requeridos:

| Nombre | Descripción | Cómo obtenerlo |
|--------|-------------|----------------|
| `FLY_API_TOKEN` | Token de deploy de Fly.io | Paso 2.4 |
| `VERCEL_TOKEN` | Token de Vercel | Paso 3.4 |
| `VERCEL_ORG_ID` | ID de organización Vercel | Paso 3.3 |
| `VERCEL_PROJECT_ID` | ID del proyecto Vercel | Paso 3.3 |

### Variables (no secrets):

Ve a: `https://github.com/EXCOFFee/smartRetail/settings/variables/actions`

| Nombre | Valor Ejemplo |
|--------|---------------|
| `API_URL` | `https://smart-retail-backend.fly.dev/api/v1` |

---

## ✅ Paso 5: Primer Deploy

```bash
# Asegúrate de que el código está actualizado
git add .
git commit -m "feat: Deploy configuration complete"
git push origin main
```

El pipeline de GitHub Actions:
1. ✅ Ejecutará lint y type check
2. ✅ Ejecutará tests unitarios
3. ✅ Ejecutará tests E2E
4. ✅ Compilará backend y admin-web
5. ✅ Desplegará a Fly.io y Vercel

---

## 📊 Monitoreo Post-Deploy

### Ver Logs de Backend

```bash
flyctl logs --app smart-retail-backend
```

### Ver Status

```bash
flyctl status --app smart-retail-backend
```

### Health Check

```bash
curl https://smart-retail-backend.fly.dev/api/v1/health
```

---

## 🔄 Deploy Manual (sin GitHub Actions)

### Backend

```bash
cd apps/backend
flyctl deploy --remote-only
```

### Admin Web

```bash
cd apps/admin-web
vercel --prod
```

---

## 🗄️ Base de Datos (Fly.io Postgres)

### Crear Postgres en Fly.io

```bash
flyctl postgres create --name smart-retail-db --region gru
flyctl postgres attach smart-retail-db --app smart-retail-backend
```

### Conectarse a la DB

```bash
flyctl postgres connect -a smart-retail-db
```

---

## 🔴 Redis (Upstash recomendado)

1. Ve a https://upstash.com
2. Crea una instancia Redis (gratis hasta 10k comandos/día)
3. Copia la URL de conexión
4. Configura en Fly.io:

```bash
flyctl secrets set REDIS_URL="rediss://default:xxx@xxx.upstash.io:6379"
```

---

## 🚨 Troubleshooting

### Error: "FLY_API_TOKEN not found"

Verifica que el secret esté configurado en GitHub:
`Settings > Secrets and variables > Actions > Repository secrets`

### Error: "Build failed"

```bash
# Verificar localmente
pnpm install
pnpm build
```

### Error: "Database connection refused"

```bash
# Verificar que Postgres está corriendo
flyctl postgres list
flyctl postgres attach smart-retail-db --app smart-retail-backend
```

---

## 📱 Deploy de Mobile App (Expo)

Para la app móvil, usa EAS Build:

```bash
cd apps/mobile
npx eas-cli login
npx eas build --platform all --profile production
npx eas submit --platform all
```

---

## 🎯 URLs de Producción

| Servicio | URL |
|----------|-----|
| Backend API | https://smart-retail-backend.fly.dev/api/v1 |
| Admin Web | https://smart-retail-admin.vercel.app |
| Health Check | https://smart-retail-backend.fly.dev/api/v1/health |
| Metrics | https://smart-retail-backend.fly.dev/api/v1/metrics |

---

## 📅 Próximos Pasos

1. [ ] Configurar dominio personalizado
2. [ ] Configurar SSL/TLS automático
3. [ ] Configurar alertas en Fly.io
4. [ ] Integrar Sentry para errores
5. [ ] Configurar Grafana Cloud para métricas
