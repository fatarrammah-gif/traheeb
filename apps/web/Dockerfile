FROM node:20-slim

WORKDIR /app

# Install dependencies first (cached layer if package files unchanged)
COPY package.json package-lock.json .npmrc ./
RUN npm install --legacy-peer-deps

# Copy source and build
COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "build/server/index.js"]
