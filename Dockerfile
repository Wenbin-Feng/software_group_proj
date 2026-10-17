# Native SQLite dependencies are built on the GitHub Linux runner, not the VM.
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY . .
RUN npm ci && npm run build --workspace=@folio/api && npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3001 DATA_DIR=/data
WORKDIR /app
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=4s --start-period=20s --retries=4 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(async r=>{const h=await r.json();process.exit(r.ok&&h.status==='ok'&&h.version===process.env.APP_VERSION?0:1)}).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/server.js"]
