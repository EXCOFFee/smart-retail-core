> **English** | [Español](#espanol)

# SmartRetail Core — real-time retail transaction engine

A NestJS backend that validates a purchase — **stock, payment, and identity in one hot path** — and then drives physical hardware (turnstiles, lockers, vending machines) over WebSockets. It targets the Argentine market and its local payment rails (MercadoPago, MODO). This repo is a **sanitized architecture reference**: the core engine and its test suite are public; proprietary business rules and client data are not.

**Live demo:** none published — the fastest way to see it run is the test suite: `pnpm --filter @smartretail/backend test` (667 passing tests).

## Key engineering decisions

- **Compensating rollback on the purchase path** — the order use case runs *QR check → stock lock → charge → hardware ACK* as a single flow. If the hardware never confirms **after the customer was already charged**, it auto-refunds the payment, returns the stock, and marks the transaction `REFUNDED_HARDWARE_FAILURE`. Money never leaves without a door opening. → [process-access.service.ts](apps/backend/src/application/use-cases/process-access.service.ts)
- **Three independent guards against overselling** — a Redis `SET NX EX` soft-lock (one buyer per product/location at a time), a Lua script that decrements stock atomically and refuses to go below zero, and an optimistic `version` check on the Postgres write. Concurrency is handled in the cache *and* in the database. → [redis-stock-cache.adapter.ts](apps/backend/src/infrastructure/adapters/cache/redis-stock-cache.adapter.ts), [product.repository.ts](apps/backend/src/infrastructure/database/repositories/product.repository.ts)
- **Rotating, opaque refresh tokens** — short-lived RS256-signed access JWTs, plus 256-bit opaque refresh tokens stored *hashed* in Redis, rotated on every use (the old one is deleted) and revocable per session or across all sessions. → [refresh-token.service.ts](apps/backend/src/application/services/refresh-token.service.ts)
- **Money as integer cents** — a `Money` value object keeps every amount in integer cents, and the schema stores `*_cents` columns guarded by `CHECK (>= 0)`. No floating-point ever touches the payment path. → [money.value-object.ts](apps/backend/src/domain/value-objects/money.value-object.ts)

## Stack

NestJS 11 · TypeScript · PostgreSQL 17 / TypeORM · Redis 7 / ioredis · Socket.io · Jest (667 passing unit tests, ~98% line coverage) · pnpm + Turborepo monorepo (backend · React Native kiosk · React admin).

Hexagonal layering (`domain` → `application` → `infrastructure`) keeps external gateways behind ports. The repo ships real MercadoPago/MODO HTTP adapters and a Socket.io device gateway; the engine is unit-tested against in-memory doubles while those integrations are being wired into the composition root.

---
<a id="espanol"></a>

# SmartRetail-Core: Smart Retail & Logistics System

> **Aduana de Control Ciberfísica** - Validación de transacciones (Stock + Pago + Identidad) en <200ms

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D24.0.0-green)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)

> **Nota de Arquitectura y Confidencialidad:** Este repositorio expone el núcleo arquitectónico (Core Engine) de un sistema de Retail Inteligente. Por motivos de confidencialidad (NDA), la lógica de negocio propietaria estricta y los datos de clientes han sido sanitizados. Se hace público como demostración de Arquitectura Hexagonal, manejo de concurrencia y despliegue de monorepos.

## Descripción

SmartRetail es una plataforma de logística automatizada que funciona como motor validador en tiempo real, interconectando:

- **El Usuario**: App Móvil en modo Kiosco (IoT).
- **El Dinero**: Validación de saldo y pasarelas de pago.
- **El Hardware**: Control de molinetes, lockers y puertas de góndolas.

## Arquitectura

```text
┌─────────────────────────────────────────────────────────────────┐
│                        SmartRetail Monorepo                     │
├─────────────────────────────────────────────────────────────────┤
│  apps/                                                          │
│  ├── backend/          # NestJS API (Hexagonal Architecture)    │
│  ├── mobile/           # React Native Kiosk App (Expo SDK 52)   │
│  └── admin-web/        # React Admin Dashboard (React 19)       │
│                                                                 │
│  packages/                                                      │
│  └── shared-types/     # DTOs e interfaces compartidas          │
└─────────────────────────────────────────────────────────────────┘
```

