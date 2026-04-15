# 🚀 SGCI — Guía Completa de Publicación

## Resumen de opciones (de más fácil a más control)

| Opción | Dificultad | Costo/mes | Control | Recomendado para |
|---|---|---|---|---|
| **Railway** | ⭐ Muy fácil | ~$25–60 USD | Bajo | Demo / staging rápido |
| **Render** | ⭐⭐ Fácil | ~$40–80 USD | Medio | MVP sin DevOps |
| **Fly.io** | ⭐⭐⭐ Medio | ~$30–70 USD | Alto | Producción global |
| **VPS propio** | ⭐⭐⭐⭐ Avanzado | ~$20–50 USD | Total | **Producción recomendada** |
| **AWS/GCP/Azure** | ⭐⭐⭐⭐⭐ Experto | ~$100–300 USD | Total | Escala grande |

---

## Opción 1: Railway (más rápido — 30 minutos)

Railway detecta el monorepo y despliega cada app automáticamente.

### Paso a paso

```bash
# 1. Instalar CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Crear proyecto
railway init
# Nombre: sgci-clinica

# 4. Agregar servicios de infraestructura (desde Railway Dashboard)
# Plugins: PostgreSQL + Redis

# 5. Configurar variables de entorno en el Dashboard:
# Settings > Variables > Raw Editor → pegar contenido del .env con valores reales

# 6. Conectar el repo y deployar
railway up
```

### Variables críticas para Railway
```env
DATABASE_URL=${{Postgres.DATABASE_URL}}    # Railway las inyecta automáticamente
REDIS_URL=${{Redis.REDIS_URL}}
JWT_SECRET=<64 caracteres aleatorios>
ENCRYPTION_KEY=<32 caracteres aleatorios>
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://sgci-api.railway.app
```

### Limitaciones de Railway
- Sin MinIO nativo → usar **AWS S3** o **Cloudflare R2** para archivos
- RabbitMQ no es plugin nativo → usar **CloudAMQP** (plan free hasta 1M mensajes/mes)
- Dominios custom requieren plan Pro ($20/mes)

---

## Opción 2: Render (recomendado para MVP sin DevOps)

### Servicios a crear en render.com

**1. Base de datos PostgreSQL**
- New → PostgreSQL
- Plan: Standard ($20/mes, 1 GB RAM)
- Region: Oregon (o el más cercano)
- Guardar: Internal Database URL

**2. Redis**
- New → Redis
- Plan: Starter ($10/mes)

**3. API (Web Service)**
- New → Web Service
- Connect your GitHub repo
- Root Directory: `apps/api`
- Runtime: Docker
- Dockerfile Path: `apps/api/Dockerfile`
- Plan: Standard ($25/mes)
- Environment Variables: (ver `.env.example`)

**4. Staff Web (Static Site o Web Service)**
- New → Web Service
- Root Directory: `apps/web`
- Runtime: Docker
- Plan: Starter ($7/mes)

**5. Portal Paciente (Static Site o Web Service)**
- New → Web Service
- Root Directory: `apps/portal`
- Runtime: Docker
- Plan: Starter ($7/mes)

**Costo total Render: ~$69/mes**

---

## Opción 3: VPS propio ⭐ RECOMENDADO PARA PRODUCCIÓN

### Especificaciones mínimas recomendadas
```
CPU:    4 vCPU
RAM:    8 GB
Disco:  100 GB SSD (NVMe preferido)
OS:     Ubuntu 22.04 LTS
Red:    100 Mbps
Backup: Diario automático
```

### Proveedores VPS en México / Latinoamérica
| Proveedor | Precio/mes | Datacenter | Notas |
|---|---|---|---|
| **DigitalOcean** | $48 USD (4vCPU/8GB) | NYC/Toronto | Más fácil, buena doc |
| **Linode/Akamai** | $48 USD | Dallas | Confiable |
| **Hetzner** | €15 EUR (~$17 USD) | Alemania/Finlandia | Más barato, datos en EU |
| **Vultr** | $48 USD | Miami/Dallas | Latencia buena desde MX |
| **AWS Lightsail** | $40 USD | us-east-1 | Integración AWS |
| **TelMex Cloud** | ~$800 MXN | CDMX | Datos en México |
| **Axtel** | ~$1000 MXN | Monterrey | Datos en México |

> **Para cumplimiento LFPDPPP**: si los datos deben estar en México, usar TelMex Cloud o Axtel.
> Para mayoría de clínicas privadas, DigitalOcean/Vultr son suficientes.

### Instalación completa en VPS Ubuntu 22.04

