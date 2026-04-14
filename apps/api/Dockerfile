FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

FROM base AS development
ENV NODE_ENV=development
COPY . .
RUN npm install
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma
CMD ["npm", "run", "dev"]

FROM base AS builder
ENV NODE_ENV=production
COPY . .
RUN npm install --omit=dev
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl dumb-init
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/packages/database/prisma ./packages/database/prisma
ENV NODE_ENV=production
USER nestjs
EXPOSE 4000
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/main"]
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/v1/health || exit 1
