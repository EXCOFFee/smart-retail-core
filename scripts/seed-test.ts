/**
 * ============================================================================
 * SMART_RETAIL - Seed de datos de test / desarrollo
 * ============================================================================
 * Inserta un set mínimo de datos para poder ejercitar la app end-to-end:
 * usuarios (con password hasheada en bcrypt), dispositivos y productos, todos
 * en una misma ubicación.
 *
 * Uso (desde apps/backend): pnpm db:seed:test
 * Requiere que las migraciones ya estén corridas (las tablas deben existir).
 *
 * IDEMPOTENTE: usa ON CONFLICT DO NOTHING, así que se puede correr varias veces
 * sin duplicar ni fallar.
 *
 * Conexión: lee las mismas variables que la app (DB_HOST, DB_PORT, ...), con
 * fallback a DATABASE_URL y por último a los defaults del docker-compose local.
 * ============================================================================
 */
import * as bcrypt from 'bcryptjs';
import { Client, ClientConfig } from 'pg';

/** Ubicación única compartida por usuarios, dispositivos y productos del seed. */
const LOCATION_ID = '550e8400-e29b-41d4-a716-446655440001';

/** Cost bajo: el seed no es sensible y así corre rápido en CI. */
const BCRYPT_COST = 10;

function resolveConnection(): ClientConfig {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  return {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USERNAME ?? 'smartRetail',
    password: process.env.DB_PASSWORD ?? 'smart_retail_secret_2026',
    database: process.env.DB_DATABASE ?? 'smart_retail_db',
  };
}

const USERS = [
  { email: 'test@smartretail.com', password: 'TestPassword123!', fullName: 'Test User', role: 'consumer', wallet: 100000 },
  { email: 'admin@smartretail.com', password: 'AdminPassword123!', fullName: 'Admin User', role: 'admin', wallet: 0 },
  { email: 'no-balance@smartretail.com', password: 'TestPassword123!', fullName: 'No Balance User', role: 'consumer', wallet: 0 },
];

const DEVICES = [
  { serial: 'SN-TEST-0001', name: 'Molinete Principal', type: 'TURNSTILE', status: 'ONLINE' },
  { serial: 'SN-TEST-0002', name: 'Locker A', type: 'LOCKER', status: 'ONLINE' },
];

const PRODUCTS = [
  { sku: 'PROD-001', name: 'Acceso General', price: 1500, stock: 100 },
  { sku: 'PROD-002', name: 'Acceso VIP', price: 5000, stock: 10 },
  { sku: 'LIMITED-001', name: 'Producto Limitado', price: 2000, stock: 1 },
];

async function main(): Promise<void> {
  const client = new Client(resolveConnection());
  await client.connect();

  try {
    await client.query('BEGIN');

    for (const u of USERS) {
      const passwordHash = bcrypt.hashSync(u.password, BCRYPT_COST);
      await client.query(
        `INSERT INTO "users"
           (email, password_hash, wallet_balance_cents, full_name, role, location_id, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         ON CONFLICT (email) DO NOTHING`,
        [u.email, passwordHash, u.wallet, u.fullName, u.role, LOCATION_ID],
      );
    }

    for (const d of DEVICES) {
      await client.query(
        `INSERT INTO "devices" (serial_number, name, type, status, location_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (serial_number) DO NOTHING`,
        [d.serial, d.name, d.type, d.status, LOCATION_ID],
      );
    }

    for (const p of PRODUCTS) {
      await client.query(
        `INSERT INTO "products" (sku, name, price_cents, stock_quantity, location_id, status, version)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE', 1)
         ON CONFLICT (sku, location_id) DO NOTHING`,
        [p.sku, p.name, p.price, p.stock, LOCATION_ID],
      );
    }

    await client.query('COMMIT');
    console.log(
      `✅ Seed OK: ${USERS.length} users, ${DEVICES.length} devices, ${PRODUCTS.length} products (location ${LOCATION_ID})`,
    );
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

void main();
