#!/bin/bash
# ═══════════════════════════════════════════════════════════
# deploy.sh — Script de deploy a producción/staging
# Uso: ./scripts/deploy.sh [production|staging]
# ═══════════════════════════════════════════════════════════
set -euo pipefail

ENTORNO="${1:-staging}"
REPO_DIR="/opt/sgci"
BACKUP_DIR="/opt/backups/sgci"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colores
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[$(date +%H:%M:%S)] ✅ $1${NC}"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠️  $1${NC}"; }
err()  { echo -e "${RED}[$(date +%H:%M:%S)] ❌ $1${NC}"; exit 1; }

echo ""
echo "🏥 SGCI — Deploy a ${ENTORNO^^}"
echo "======================================"
echo "Timestamp: $TIMESTAMP"
echo ""

# ─── 1. Verificar prerequisitos ───────────────────────────
log "Verificando prerequisitos..."
command -v docker >/dev/null || err "Docker no instalado"
command -v docker >/dev/null && docker compose version >/dev/null || err "Docker Compose no disponible"
[ -f "$REPO_DIR/.env" ] || err "Archivo .env no encontrado en $REPO_DIR"
mkdir -p "$BACKUP_DIR"

# ─── 2. Health check del sistema actual ───────────────────
log "Verificando estado actual..."
if docker compose -f "$REPO_DIR/docker/docker-compose.yml" ps | grep -q "healthy"; then
  log "Sistema actualmente saludable"
else
  warn "Algún servicio no está en estado healthy — continuando de todas formas"
fi

# ─── 3. Backup de base de datos ────────────────────────────
if [ "$ENTORNO" = "production" ]; then
  log "Haciendo backup de BD..."
  source "$REPO_DIR/.env"
  docker compose -f "$REPO_DIR/docker/docker-compose.yml" exec -T postgres \
    pg_dump -U sgci_user sgci > "$BACKUP_DIR/sgci_${TIMESTAMP}.sql" || warn "Backup falló — continuando"
  log "Backup guardado: sgci_${TIMESTAMP}.sql"

  # Mantener solo los últimos 10 backups
  ls -t "$BACKUP_DIR"/sgci_*.sql | tail -n +11 | xargs rm -f 2>/dev/null || true
fi

# ─── 4. Pull nuevas imágenes ───────────────────────────────
log "Descargando nuevas imágenes..."
cd "$REPO_DIR"
if [ "$ENTORNO" = "production" ]; then
  docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml pull api web portal
else
  docker compose -f docker/docker-compose.yml pull api web portal
fi

# ─── 5. Ejecutar migraciones ───────────────────────────────
log "Ejecutando migraciones de base de datos..."
docker compose -f "$REPO_DIR/docker/docker-compose.yml" run --rm api \
  npx prisma migrate deploy --schema=../../packages/database/prisma/schema.prisma \
  || err "Migración falló — deploy cancelado"
log "Migraciones aplicadas exitosamente"

# ─── 6. Rolling deploy ─────────────────────────────────────
log "Iniciando rolling deploy..."
if [ "$ENTORNO" = "production" ]; then
  # Producción: 2 réplicas con rollout gradual
  docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml \
    up -d --no-deps api
  log "API actualizada — esperando health check..."
  sleep 20

  # Verificar que la nueva API responde
  MAX_RETRIES=5; RETRY=0
  until curl -sf "http://localhost:4000/api/v1/health/live" >/dev/null; do
    RETRY=$((RETRY + 1))
    [ $RETRY -ge $MAX_RETRIES ] && err "API no responde después del deploy — rollback necesario"
    warn "API no responde aún... reintento $RETRY/$MAX_RETRIES"
    sleep 10
  done
  log "API responde OK"

  docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml \
    up -d --no-deps web portal nginx
else
  # Staging: deploy directo
  docker compose -f docker/docker-compose.yml up -d --no-deps api web portal
fi

# ─── 7. Verificación post-deploy ───────────────────────────
log "Verificando deploy..."
sleep 10

HEALTH=$(curl -sf "http://localhost:4000/api/v1/health" 2>/dev/null || echo "{}")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  log "✅ API health check: OK"
else
  warn "API health check no respondió — revisar logs: docker compose logs api"
fi

# ─── 8. Limpiar imágenes antiguas ─────────────────────────
log "Limpiando imágenes antiguas..."
docker image prune -f --filter "until=24h" 2>/dev/null || true

# ─── Resumen ──────────────────────────────────────────────
echo ""
echo "======================================"
log "🎉 Deploy a ${ENTORNO^^} completado"
echo ""
echo "   🌐 API:    https://api.clinica.mx/api/v1/health"
echo "   📊 Staff:  https://app.clinica.mx"
echo "   📱 Portal: https://portal.clinica.mx"
echo ""
echo "   📋 Logs:   docker compose logs -f api"
echo "   📊 Grafana: https://monitor.clinica.mx"
echo ""
