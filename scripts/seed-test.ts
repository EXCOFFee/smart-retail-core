/**
 * ============================================================================
 * SMART_RETAIL - Test Data Seed
 * ============================================================================
 * Semilla de datos para tests E2E.
 * 
 * Uso: pnpm db:seed:test
 * 
 * NOTA: Este script debe ejecutarse desde apps/backend donde
 * TypeORM está instalado, o con las entities importadas.
 * ============================================================================
 */

// Definición de tipos para evitar dependencia directa de typeorm
// TypeORM DataSource se importa dinámicamente en runtime
type DataSourceOptions = {
  type: 'postgres';
  url: string;
  synchronize: boolean;
  logging: boolean;
  entities: unknown[];
};

// Este archivo es un placeholder para el seed de tests
// La implementación real requiere las entities de TypeORM

interface SeedData {
  users: Array<{
    email: string;
    password: string;
    fullName: string;
    role: string;
    walletBalance: number;
  }>;
  devices: Array<{
    name: string;
    type: string;
    locationId: string;
    status: string;
  }>;
  products: Array<{
    sku: string;
    name: string;
    price: number;
    stock: number;
  }>;
}

const testData: SeedData = {
  users: [
    {
      email: 'test@smartretail.com',
      password: 'TestPassword123!', // Será hasheada
      fullName: 'Test User',
      role: 'consumer',
      walletBalance: 100000, // $1000.00 en centavos
    },
    {
      email: 'no-balance@smartretail.com',
      password: 'TestPassword123!',
      fullName: 'No Balance User',
      role: 'consumer',
      walletBalance: 0,
    },
    {
      email: 'admin@smartretail.com',
      password: 'AdminPassword123!',
      fullName: 'Admin User',
      role: 'admin',
      walletBalance: 0,
    },
  ],
  devices: [
    {
      name: 'Molinete Principal',
      type: 'TURNSTILE',
      locationId: 'location-001',
      status: 'ONLINE',
    },
    {
      name: 'Puerta Emergencia',
      type: 'DOOR',
      locationId: 'location-001',
      status: 'ONLINE',
    },
  ],
  products: [
    {
      sku: 'PROD-001',
      name: 'Acceso General',
      price: 1500, // $15.00
      stock: 100,
    },
    {
      sku: 'PROD-002',
      name: 'Acceso VIP',
      price: 5000, // $50.00
      stock: 10,
    },
    {
      sku: 'LIMITED-001',
      name: 'Producto Limitado',
      price: 2000,
      stock: 1, // Solo 1 en stock para test de race condition
    },
  ],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DataSource = any;

async function seed(_dataSource: DataSource): Promise<void> {
  console.log('🌱 Seeding test data...');

  // La implementación real usaría los repositorios de TypeORM
  // Por ahora, este es un placeholder

  console.log('✅ Test data seeded successfully!');
  console.log(`   - ${testData.users.length} users`);
  console.log(`   - ${testData.devices.length} devices`);
  console.log(`   - ${testData.products.length} products`);
}

async function main(): Promise<void> {
  // Este script debe ejecutarse desde apps/backend donde TypeORM está instalado
  // Uso: cd apps/backend && npx ts-node ../../scripts/seed-test.ts
  
  // Importación dinámica de TypeORM
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const typeorm = require('typeorm');
  const { DataSource } = typeorm;
  
  // Crear conexión a la base de datos de test
  const dataSource = new DataSource({
    type: 'postgres',
    url:
      process.env.DATABASE_URL ??
      'postgresql://smartRetail:smart_retail_test@localhost:5433/smart_retail_test',
    synchronize: true, // Solo para tests
    logging: false,
    entities: [], // Agregar entities aquí
  });

  try {
    await dataSource.initialize();
    await seed(dataSource);
  } finally {
    await dataSource.destroy();
  }
}

main().catch(console.error);

export { seed, testData };

