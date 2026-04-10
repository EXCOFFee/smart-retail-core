-- ============================================================================
-- SMART_RETAIL - Script de Inicialización de PostgreSQL
-- ============================================================================
-- Este script se ejecuta automáticamente al crear el contenedor por primera vez.
-- Crea extensiones necesarias y configura el schema inicial.
-- ============================================================================

-- Habilitar extensión para UUIDs (uuid_generate_v4())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Habilitar extensión para búsquedas de texto (futuro)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Crear schema para auditoría (separado del schema principal)
CREATE SCHEMA IF NOT EXISTS audit;

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE '✅ SMART_RETAIL Database initialized successfully!';
    RAISE NOTICE '   - uuid-ossp extension enabled';
    RAISE NOTICE '   - pg_trgm extension enabled';
    RAISE NOTICE '   - audit schema created';
END $$;
