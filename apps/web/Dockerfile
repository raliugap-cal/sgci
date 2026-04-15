FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS deps
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/database/package*.json ./packages/database/
RUN npm install

FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @sgci/web

FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs
RUN adduser  --system --uid 1001 nextjs
COPY --from=builder /app/apps/web/public                              ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone  ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static      ./apps/web/.next/static
ENV NODE_ENV=production PORT=3000 NEXT_TELEMETRY_DISABLED=1
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
