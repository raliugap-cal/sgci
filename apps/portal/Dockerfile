FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS deps
COPY package*.json ./
COPY apps/portal/package*.json ./apps/portal/
COPY packages/database/package*.json ./packages/database/
RUN npm install

FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @sgci/portal

FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs
RUN adduser  --system --uid 1001 nextjs
COPY --from=builder /app/apps/portal/public                               ./apps/portal/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/portal/.next/standalone  ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/portal/.next/static      ./apps/portal/.next/static
ENV NODE_ENV=production PORT=3001 NEXT_TELEMETRY_DISABLED=1
USER nextjs
EXPOSE 3001
CMD ["node", "apps/portal/server.js"]
