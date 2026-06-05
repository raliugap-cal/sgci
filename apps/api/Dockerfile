# ═══════════════════════════════════════════════════════════
# SGCI API — Dockerfile (contexto: raíz del monorepo)
# Railway build: docker build -f apps/api/Dockerfile .
# Desarrollador: Miguel Angel Perez
# ═══════════════════════════════════════════════════════════

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

# ─── Dependencias ─────────────────────────────────────────
FROM base AS deps
COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
RUN npm install --workspaces --if-present

# ─── Build ────────────────────────────────────────────────
FROM deps AS builder
COPY . .
RUN npx --yes prisma generate --schema=packages/database/prisma/schema.prisma
WORKDIR /app/apps/api
RUN npx --yes @nestjs/cli build

# ─── Producción ───────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl dumb-init
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules  ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/packages/database/prisma ./packages/database/prisma

ENV NODE_ENV=production
USER nestjs
EXPOSE 4000
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/main"]
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/v1/health || exit 1
