FROM node:22-slim

# Build tools for native modules (argon2, sharp, etc.)
# Chrome system libraries required by Puppeteer (whatsapp-web.js).
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    libglib2.0-0 libnss3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 \
    libx11-6 libxcb1 libxext6 libxfixes3 libxi6 libxrender1 \
    fonts-liberation wget ca-certificates \
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

# WhatsApp sessions are persisted in Neon DB via RemoteAuth + NeonAuthStore.
# No Railway Volume needed — sessions survive redeploys automatically.
EXPOSE 3000
CMD ["node", "--no-warnings", "build/server/index.js"]
