FROM node:20-slim

WORKDIR /app

# Copy package files first — this layer is cached until package.json changes
COPY apps/web/package.json apps/web/package-lock.json apps/web/.npmrc apps/web/
RUN npm install --legacy-peer-deps --prefix apps/web

# Copy all source — this layer busts cache whenever any file changes
COPY . .

# Build
WORKDIR /app/apps/web
RUN npm run build

# Verify the output exists — fails the build clearly if something went wrong
RUN test -f /app/apps/web/build/server/index.js \
    || (echo "ERROR: build/server/index.js was not created" && exit 1)

EXPOSE 3000

CMD ["node", "/app/apps/web/build/server/index.js"]
