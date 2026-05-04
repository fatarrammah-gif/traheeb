FROM node:20-slim

WORKDIR /app

COPY apps/web/package.json apps/web/package-lock.json apps/web/.npmrc apps/web/
RUN npm install --legacy-peer-deps --prefix apps/web

COPY . .

WORKDIR /app/apps/web
RUN npm run build

RUN echo "FILES IN /app/apps/web:"
RUN ls -la /app/apps/web

RUN echo "FILES IN build/ (if exists):"
RUN ls -la /app/apps/web/build/ || echo "BUILD FOLDER DOES NOT EXIST"

RUN echo "FILES IN build/server/ (if exists):"
RUN ls -la /app/apps/web/build/server/ || echo "build/server/ DOES NOT EXIST"

EXPOSE 3000

CMD ["node", "/app/apps/web/build/server/index.js"]
