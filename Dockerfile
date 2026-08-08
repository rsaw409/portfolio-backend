# Build stage
FROM node:lts-slim AS build

WORKDIR /app

COPY package*.json ./

# Prevent Husky (and any other lifecycle scripts) from running during install
RUN npm pkg delete scripts.prepare && \
    HUSKY=0 npm ci --ignore-scripts

COPY . .

RUN npm run build

# Production stage
FROM node:lts-slim

WORKDIR /app

COPY package*.json ./

RUN npm pkg delete scripts.prepare && \
    npm ci --omit=dev --ignore-scripts

# Copy build output with correct ownership for non-root user
COPY --chown=node:node --from=build /app/dist ./dist

# Run as non-root user (node:lts-slim already ships a 'node' user)
USER node

EXPOSE 3000

CMD ["node", "dist/src/index.js"]