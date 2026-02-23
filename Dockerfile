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

# Run migrations with retry (DB may not be ready immediately), then start server
CMD ["sh", "-c", "\
  attempts=0; max=5; \
  until node src/db/migrate.js; do \
    attempts=$((attempts+1)); \
    if [ $attempts -ge $max ]; then \
      echo 'Migration failed after '$max' attempts'; exit 1; \
    fi; \
    echo 'Migration attempt '$attempts' failed, retrying in 5s...'; \
    sleep 5; \
  done && \
  node src/index.js"]
