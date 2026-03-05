#!/bin/bash

echo "🚀 Deploying Monaco PRO Frontend to VPS..."

# 1. Build the project
echo "📦 Building project..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed. Aborting deploy."
    exit 1
fi

# 2. Upload to VPS
echo "Upload to VPS (187.77.15.68)..."
rsync -avz --delete dist/ root@187.77.15.68:/var/www/monaco/dist/

if [ $? -ne 0 ]; then
    echo "❌ Upload failed."
    exit 1
fi

# 3. Reload nginx to clear any cached responses
echo "🔄 Reloading nginx..."
ssh root@187.77.15.68 "nginx -t && systemctl reload nginx"

echo "✅ Deployment successful! Check https://themonaco.com.co"