### Arquitectura Hexagonal (Backend)

El motor principal impone una separación estricta de responsabilidades:

```text
src/
├── domain/             # REGLAS PURAS (Entities, Value Objects, Exceptions)
├── application/        # ORQUESTACIÓN (Use Cases, Ports)
└── infrastructure/     # MUNDO REAL (Adapters, Controllers, ORM)
```

## Tech Stack

| Capa | Tecnología |
|------|------------|
| **Runtime** | Node.js v24+ LTS |
| **Backend** | NestJS v11+ |
| **Database** | PostgreSQL 17+ |
| **Cache** | Redis 7+ |
| **ORM** | TypeORM |
| **Package Manager** | pnpm |
| **Monorepo** | Turborepo |
| **Mobile** | React Native + Expo SDK 52+ |
| **Admin Web** | React 19 + Vite + Tailwind v4 |
| **IoT Protocol** | WebSockets (Socket.io) |

## Quick Start

### Prerrequisitos

- Node.js >= 24.0.0
- pnpm >= 9.0.0
- Docker Desktop

### 1. Clonar e instalar dependencias

```bash
git clone [https://github.com/EXCOFFee/smart-retail-core.git](https://github.com/EXCOFFee/smart-retail-core.git) smart-retail-core
cd smart-retail-core
pnpm install
```

### 2. Levantar infraestructura (Postgres + Redis)

```bash
docker compose up -d
```

Servicios disponibles localmente:
- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`
- **Adminer (DB GUI)**: `http://localhost:8080`
- **RedisInsight**: `http://localhost:5540`

### 3. Configurar variables de entorno

```bash
cd apps/backend
# El archivo .env.local ya está configurado para desarrollo
```

### 4. Ejecutar migraciones

```bash
cd apps/backend
pnpm migration:run
```

### 5. Iniciar en modo desarrollo

```bash
# Desde la raíz del monorepo
pnpm dev

# O solo el backend
cd apps/backend
pnpm dev
```

**Swagger API Docs**: `http://localhost:3000/docs`

## Estructura de Archivos (Backend Engine)

```text
apps/backend/src/
├── main.ts                          # Entry point
├── app.module.ts                    # Root module
│
├── domain/                          # Capa de Dominio (PURA)
│   ├── entities/                    # Entidades de negocio (User, Product, Transaction)
│   ├── value-objects/               # Value Objects inmutables (Money)
│   └── exceptions/                  # Excepciones (InsufficientBalance, StockInsufficient)
│
├── application/                     # Capa de Aplicación
│   ├── ports/                       # Interfaces (PaymentGateway, StockCache, DeviceGateway)
│   └── use-cases/                   # Casos de uso de negocio
│
└── infrastructure/                  # Capa de Infraestructura
    ├── config/                      # Validaciones de Entorno y TypeORM
    ├── database/                    # Entidades ORM y Migraciones
    ├── adapters/                    # Implementación de puertos externos
    └── controllers/                 # HTTP Controllers / Webhooks
```

## Comandos Disponibles

```bash
# Raíz del monorepo
pnpm dev           # Desarrollo con hot reload
pnpm build         # Build de producción
pnpm lint          # Ejecutar ESLint
pnpm test          # Ejecutar tests
pnpm test:cov      # Tests con cobertura

# Backend específico (desde apps/backend)
pnpm migration:generate src/infrastructure/database/migrations/NombreMigracion
pnpm migration:run
pnpm migration:revert
```

## Seguridad y Control

- **Autenticación**: JWT con firma RS256.
- **Validación Estricta**: `class-validator` en todas las capas de entrada (Controllers/Webhooks).
- **Passwords**: Hashing con bcrypt (salt por password, cost factor configurable vía `BCRYPT_COST`).
- **Anti-fraude IoT**: Bloqueo estricto de operaciones de hardware en estado offline.

---
*Arquitectura base desarrollada por Santiago Excofier. Construyendo infraestructura escalable para la integración entre software transaccional y hardware IoT.*
```