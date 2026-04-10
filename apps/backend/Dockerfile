# ============================================================================
# SMART_RETAIL - Backend Dockerfile (Railway)
# ============================================================================
# Multi-stage build para producción optimizada.
# Railway construye desde el directorio apps/backend.
# ============================================================================

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Dependencies
# ─────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS deps

WORKDIR /app

# Instalar pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar archivos de dependencias
COPY package.json pnpm-lock.yaml* ./

# Instalar dependencias (incluyendo dev para build)
RUN pnpm install --frozen-lockfile || pnpm install

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Build
# ─────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app

# Instalar pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar dependencias instaladas
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./

# Copiar código fuente
COPY src ./src
COPY tsconfig.json nest-cli.json ./

# Build
RUN pnpm build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: Production
# ─────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runner

WORKDIR /app

# Crear usuario no-root para seguridad
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 smartRetail

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000

# Copiar package.json para referencias
COPY package.json ./

# Instalar pnpm y dependencias de producción
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY --from=deps /app/node_modules ./node_modules

# Copiar build
COPY --from=builder /app/dist ./dist

# Cambiar a usuario no-root
USER smartRetail

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Comando de inicio
CMD ["node", "dist/main.js"]
