# Build stage
FROM node:lts-slim AS build

WORKDIR /app

COPY package*.json ./

# Prevent Husky from running during install
RUN npm pkg delete scripts.prepare && \
    HUSKY=0 npm ci

COPY . .

RUN npm run build

# Production stage
FROM node:lts-slim

WORKDIR /app

COPY package*.json ./

RUN npm pkg delete scripts.prepare && \
    npm ci --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/src/index.js"]
