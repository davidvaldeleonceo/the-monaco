# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production server
FROM node:20-alpine
WORKDIR /app

# Install build deps for bcrypt (native addon)
RUN apk add --no-cache python3 make g++

# Copy server package files and install
COPY server/package.json server/package-lock.json* ./server/
WORKDIR /app/server
RUN npm install --production

# Remove build deps to keep image small
RUN apk del python3 make g++

# Copy server source
COPY server/src ./src

# Copy built frontend from stage 1
COPY --from=frontend-build /app/dist /app/dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Run migrations (safe — all IF NOT EXISTS), then start server
CMD ["sh", "-c", "node src/db/migrate.js && node src/index.js"]
