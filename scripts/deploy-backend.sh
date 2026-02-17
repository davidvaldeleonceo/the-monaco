#!/bin/bash

echo "🚀 Deploying Monaco PRO Backend to VPS..."

# 1. Sync server code (excluding node_modules and .env)
echo "📦 Uploading server code..."
rsync -avz --delete --exclude 'node_modules' --exclude '.env' server/ root@187.77.15.68:/var/www/monaco/server/

# 2. Setup environment and process on VPS
echo "🔄 Installing dependencies and restarting..."
ssh root@187.77.15.68 << 'EOF'
    # Create production .env if not exists
    if [ ! -f /var/www/monaco/server/.env ]; then
        echo "Creating .env..."
        echo "PORT=3001" > /var/www/monaco/server/.env
        echo "NODE_ENV=production" >> /var/www/monaco/server/.env
        # DB on VPS is localhost:54321 (from tunnel config)
        echo "DATABASE_URL=postgresql://MonacoPro:M0n4c0*moto@127.0.0.1:54321/MonacoProDB" >> /var/www/monaco/server/.env
        echo "JWT_SECRET=monaco-pro-jwt-secret-2026-themonaco" >> /var/www/monaco/server/.env
        echo "CORS_ORIGIN=https://themonaco.com.co" >> /var/www/monaco/server/.env
    fi

    cd /var/www/monaco/server
    npm install --production

    # Run database migrations
    echo "🔄 Running database migrations..."
    npm run migrate


    # Start or Restart PM2
    if pm2 list | grep -q "monaco-api"; then
        pm2 reload monaco-api
    else
        pm2 start src/index.js --name "monaco-api"
        pm2 save
        pm2 startup
    fi
EOF

if [ $? -eq 0 ]; then
    echo "✅ Backend deployment successful!"
else
    echo "❌ Backend deployment failed."
    exit 1
fi