```bash
# ─── 1. Conectar al servidor ──────────────────────────────
ssh root@IP_DEL_SERVIDOR

# ─── 2. Actualizar sistema ────────────────────────────────
apt update && apt upgrade -y

# ─── 3. Instalar Docker ───────────────────────────────────
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# Verificar:
docker --version   # Docker 24.x+
docker compose version  # Docker Compose 2.x+

# ─── 4. Crear usuario no-root ─────────────────────────────
useradd -m -s /bin/bash sgci
usermod -aG docker sgci
mkdir -p /opt/sgci /opt/backups/sgci
chown -R sgci:sgci /opt/sgci /opt/backups/sgci

# ─── 5. Firewall ──────────────────────────────────────────
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (redirect a HTTPS)
ufw allow 443/tcp   # HTTPS
ufw enable

# ─── 6. Clonar el proyecto ────────────────────────────────
su - sgci
cd /opt/sgci
git clone https://github.com/tu-org/sgci.git .

# ─── 7. Configurar variables de entorno ───────────────────
cp .env.example .env
nano .env   # Editar con valores reales

# Generar claves seguras:
node -e "require('crypto').randomBytes(64).toString('hex')" # JWT_SECRET
node -e "require('crypto').randomBytes(64).toString('hex')" # JWT_REFRESH_SECRET
node -e "require('crypto').randomBytes(32).toString('hex')" # ENCRYPTION_KEY

# ─── 8. SSL con Certbot (Let's Encrypt — gratis) ──────────
exit   # Volver a root
apt install certbot python3-certbot-nginx -y

certbot certonly --standalone \
  -d api.clinica.mx \
  -d app.clinica.mx \
  -d portal.clinica.mx \
  --email admin@clinica.mx \
  --agree-tos \
  --non-interactive

# Copiar certificados donde Nginx los espera:
mkdir -p /opt/sgci/docker/ssl
cp /etc/letsencrypt/live/api.clinica.mx/fullchain.pem /opt/sgci/docker/ssl/clinica.mx.crt
cp /etc/letsencrypt/live/api.clinica.mx/privkey.pem   /opt/sgci/docker/ssl/clinica.mx.key

# Renovación automática (cada 90 días):
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && cp /etc/letsencrypt/live/api.clinica.mx/fullchain.pem /opt/sgci/docker/ssl/clinica.mx.crt && cp /etc/letsencrypt/live/api.clinica.mx/privkey.pem /opt/sgci/docker/ssl/clinica.mx.key && docker exec sgci-nginx nginx -s reload") | crontab -

# ─── 9. Primer deploy ────────────────────────────────────
su - sgci
cd /opt/sgci

# Levantar infraestructura
npm run docker:up

# Preparar base de datos
bash scripts/setup-db.sh

# Levantar con overlay de producción
docker compose -f docker/docker-compose.yml \
               -f docker/docker-compose.prod.yml \
               up -d

# ─── 10. Verificar que todo funciona ─────────────────────
curl -s https://api.clinica.mx/api/v1/health | python3 -m json.tool
# Debe mostrar: "status": "ok"

# ─── 11. Configurar backup automático ────────────────────
cat >> /etc/cron.d/sgci-backup << 'EOF'
# Backup diario BD a las 2:00 AM
0 2 * * * sgci cd /opt/sgci && docker compose -f docker/docker-compose.yml exec -T postgres pg_dump -U sgci_user sgci | gzip > /opt/backups/sgci/sgci_$(date +\%Y\%m\%d).sql.gz
# Mantener 30 días de backups
30 2 * * * sgci find /opt/backups/sgci -name "*.sql.gz" -mtime +30 -delete
EOF
```

### DNS en el dominio (ej: cPanel, Cloudflare, GoDaddy)

```
Tipo   Nombre              Valor
A      api.clinica.mx      → IP_DEL_SERVIDOR
A      app.clinica.mx      → IP_DEL_SERVIDOR
A      portal.clinica.mx   → IP_DEL_SERVIDOR
```

---

## Opción 4: Fly.io (buena alternativa a VPS)

```bash
# Instalar CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Lanzar API
cd apps/api
fly launch --name sgci-api --region mia  # Miami — mejor latencia desde MX
fly secrets set JWT_SECRET="..." ENCRYPTION_KEY="..." DATABASE_URL="..."
fly deploy

# Lanzar Web
cd ../web
fly launch --name sgci-web --region mia
fly secrets set NEXT_PUBLIC_API_URL="https://sgci-api.fly.dev"
fly deploy

# Lanzar Portal
cd ../portal
fly launch --name sgci-portal --region mia
fly deploy

# PostgreSQL en Fly
fly postgres create --name sgci-db --region mia --initial-cluster-size 1
fly postgres attach --app sgci-api sgci-db

# Redis en Fly
fly redis create --name sgci-redis --region mia
```

---

## Checklist final antes de publicar

```bash
# En el servidor de producción, ejecutar:
bash scripts/setup-db.sh    # BD configurada

# Verificar todos los servicios:
docker compose ps            # Todos "healthy"
curl https://api.clinica.mx/api/v1/health   # {"status":"ok"}
curl https://app.clinica.mx                  # HTML del login
curl https://portal.clinica.mx              # HTML del portal

# Primer timbrado de prueba CFDI:
# 1. Crear paciente demo
# 2. Crear cita y completarla
# 3. Emitir factura y timbrar
# Si uuid aparece → PAC productivo funcionando ✅

# Activar monitoreo:
docker compose --profile monitoring up -d
# Grafana: https://monitor.clinica.mx (usuario: admin)
```

---

## Costos estimados de producción

### Opción económica (VPS $48/mes)
```
VPS DigitalOcean 4vCPU/8GB:    $48 USD/mes
Dominio (.mx):                  $400 MXN/año
SSL Let's Encrypt:              $0 (gratis)
SendGrid (100K emails/mes):     $0 plan free → $25 si escala
Daily.co telemedicina:          $0 hasta 1000 min/mes → $15 si escala
PAC CFDI:                       ~$800–1500 MXN/mes según PAC
─────────────────────────────────────────────
TOTAL:                          ~$1,300–2,500 MXN/mes
```

### Opción robusta (2 VPS + CDN)
```
VPS primario 8vCPU/16GB:        $96 USD/mes
VPS backup (replica BD):        $48 USD/mes
Cloudflare Pro (CDN+WAF):       $20 USD/mes
─────────────────────────────────────────────
TOTAL:                          ~$3,200–4,000 MXN/mes
```
