# === Stage 1: Build frontend ===
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
ARG PUBLIC_API_URL=""
ENV PUBLIC_API_URL=${PUBLIC_API_URL}
RUN npm run build

# === Stage 2: Build backend ===
FROM node:22-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

# === Stage 3: Production image ===
FROM node:22-alpine
WORKDIR /app

# Copy backend
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY --from=backend-builder /app/backend/package.json ./
COPY --from=backend-builder /app/backend/src/schema.sql ./dist/

# Copy frontend static files
COPY --from=frontend-builder /app/frontend/dist ./public

RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "dist/index.js"]
