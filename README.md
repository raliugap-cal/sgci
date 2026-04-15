# 🏥 SGCI — Sistema de Gestión Clínica Integral

**México · NOM-004-SSA3 · NOM-028-SSA2 · CFDI 4.0 · LFPDPPP · COFEPRIS**

---

## 🚀 Arranque rápido

```bash
cp .env.example .env
npm run docker:up
npm install
bash scripts/setup-db.sh
npm run dev
```

| URL | Credencial |
|---|---|
| http://localhost:4000/api/docs | Swagger |
| http://localhost:3000 | superadmin@clinicasgci.mx / Admin@SGCI2024! |
| http://localhost:3001 | Portal paciente |

## 🧪 Tests

```bash
npm run test        # 80 tests unitarios
npm run test:e2e    # 18 tests de integración
k6 run scripts/load-test.js   # Load testing
```

## 📋 Go-Live

Ver [docs/GOLIVE-CHECKLIST.md](docs/GOLIVE-CHECKLIST.md)

## Stack

NestJS · Next.js 14 · PostgreSQL 16 · Prisma · Redis · MinIO · Daily.co · CFDI 4.0
