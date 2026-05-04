FROM node:20-slim

WORKDIR /app

COPY . .

RUN npm install --legacy-peer-deps

WORKDIR /app/apps/web
RUN npm run build

EXPOSE 3000

CMD ["node", "/app/apps/web/build/server/index.js"]
