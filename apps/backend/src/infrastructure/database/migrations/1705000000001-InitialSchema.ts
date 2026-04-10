import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ============================================================================
 * SMART_RETAIL - Initial Migration
 * ============================================================================
 * Migración inicial que crea todas las tablas del esquema SMART_RETAIL.
 * 
 * TABLAS CREADAS:
 * 1. users       - Usuarios del sistema (consumidores, merchants, operadores)
 * 2. products    - Productos/servicios disponibles
 * 3. devices     - Dispositivos IoT (torniquetes, máquinas, etc.)
 * 4. transactions - Historial de transacciones
 * 5. audit.audit_logs - Logs de auditoría (esquema separado)
 * 
 * NOTAS DE DISEÑO:
 * - Todos los montos en centavos (Regla 8 del SRS)
 * - Columna location_id en tablas relevantes (Single-Tenant Multi-Location)
 * - Índices optimizados para queries del Critical Path (<200ms)
 * ============================================================================
 */
export class InitialSchema1705000000001 implements MigrationInterface {
  name = 'InitialSchema1705000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ═══════════════════════════════════════════════════════════════════════
    // EXTENSIONES
    // ═══════════════════════════════════════════════════════════════════════
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // ═══════════════════════════════════════════════════════════════════════
    // ESQUEMA DE AUDITORÍA
    // ═══════════════════════════════════════════════════════════════════════
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS audit`);

    // ═══════════════════════════════════════════════════════════════════════
    // TABLA: users
    // ═══════════════════════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying(255) NOT NULL,
        "full_name" character varying(255) NOT NULL,
        "password_hash" character varying(255) NOT NULL,
        "role" character varying(50) NOT NULL DEFAULT 'consumer',
        "wallet_balance_cents" integer NOT NULL DEFAULT 0,
        "location_id" uuid NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "last_login_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "CHK_users_role" CHECK (
          role IN ('consumer', 'merchant', 'operator', 'admin')
        ),
        CONSTRAINT "CHK_users_wallet_balance" CHECK (wallet_balance_cents >= 0)
      )
    `);

    // Índices para users
    await queryRunner.query(`
      CREATE INDEX "IDX_users_location_id" ON "users" ("location_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_users_email" ON "users" ("email")
    `);

    // ═══════════════════════════════════════════════════════════════════════
    // TABLA: products
    // ═══════════════════════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sku" character varying(100) NOT NULL,
        "name" character varying(255) NOT NULL,
        "description" text,
        "price_cents" integer NOT NULL,
        "stock_quantity" integer NOT NULL DEFAULT 0,
        "low_stock_threshold" integer NOT NULL DEFAULT 5,
        "location_id" uuid NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "version" integer NOT NULL DEFAULT 1,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_products" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_products_sku" UNIQUE ("sku"),
        CONSTRAINT "CHK_products_price" CHECK (price_cents >= 0),
        CONSTRAINT "CHK_products_stock" CHECK (stock_quantity >= 0)
      )
    `);

    // Índices para products
    await queryRunner.query(`
      CREATE INDEX "IDX_products_location_id" ON "products" ("location_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_products_sku" ON "products" ("sku")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_products_active_location" ON "products" ("location_id", "is_active")
      WHERE is_active = true
    `);

    // ═══════════════════════════════════════════════════════════════════════
    // TABLA: devices
    // ═══════════════════════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE "devices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "serial_number" character varying(100) NOT NULL,
        "name" character varying(255) NOT NULL,
        "type" character varying(50) NOT NULL,
        "status" character varying(50) NOT NULL DEFAULT 'offline',
        "location_id" uuid NOT NULL,
        "firmware_version" character varying(50),
        "last_heartbeat_at" TIMESTAMP,
        "config_json" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_devices" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_devices_serial" UNIQUE ("serial_number"),
        CONSTRAINT "CHK_devices_type" CHECK (
          type IN ('turnstile', 'vending_machine', 'smart_shelf', 'pos_terminal', 'access_gate', 'other')
        ),
        CONSTRAINT "CHK_devices_status" CHECK (
          status IN ('online', 'offline', 'maintenance', 'error')
        )
      )
    `);

    // Índices para devices
    await queryRunner.query(`
      CREATE INDEX "IDX_devices_location_id" ON "devices" ("location_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_devices_status" ON "devices" ("status")
      WHERE status = 'online'
    `);

    // ═══════════════════════════════════════════════════════════════════════
    // TABLA: transactions
    // ═══════════════════════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "device_id" uuid NOT NULL,
        "product_id" uuid,
        "location_id" uuid NOT NULL,
        "amount_cents" integer NOT NULL DEFAULT 0,
        "quantity" integer NOT NULL DEFAULT 1,
        "status" character varying(50) NOT NULL DEFAULT 'pending',
        "trace_id" character varying(255) NOT NULL,
        "failure_reason" text,
        "payment_external_id" character varying(255),
        "payment_gateway" character varying(100),
        "payment_method" character varying(100),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "completed_at" TIMESTAMP,
        CONSTRAINT "PK_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_transactions_trace" UNIQUE ("trace_id"),
        CONSTRAINT "FK_transactions_user" FOREIGN KEY ("user_id") 
          REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_transactions_device" FOREIGN KEY ("device_id") 
          REFERENCES "devices"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_transactions_product" FOREIGN KEY ("product_id") 
          REFERENCES "products"("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_transactions_status" CHECK (
          status IN ('pending', 'paid', 'completed', 'failed', 'refunded', 'refunded_hardware_failure')
        ),
        CONSTRAINT "CHK_transactions_amount" CHECK (amount_cents >= 0),
        CONSTRAINT "CHK_transactions_quantity" CHECK (quantity > 0)
      )
    `);

    // Índices para transactions (optimizados para Critical Path)
    await queryRunner.query(`
      CREATE INDEX "IDX_transactions_user_id" ON "transactions" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_transactions_device_id" ON "transactions" ("device_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_transactions_location_date" ON "transactions" ("location_id", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_transactions_status" ON "transactions" ("status")
      WHERE status = 'pending'
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_transactions_trace_id" ON "transactions" ("trace_id")
    `);

    // ═══════════════════════════════════════════════════════════════════════
    // TABLA: audit.audit_logs
    // ═══════════════════════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE "audit"."audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "entity_type" character varying(100) NOT NULL,
        "entity_id" uuid NOT NULL,
        "action" character varying(50) NOT NULL,
        "old_value" jsonb,
        "new_value" jsonb,
        "user_id" uuid,
        "ip_address" character varying(45),
        "user_agent" text,
        "trace_id" character varying(255),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_audit_action" CHECK (
          action IN ('CREATE', 'UPDATE', 'DELETE', 'ACCESS', 'LOGIN', 'LOGOUT')
        )
      )
    `);

    // Índices para audit_logs
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_entity" ON "audit"."audit_logs" ("entity_type", "entity_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_user_id" ON "audit"."audit_logs" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_created_at" ON "audit"."audit_logs" ("created_at" DESC)
    `);

    // ═══════════════════════════════════════════════════════════════════════
    // FUNCIONES Y TRIGGERS (Auto-update updated_at)
    // ═══════════════════════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);

    // Trigger para users
    await queryRunner.query(`
      CREATE TRIGGER trigger_users_updated_at
      BEFORE UPDATE ON "users"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `);

    // Trigger para products
    await queryRunner.query(`
      CREATE TRIGGER trigger_products_updated_at
      BEFORE UPDATE ON "products"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `);

    // Trigger para devices
    await queryRunner.query(`
      CREATE TRIGGER trigger_devices_updated_at
      BEFORE UPDATE ON "devices"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `);

    // Trigger para transactions
    await queryRunner.query(`
      CREATE TRIGGER trigger_transactions_updated_at
      BEFORE UPDATE ON "transactions"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar triggers
    await queryRunner.query(`DROP TRIGGER IF EXISTS trigger_transactions_updated_at ON "transactions"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trigger_devices_updated_at ON "devices"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trigger_products_updated_at ON "products"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trigger_users_updated_at ON "users"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column`);

    // Eliminar tablas en orden inverso (por foreign keys)
    await queryRunner.query(`DROP TABLE IF EXISTS "audit"."audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "devices"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);

    // Eliminar esquema
    await queryRunner.query(`DROP SCHEMA IF EXISTS audit`);
  }
}
