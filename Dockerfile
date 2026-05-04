FROM node:20-slim

WORKDIR /app

# Copy full monorepo so shared/ is available at /app/shared/
COPY . .

# Install and build from apps/web where the actual package.json lives
WORKDIR /app/apps/web
RUN npm install --legacy-peer-deps
RUN npm run build

EXPOSE 3000

CMD ["node", "/app/apps/web/build/server/index.js"]
