FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

# ─── Install ALL deps (including devDeps needed to build) ──
FROM base AS deps
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/database/package*.json ./packages/database/
RUN npm install

# ─── Build ────────────────────────────────────────────────
FROM deps AS builder
COPY . .
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma
RUN npm run build -w @sgci/api

# ─── Production image (only runtime deps) ─────────────────
FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl dumb-init
RUN addgroup --system --gid 1001 nodejs
RUN adduser  --system --uid 1001 nestjs

# Copy only what's needed to run
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist            ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules             ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/packages/database/prisma ./packages/database/prisma

ENV NODE_ENV=production
USER nestjs
EXPOSE 4000
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/main"]
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/v1/health || exit 1
