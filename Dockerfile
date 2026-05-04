FROM node:20-slim

WORKDIR /app

COPY apps/web/package.json apps/web/package-lock.json apps/web/.npmrc apps/web/
RUN npm install --legacy-peer-deps --prefix apps/web

COPY . .

WORKDIR /app/apps/web
RUN npm run build

# Show exact content of the entry file so we know what Node is trying to run
RUN echo "=== index.js CONTENT ===" && cat /app/apps/web/build/server/index.js
RUN echo "=== build/server/ FILES ===" && ls -la /app/apps/web/build/server/
RUN echo "=== build/ FILES ===" && ls -la /app/apps/web/build/

EXPOSE 3000

# Run from WORKDIR /app/apps/web so package.json "type":"module" is found
CMD ["node", "build/server/index.js"]
