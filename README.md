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
- **Passwords**: Hashing criptográfico con bcrypt/argon2.
- **Anti-fraude IoT**: Bloqueo estricto de operaciones de hardware en estado offline.

---
*Arquitectura base desarrollada por Santiago Excofier. Construyendo infraestructura escalable para la integración entre software transaccional y hardware IoT.*
```