ARG NODE_VERSION=24.21.0

FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# .next/cache ist Build-Cache (~95 MB), den `next start` nicht braucht. Mit ins
# Image kopiert, ändert er sich bei jedem Build und wird bei jedem Deploy neu
# übertragen.
RUN npm run build && rm -rf .next/cache

FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh \
  && mkdir -p /data/uploads && chown node:node /data/uploads
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
USER node
ENTRYPOINT ["./docker-entrypoint.sh"]
