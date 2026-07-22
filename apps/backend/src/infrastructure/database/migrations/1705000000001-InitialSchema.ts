import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ============================================================================
 * SMART_RETAIL - Initial Migration
 * ============================================================================
 * Migración inicial que crea todas las tablas del esquema SMART_RETAIL.
 *
 * TABLAS CREADAS:
 * 1. users              - Usuarios del sistema (consumidores, merchants, operadores)
 * 2. products           - Productos/servicios disponibles
 * 3. devices            - Dispositivos IoT (molinetes, lockers, etc.)
 * 4. transactions       - Historial de transacciones (Aduana de Control)
 * 5. audit.audit_logs   - Logs de auditoría append-only (esquema separado)
 *
 * NOTAS DE DISEÑO:
 * - Este esquema es un espejo 1:1 de las entidades ORM (*.orm-entity.ts):
 *   mismas columnas, mismos tipos (timestamptz), los mismos enums nativos de
 *   Postgres y los mismos índices. `typeorm schema:log` no reporta cambios
 *   pendientes, así que la app corre SIN `synchronize`.
 * - Todos los montos en centavos (integer), nunca decimal.
 * - Los enums son tipos nativos de Postgres con exactamente los mismos valores
 *   (y orden) que los enums TypeScript de cada entidad.
 *
 * NOTA (endurecimiento futuro): a propósito NO agregamos aquí FKs ni CHECK
 * constraints, porque no forman parte de la metadata de las entidades y
 * romperían la sincronización. La forma correcta de reintroducirlos es
 * declararlos en las entidades (@Check, relaciones @ManyToOne) para que el
 * esquema los siga incluyendo sin desincronizarse.
 * ============================================================================
 */
export class InitialSchema1705000000001 implements MigrationInterface {
  name = 'InitialSchema1705000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ═══════════════════════════════════════════════════════════════════════
    // EXTENSIONES + ESQUEMA DE AUDITORÍA (idempotentes: el init de Docker ya
    // los crea, pero los repetimos para Postgres levantados a mano).
    // ═══════════════════════════════════════════════════════════════════════
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS audit`);

    // ═══════════════════════════════════════════════════════════════════════
    // TIPOS ENUM (espejo de los enums TypeScript de las entidades)
    // ═══════════════════════════════════════════════════════════════════════
    await queryRunner.query(
      `CREATE TYPE "public"."products_status_enum" AS ENUM('ACTIVE', 'PAUSED', 'DISCONTINUED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."devices_type_enum" AS ENUM('TURNSTILE', 'LOCKER', 'DOOR', 'KIOSK')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."devices_status_enum" AS ENUM('ONLINE', 'OFFLINE', 'MAINTENANCE', 'COMPROMISED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_status_enum" AS ENUM('PENDING', 'IN_PROCESS', 'PAID', 'COMPLETED', 'FAILED', 'REFUNDED_HW_FAILURE', 'REFUNDED_MANUAL', 'CANCELLED', 'EXPIRED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_payment_gateway_enum" AS ENUM('MERCADOPAGO', 'MODO')`,
    );
    await queryRunner.query(
      `CREATE TYPE "audit"."audit_logs_event_type_enum" AS ENUM('TRANSACTION_CREATED', 'TRANSACTION_PAID', 'TRANSACTION_COMPLETED', 'TRANSACTION_FAILED', 'TRANSACTION_REFUNDED', 'USER_LOGIN', 'USER_LOGOUT', 'USER_LOGIN_FAILED', 'TOKEN_REFRESHED', 'TOKEN_REVOKED', 'DEVICE_CONNECTED', 'DEVICE_DISCONNECTED', 'DEVICE_COMMAND_SENT', 'DEVICE_OPENED', 'DEVICE_COMPROMISED', 'SECURITY_BREACH', 'FORCED_ACCESS_DETECTED', 'RATE_LIMIT_EXCEEDED', 'ADMIN_FORCE_OPEN', 'ADMIN_STOCK_ADJUSTMENT', 'ADMIN_DEVICE_MAINTENANCE', 'ADMIN_REFUND_MANUAL', 'SYSTEM_STARTUP', 'SYSTEM_ERROR')`,
    );
    await queryRunner.query(
      `CREATE TYPE "audit"."audit_logs_severity_enum" AS ENUM('INFO', 'WARNING', 'ERROR', 'CRITICAL')`,
    );

    // ═══════════════════════════════════════════════════════════════════════
    // TABLA: users  (↔ UserOrmEntity)
    // ═══════════════════════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying(255) NOT NULL,
        "password_hash" character varying(255) NOT NULL,
        "wallet_balance_cents" integer NOT NULL DEFAULT 0,
        "full_name" character varying(255) NOT NULL,
        "role" character varying(20) NOT NULL DEFAULT 'consumer',
        "location_id" uuid NOT NULL,
        "phone_number" character varying(50),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "last_login_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_USER_EMAIL" ON "users" ("email")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_USER_LOCATION" ON "users" ("location_id")`,
    );

