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

# Copy server
COPY server/package.json server/package-lock.json* ./server/
WORKDIR /app/server
RUN npm install --production

# Copy server source
COPY server/src ./src

# Copy built frontend
COPY --from=frontend-build /app/dist /app/dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Run migrations then start server
CMD ["sh", "-c", "node src/db/migrate.js && node src/index.js"]
