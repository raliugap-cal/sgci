-- ═══════════════════════════════════════════════════════════
-- SGCI — Migración inicial
-- Genera con: npx prisma migrate dev --name init
-- ═══════════════════════════════════════════════════════════

-- Este archivo es un placeholder.
-- La migración real se genera automáticamente con:
--
--   npx prisma migrate dev --schema=packages/database/prisma/schema.prisma --name init
--
-- O para despliegue sin interactividad:
--
--   npx prisma db push --schema=packages/database/prisma/schema.prisma
--
-- El archivo migration.sql resultante se almacenará en:
--   packages/database/prisma/migrations/{timestamp}_init/migration.sql

-- Extensiones requeridas en PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- Para búsqueda full-text en español

-- Configuración de locale para búsqueda
-- ALTER DATABASE sgci SET search_path TO public;
-- ALTER DATABASE sgci SET default_text_search_config TO 'spanish';