    // ═══════════════════════════════════════════════════════════════════════
    // TABLA: products  (↔ ProductOrmEntity)
    // ═══════════════════════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sku" character varying(100) NOT NULL,
        "name" character varying(255) NOT NULL,
        "description" text,
        "price_cents" integer NOT NULL,
        "stock_quantity" integer NOT NULL DEFAULT 0,
        "low_stock_threshold" integer NOT NULL DEFAULT 10,
        "is_active" boolean NOT NULL DEFAULT true,
        "location_id" uuid NOT NULL,
        "status" "public"."products_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "image_url" character varying(500),
        "category" character varying(100),
        "version" integer NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_products" PRIMARY KEY ("id")
      )
    `);
    // SKU único POR ubicación (mismo SKU puede existir en otra sucursal).
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_PRODUCT_SKU_LOCATION" ON "products" ("sku", "location_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_PRODUCT_LOCATION" ON "products" ("location_id")`,
    );

    // ═══════════════════════════════════════════════════════════════════════
    // TABLA: devices  (↔ DeviceOrmEntity)
    // ═══════════════════════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE "devices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "serial_number" character varying(100) NOT NULL,
        "name" character varying(255) NOT NULL,
        "type" "public"."devices_type_enum" NOT NULL,
        "status" "public"."devices_status_enum" NOT NULL DEFAULT 'OFFLINE',
        "location_id" uuid NOT NULL,
        "config" jsonb NOT NULL DEFAULT '{}',
        "device_token_hash" character varying(255),
        "last_heartbeat_at" TIMESTAMP WITH TIME ZONE,
        "mac_address" character varying(17),
        "firmware_version" character varying(50),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_devices" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_devices_serial" UNIQUE ("serial_number")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_DEVICE_SERIAL" ON "devices" ("serial_number")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_DEVICE_LOCATION" ON "devices" ("location_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_DEVICE_HEARTBEAT" ON "devices" ("last_heartbeat_at")`,
    );

    // ═══════════════════════════════════════════════════════════════════════
    // TABLA: transactions  (↔ TransactionOrmEntity)
    // ═══════════════════════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "device_id" uuid NOT NULL,
        "product_id" uuid,
        "location_id" uuid NOT NULL,
        "amount_cents" integer NOT NULL,
        "quantity" integer NOT NULL DEFAULT 1,
        "status" "public"."transactions_status_enum" NOT NULL DEFAULT 'PENDING',
        "external_payment_id" character varying(255),
        "payment_gateway" "public"."transactions_payment_gateway_enum",
        "payment_method" character varying(50),
        "response_code" character varying(100),
        "response_message" character varying(500),
        "trace_id" character varying(100) NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "completed_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_transactions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_TRANSACTION_USER" ON "transactions" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_TRANSACTION_DEVICE" ON "transactions" ("device_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_TRANSACTION_STATUS" ON "transactions" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_TRANSACTION_EXTERNAL_ID" ON "transactions" ("external_payment_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_TRANSACTION_TRACE" ON "transactions" ("trace_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_TRANSACTION_USER_DATE" ON "transactions" ("user_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_TRANSACTION_LOCATION_DATE" ON "transactions" ("location_id", "created_at")`,
    );

    // ═══════════════════════════════════════════════════════════════════════
    // TABLA: audit.audit_logs  (↔ AuditLogOrmEntity) — append-only
    // ═══════════════════════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE "audit"."audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_type" "audit"."audit_logs_event_type_enum" NOT NULL,
        "severity" "audit"."audit_logs_severity_enum" NOT NULL DEFAULT 'INFO',
        "entity_type" character varying(50) NOT NULL,
        "entity_id" uuid NOT NULL,
        "actor_id" uuid,
        "actor_type" character varying(20),
        "trace_id" character varying(100),
        "description" text,
        "payload" jsonb NOT NULL DEFAULT '{}',
        "ip_address" inet,
        "user_agent" character varying(500),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_AUDIT_EVENT_DATE" ON "audit"."audit_logs" ("event_type", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_AUDIT_ENTITY" ON "audit"."audit_logs" ("entity_type", "entity_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_AUDIT_ACTOR" ON "audit"."audit_logs" ("actor_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_AUDIT_TRACE" ON "audit"."audit_logs" ("trace_id")`,
    );

    // ═══════════════════════════════════════════════════════════════════════
    // FUNCIÓN + TRIGGERS: auto-update de updated_at (tablas mutables).
    // TypeORM no gestiona triggers, así que no afectan a schema:log; sirven
    // como red de seguridad para UPDATEs hechos por fuera del ORM.
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

    for (const table of ['users', 'products', 'devices', 'transactions']) {
      await queryRunner.query(`
        CREATE TRIGGER trigger_${table}_updated_at
        BEFORE UPDATE ON "${table}"
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Triggers + función
    for (const table of ['transactions', 'devices', 'products', 'users']) {
      await queryRunner.query(
        `DROP TRIGGER IF EXISTS trigger_${table}_updated_at ON "${table}"`,
      );
    }
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column`);

    // Tablas
    await queryRunner.query(`DROP TABLE IF EXISTS "audit"."audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "devices"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);

    // Tipos enum
    await queryRunner.query(`DROP TYPE IF EXISTS "audit"."audit_logs_severity_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "audit"."audit_logs_event_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."transactions_payment_gateway_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."transactions_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."devices_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."devices_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."products_status_enum"`);

    await queryRunner.query(`DROP SCHEMA IF EXISTS audit`);
  }
}
