FROM node:20-slim

WORKDIR /repo

# Copy the full monorepo so shared/ is available during build
COPY . .

# Install and build the web app
WORKDIR /repo/apps/web
RUN npm install --legacy-peer-deps
RUN npm run build

EXPOSE 3000

CMD ["node", "/repo/apps/web/build/server/index.js"]
