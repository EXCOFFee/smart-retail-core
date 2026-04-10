-- ============================================================================
-- SMART_RETAIL - Database Initialization Script
-- ============================================================================
-- Este script se ejecuta al crear el contenedor de PostgreSQL.
-- Crea extensiones necesarias y configuraciones iniciales.
-- ============================================================================

-- Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Comentario informativo
COMMENT ON DATABASE smart_retail_dev IS 'SMART_RETAIL - Smart Retail Platform (Development)';

-- Configuraciones de performance para desarrollo
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '512MB';
ALTER SYSTEM SET maintenance_work_mem = '128MB';
ALTER SYSTEM SET work_mem = '16MB';

-- Log de consultas lentas (> 1 segundo)
ALTER SYSTEM SET log_min_duration_statement = 1000;

-- Notificar configuración aplicada
DO $$
BEGIN
  RAISE NOTICE 'SMART_RETAIL Database initialized successfully!';
END $$;
