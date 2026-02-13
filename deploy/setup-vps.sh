#!/bin/bash
# Monaco PRO — VPS Setup Script (Ubuntu 22.04+)
# Run as root: bash setup-vps.sh YOUR_DOMAIN DB_PASSWORD JWT_SECRET

set -e

DOMAIN=${1:?"Usage: setup-vps.sh DOMAIN DB_PASSWORD JWT_SECRET"}
DB_PASSWORD=${2:?"Missing DB_PASSWORD"}
JWT_SECRET=${3:?"Missing JWT_SECRET"}

echo "=== Monaco PRO VPS Setup ==="
echo "Domain: $DOMAIN"

# 1. System updates
echo ">>> Updating system..."
apt update && apt upgrade -y

# 2. Install PostgreSQL 16
echo ">>> Installing PostgreSQL 16..."
apt install -y curl ca-certificates gnupg
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql.gpg
echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
apt update
apt install -y postgresql-16

# Create database and user
sudo -u postgres psql -c "CREATE USER monaco WITH PASSWORD '$DB_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE monaco OWNER monaco;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE monaco TO monaco;"
sudo -u postgres psql -d monaco -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"

# 3. Install Node.js 20
echo ">>> Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 4. Install PM2
echo ">>> Installing PM2..."
npm install -g pm2

# 5. Install nginx
echo ">>> Installing nginx..."
apt install -y nginx

# 6. Install certbot
echo ">>> Installing certbot..."
apt install -y certbot python3-certbot-nginx

# 7. Create app directory
echo ">>> Setting up app directory..."
mkdir -p /var/www/monaco
chown -R www-data:www-data /var/www/monaco

# 8. Setup nginx config
echo ">>> Configuring nginx..."
cat > /etc/nginx/sites-available/monaco << 'NGINX_EOF'
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;

    # Frontend (SPA)
    root /var/www/monaco/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket proxy (Socket.io)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 256;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINX_EOF

sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /etc/nginx/sites-available/monaco
ln -sf /etc/nginx/sites-available/monaco /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# 9. Setup server .env
echo ">>> Creating server .env..."
mkdir -p /var/www/monaco/server
cat > /var/www/monaco/server/.env << ENV_EOF
DATABASE_URL=postgresql://monaco:${DB_PASSWORD}@localhost:5432/monaco
JWT_SECRET=${JWT_SECRET}
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://${DOMAIN}
ENV_EOF

# 10. SSL certificate
echo ">>> Obtaining SSL certificate..."
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "admin@$DOMAIN" || echo "Certbot failed — run manually: certbot --nginx -d $DOMAIN"

# 11. Setup firewall
echo ">>> Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Point DNS A record for $DOMAIN to this server's IP"
echo "  2. Upload the built frontend to /var/www/monaco/dist/"
echo "  3. Upload the server to /var/www/monaco/server/"
echo "  4. cd /var/www/monaco/server && npm install --production"
echo "  5. npm run migrate"
echo "  6. pm2 start ecosystem.config.cjs"
echo "  7. pm2 save && pm2 startup"
echo ""
