#!/bin/bash
set -e

echo "Starting Sycord VM Runner Setup..."

# Update and install dependencies
sudo apt-get update
sudo apt-get install -y curl git build-essential pm2

# Install Node.js LTS if not present
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Ensure npm is up to date
sudo npm install -g npm pm2

# Install Nginx if neither nginx nor caddy is present
if ! command -v nginx &> /dev/null && ! command -v caddy &> /dev/null; then
    sudo apt-get install -y nginx
fi

# Setup directories
sudo mkdir -p /srv/sycord/sites
sudo mkdir -p /srv/sycord/env
sudo mkdir -p /srv/sycord/logs
sudo mkdir -p /srv/sycord/runner
sudo mkdir -p /srv/sycord/proxy

sudo chown -R $USER:$USER /srv/sycord

# Configure Nginx to include our proxy configs
if ! grep -q 'include /srv/sycord/proxy/\*\.conf;' /etc/nginx/nginx.conf; then
    sudo sed -i '/include \/etc\/nginx\/conf\.d\/\*\.conf;/a \    include \/srv\/sycord\/proxy\/\*\.conf;' /etc/nginx/nginx.conf
    sudo systemctl restart nginx || true
fi

# Check cloudflared
if ! command -v cloudflared &> /dev/null; then
    echo "Warning: cloudflared not found. Please install it to use Cloudflare Tunnels."
else
    echo "cloudflared is installed."
fi

echo "Installing VM runner service..."
cd "$(dirname "$0")/.."
npm install
npm run build

# Install and enable the systemd service
chmod +x $(dirname "$0")/install-service.sh
bash $(dirname "$0")/install-service.sh

echo "Setup Complete!"
