# SmartRetail — Reglas de negocio y decisiones de arquitectura

> Notas de diseño del backend. Documenta **lo que el sistema implementa**, no una
> lista de deseos.

## Contexto

SmartRetail valida una operación de retail —**stock, pago e identidad**— en un
único camino crítico y luego acciona hardware físico (molinetes, lockers,
expendedoras) por WebSocket. Está pensado para el mercado argentino y sus
pasarelas locales (MercadoPago, MODO).

## Arquitectura

**Núcleo hexagonal para el camino crítico.** El dominio (`domain/`) es puro
(entidades, value objects, excepciones); la aplicación (`application/`) orquesta
a través de puertos; la infraestructura (`infrastructure/`) implementa los
adapters (TypeORM, Redis, WebSocket, pasarelas de pago). El caso de uso central
es `ProcessAccessService`.

Los módulos de soporte (usuarios, productos, dispositivos) son más directos:
controller → repositorio, sin puertos ni adapters. No todo necesita hexágono.

## Consistencia de stock (anti-sobreventa)

Tres controles independientes, en cache y en base:

1. **Lock distribuido en Redis** (`SET NX EX`): un solo comprador por
   producto/ubicación a la vez.
2. **Decremento atómico con Lua**: `DECRBY` + validación en un único round-trip;
   si el stock quedaría negativo, se rechaza la venta.
3. **Optimistic locking en Postgres**: la escritura de stock usa una columna
   `version` (`UPDATE ... WHERE version = :esperada`).

Redis funciona como cache de lecturas rápidas; Postgres es la fuente de verdad.

## Rollback compensatorio

`ProcessAccessService` corre *validación de QR → lock de stock → cobro → ACK de
hardware* como un solo flujo. Si el hardware no confirma **después** de que se
cobró, el sistema hace refund del pago, devuelve el stock y marca la transacción
`REFUNDED_HW_FAILURE`. La plata no sale sin que se abra la puerta.

## Manejo de dinero

Todos los montos son **enteros en centavos** (nunca `float`/`double`), tanto en
JS (value object `Money`) como en la base (`*_cents integer`). Así se evitan los
errores de precisión de punto flotante en el camino de pagos.

## Multi-ubicación

Columna `location_id` en `users`, `products`, `devices` y `transactions` para
segmentar por sucursal. Es multi-ubicación de un mismo tenant, no aislamiento
multi-tenant.

## Seguridad

- **Autenticación:** Access Token JWT firmado con RS256 (15 min) + refresh token
  opaco, guardado hasheado en Redis, rotado en cada uso y revocable por sesión.
- **Validación de entrada:** DTOs con `class-validator` en toda la superficie
  HTTP (`whitelist` + `forbidNonWhitelisted`).
- **Errores:** excepciones de dominio mapeadas por un filtro global — stack
  interno para el log, mensaje seguro para el cliente.
- **Passwords:** bcrypt con salt por password y cost configurable (`BCRYPT_COST`).
- **Secretos:** solo por variables de entorno; nunca hardcodeados.

## Convenciones de código

- Archivos en `kebab-case`, clases en `PascalCase`, interfaces con prefijo `I`.
- Commits convencionales (`feat:`, `fix:`, `chore:`, ...).
- Comentarios que explican el *por qué* de una decisión, no el *qué* obvio.

## Stack

Node.js + NestJS 11 · TypeScript (strict) · PostgreSQL 17 (TypeORM) · Redis 7
(ioredis) · WebSockets (Socket.io) · Jest. Monorepo pnpm + Turborepo: backend +
admin web (React + Vite) + app móvil (React Native / Expo).
