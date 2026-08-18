FROM node:22-alpine AS build
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm install --global pnpm@10.6.3 && pnpm install --frozen-lockfile=false
COPY apps/api ./apps/api
RUN pnpm --filter @collabflow/api build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S collab && adduser -S collab -G collab
COPY --from=build --chown=collab:collab /app/node_modules ./node_modules
COPY --from=build --chown=collab:collab /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=collab:collab /app/apps/api/dist ./apps/api/dist
USER collab
EXPOSE 4000
HEALTHCHECK --interval=20s --timeout=3s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:4000/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "apps/api/dist/server.js"]
