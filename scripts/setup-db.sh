#!/bin/bash
# ═══════════════════════════════════════════════════════════
# setup-db.sh — Configuración inicial de la base de datos
# Ejecutar UNA VEZ después de tener PostgreSQL corriendo
# ═══════════════════════════════════════════════════════════
set -e

echo "🔧 SGCI — Configuración inicial de base de datos"
echo "================================================="

# 1. Verificar que PostgreSQL esté corriendo
echo "1️⃣  Verificando PostgreSQL..."
if ! pg_isready -h localhost -p 5432 -U sgci_user 2>/dev/null; then
  echo "   PostgreSQL no está listo. ¿Corrió 'npm run docker:up'?"
  echo "   Ejecute: npm run docker:up && sleep 5 && ./scripts/setup-db.sh"
  exit 1
fi
echo "   ✅ PostgreSQL disponible"

# 2. Generar cliente Prisma
echo "2️⃣  Generando cliente Prisma..."
cd packages/database
npx prisma generate --schema=./prisma/schema.prisma
cd ../..
echo "   ✅ Cliente Prisma generado"

# 3. Ejecutar migraciones
echo "3️⃣  Ejecutando migraciones..."
cd packages/database
npx prisma migrate deploy --schema=./prisma/schema.prisma 2>/dev/null || \
  npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss
cd ../..
echo "   ✅ Esquema sincronizado"

# 4. Seed de datos iniciales
echo "4️⃣  Cargando datos iniciales..."
cd apps/api
npx ts-node -r tsconfig-paths/register src/database/seed.ts
cd ../..
echo "   ✅ Datos de catálogo cargados"

echo ""
echo "🎉 Base de datos lista"
echo ""
echo "   📊 Accesos:"
echo "   API:    http://localhost:4000/api/v1"
echo "   Swagger: http://localhost:4000/api/docs"
echo "   Staff:   http://localhost:3000"
echo "   Portal:  http://localhost:3001"
echo ""
echo "   🔑 Credenciales demo:"
echo "   Superadmin: superadmin@clinicasgci.mx / Admin@SGCI2024!"
echo "   Médico:     dr.rodriguez@clinicasgci.mx / Medico@2024!"
