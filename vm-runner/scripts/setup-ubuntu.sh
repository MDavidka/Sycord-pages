#!/usr/bin/env bash
set -euo pipefail

apt-get update
apt-get install -y nginx curl git
npm install -g pm2
mkdir -p /srv/sycord/sites /srv/sycord/logs /srv/sycord/env /srv/sycord/runner
chmod 700 /srv/sycord/env
echo "Ubuntu setup complete"
