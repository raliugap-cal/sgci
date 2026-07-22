# 🚀 SGCI — Cómo correr localmente

## Prerequisitos
- Node.js 20+ → https://nodejs.org
- Docker Desktop → https://docker.com/products/docker-desktop

## Paso 1 — Instalar dependencias (una sola vez)
```bash
cd sgci
npm install
```

## Paso 2 — Levantar la base de datos
```bash
npm run docker:up
```
Esto levanta PostgreSQL, Redis, RabbitMQ y MinIO.
Espera ~20 segundos a que estén listos.

## Paso 3 — Preparar la base de datos (una sola vez)
```bash
# Generar Prisma Client
npx prisma generate --schema=packages/database/prisma/schema.prisma

# Crear tablas
npx prisma db push --schema=packages/database/prisma/schema.prisma

# Cargar datos iniciales
cd apps/api && npx ts-node src/database/seed.ts && cd ../..
```

## Paso 4 — Iniciar las 3 apps

**Abrir 3 terminales distintas:**

Terminal 1 — API:
```bash
cd apps/api
npm run dev
```

Terminal 2 — Staff App:
```bash
cd apps/web
npm run dev
```

Terminal 3 — Portal Paciente:
```bash
cd apps/portal
npm run dev
```

## URLs
| App | URL | Usuario |
|-----|-----|---------|
| API Swagger | http://localhost:4000/api/docs | — |
| Staff App | http://localhost:3000 | superadmin@clinicasgci.mx / Admin@SGCI2024! |
| Portal Paciente | http://localhost:3001 | — |
| MinIO (archivos) | http://localhost:9001 | sgci_minio / minio_dev_pass_2024 |
| RabbitMQ | http://localhost:15672 | sgci_rabbit / rabbit_dev_pass_2024 |

## Detener todo
```bash
npm run docker:down
```
