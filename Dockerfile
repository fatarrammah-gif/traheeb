FROM node:20-slim

# Build tools required by native modules (argon2, canvas, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY apps/web/package.json apps/web/package-lock.json apps/web/.npmrc apps/web/

# Show native-module build results so we can detect silent failures
RUN npm install --legacy-peer-deps --prefix apps/web 2>&1 | tail -40

COPY . .

WORKDIR /app/apps/web
RUN npm run build 2>&1

# ── Diagnostics ────────────────────────────────────────────────────────────────
RUN echo "=== build/ tree ===" && find build/ -type f | sort | head -80
RUN echo "=== build/server/index.js ===" && cat build/server/index.js
RUN echo "=== build/server/assets/ ===" && ls -la build/server/assets/ 2>/dev/null || echo "(no assets dir)"

# Fail the image build loudly if the Hono server bundle is absent
RUN ls build/server/assets/*.js >/dev/null 2>&1 || \
    (echo "FATAL: react-router-hono-server did not bundle __create/index.ts." \
     "SSR build may have failed — check npm-install and vite-build output above." \
     && exit 1)

EXPOSE 3000
CMD ["node", "build/server/index.js"]
