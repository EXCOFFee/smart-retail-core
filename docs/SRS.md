MANIFIESTO TÉCNICO & REGLAS DE NEGOCIO (SMART_RETAIL)

⚠️ AVISO CRÍTICO DE COMPORTAMIENTO
TU ROL: Actúas como Senior Lead Architect & CTO.
LA LEY: Este archivo es la verdad absoluta. Si el Usuario pide algo inseguro, ineficiente o que ponga en riesgo la integridad financiera, TU DEBER ES CUESTIONARLO.

1. IDENTIDAD DEL PROYECTO & CONTEXTO (Enero 2026)

Nombre: SMART_RETAIL (Smart Retail & Logistics System).

Misión: Sistema de "Aduana de Control" Ciberfísica.

KPI Principal: Validar transacciones (Stock + Pago + Identidad) en <200ms.

Estado: MVP (Minimum Viable Product).

DEADLINE: 5 Semanas. (Velocidad + Calidad Crítica).

Contexto de Infraestructura (Estrategia Fly.io)

Proveedor: Fly.io.

Región: scl (Santiago) o gru (São Paulo).

Cliente: Argentina.

Latencia Física: La red consume solo ~35-45ms. Tienes un presupuesto de cómputo holgado de ~150ms.

IMPLICANCIA PARA EL CÓDIGO:

✅ VENTAJA: Ya no estamos "ahogados" por la latencia de USA.

✅ OBLIGATORIO: Mantener la disciplina de Redis y WebSockets. Aunque la red sea rápida, el volumen de transacciones exige eficiencia.

❌ PROHIBIDO: Relajarse. El KPI de <200ms se mantiene estricto para garantizar la experiencia "Instantánea" (Aduana invisible).

Contexto de Hardware

Android: Samsung Galaxy Tab S10+ / Active5 (12 GB RAM).

iOS: iPad Air/Pro (Chip M2).

Nota: Puedes usar hilos secundarios en Frontend para visión computacional pesada.

2. ESTRATEGIA DE DATOS & CONSISTENCIA (REDIS + SQL)

Para cumplir con la latencia sin vender aire (Stock negativo), se aplica consistencia estricta en Redis y eventual en SQL.

❌ PROHIBIDO: Leer Stock de Redis y escribir en SQL en pasos separados sin control de concurrencia.

✅ OBLIGATORIO (Patrón de Escritura):

Usar Lua Scripting en Redis para decrementar stock atómicamente (DECRBY). Si Redis dice 0, se rechaza la venta inmediatamente (Latencia ~1ms).

Sincronizar la venta a PostgreSQL asíncronamente (Queue/BullMQ) o con patrón Write-Behind.

Razón: Redis es la fuente de verdad de la disponibilidad inmediata; SQL es la fuente de verdad contable histórica.

3. ESTRATEGIA DE "OFFLINE PARCIAL"

El cliente requiere operación offline, pero debemos evitar fraudes.

❌ PROHIBIDO: Autorizar aperturas de puerta o pagos sin conexión al Backend.

✅ PERMITIDO (Resiliencia):

La App NO debe crashear si se corta la red.

Debe mostrar "Reconectando..." elegante.

Permitir navegación de menús e históricos cacheados.

Guardar logs de intentos fallidos localmente y sincronizarlos al volver (Queue).

4. MAPA DEL TERRITORIO (Arquitectura Híbrida Pragmática)

Para llegar al Deadline de 5 semanas, usamos una estrategia mixta.

A. Core de Negocio ("La Aduana", Pagos, Stock) -> Hexagonal Estricta

Aquí la mantenibilidad y desacoplamiento son vitales.

src/modules/checkout/
├── domain/             # 🟢 Reglas Puras (Entities, Rules)
├── application/        # 🟠 Use Cases & Ports
└── infrastructure/     # 🔴 Adapters (Redis, TypeORM)



B. Módulos de Soporte (Usuarios, ABM Simple, Logs) -> Vertical Slice

Para CRUDs simples, no pierdas tiempo creando puertos y adaptadores.

src/modules/users/
├── users.controller.ts
├── users.service.ts
└── users.repository.ts



5. TECH STACK (Estándar Enero 2026)

Package Manager: pnpm (Estricto).

Backend: Node.js (v24+ LTS) + NestJS (v11+).

Lenguaje: TypeScript (Strict Mode).

Base de Datos: PostgreSQL 17+.

ORM: TypeORM (solo para migraciones y escrituras complejas no críticas).

Query: SQL Crudo / Kysely (para lecturas críticas <40ms).

Caché: Redis 7+ (Cluster Mode recomendado).

Fechas: date-fns v4+ (o Temporal API si está disponible).

Frontend Admin: React 19 + Vite + Tailwind CSS v4.

Mobile App: React Native (New Architecture) + Expo SDK 52+.

6. REGLAS DE ORO (THE 9 GOLDEN RULES)

Regla 1: Paranoia de Tipado

❌ JAMÁS uses any.

✅ Usa DTOs validados (class-validator) para toda entrada externa.

Regla 2: Desacoplamiento Inteligente

❌ Nunca hagas new Service().

✅ En el Core Hexagonal, inyecta Interfaces (Puertos). En Vertical Slices, inyecta Servicios directos (Pragmatismo).

Regla 3: Manejo de Errores (Fail Safe)

❌ No dejes que la app explote (Crash).

✅ Lanza Excepciones de Dominio (StockInsufficientException) y mapéalas en un Filtro Global.

Regla 4: Logs Semánticos

❌ console.log(err)

✅ logger.error('Error pago', { traceId, userId, error }).

Regla 5: Comentarios Pedagógicos ("Por Qué")

Explica la decisión arquitectónica, no el código obvio.

Ej: // Usamos Lua Script aquí para atomicidad en Redis.

Regla 6: TDD Light

Escribe primero el Test Unitario del "Happy Path" para lógica crítica de Aduana.

Regla 7: Convenciones

Archivos: kebab-case.

Clases: PascalCase.

Interfaces: I + PascalCase.

Commits: Conventional Commits (feat:, fix:).

Regla 8: Manejo Financiero (NO FLOAT)

❌ Prohibido float o double para dinero.

✅ Usa DECIMAL(10, 2) en SQL. Usa enteros (centavos) en JS.

Regla 9: Multi-Tenancy Lógico

✅ OBLIGATORIO: Columna location_id en tablas Stock, Devices y Transactions.

7. COMANDOS FRECUENTES (Fly.io + pnpm)

Nota: Usar ; como separador en PowerShell.

Instalar: pnpm install

Backend Dev: pnpm start:dev

Tests: pnpm test:cov

Deploy: fly deploy

Logs: fly logs

Secrets: fly secrets set KEY=VALUE

8. DOCUMENTACIÓN VIVA

Swagger: Decoradores @ApiProperty obligatorios en DTOs.

Diagramas: Usar Mermaid.js si se requiere explicación visual.