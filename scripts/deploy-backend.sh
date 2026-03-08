#!/bin/bash

echo "Deploying Monaco PRO Backend to VPS..."

# 1. Sync server code (excluding node_modules and .env)
echo "Uploading server code..."
rsync -avz --delete --exclude 'node_modules' --exclude '.env' server/ root@187.77.15.68:/var/www/monaco/server/

# 2. Setup environment and process on VPS
echo "Installing dependencies and restarting..."
ssh root@187.77.15.68 << 'EOF'
    cd /var/www/monaco/server

    # Verify .env exists with all required vars
    if [ ! -f .env ]; then
        echo "ERROR: .env file not found. Create it manually on the VPS first."
        echo "Required vars: PORT, NODE_ENV, DATABASE_URL, JWT_SECRET, CORS_ORIGIN, WOMPI_PUBLIC_KEY, WOMPI_PRIVATE_KEY, WOMPI_EVENTS_SECRET, WOMPI_INTEGRITY_SECRET, OPENAI_API_KEY"
        exit 1
    fi

    REQUIRED_VARS="PORT NODE_ENV DATABASE_URL JWT_SECRET CORS_ORIGIN WOMPI_PUBLIC_KEY WOMPI_PRIVATE_KEY WOMPI_EVENTS_SECRET WOMPI_INTEGRITY_SECRET OPENAI_API_KEY"
    MISSING=""
    for var in $REQUIRED_VARS; do
        if ! grep -q "^${var}=" .env; then
            MISSING="$MISSING $var"
        fi
    done

    if [ -n "$MISSING" ]; then
        echo "ERROR: Missing required env vars in .env:$MISSING"
        exit 1
    fi

    npm install --production

    # Run database migrations
    echo "Running database migrations..."
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
    echo "Backend deployment successful!"
else
    echo "Backend deployment failed."
    exit 1
fi
