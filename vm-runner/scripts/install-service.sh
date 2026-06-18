#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNNER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

NGINX_PORT="${SYCORD_NGINX_PORT:-80}"
RUNNER_PORT="${RUNNER_PORT:-5050}"
CENTRAL_PORT="${SYCORD_CENTRAL_PORT:-3000}"

cd "${RUNNER_DIR}"
npm install
npm run build

cat >/etc/systemd/system/sycord-vm-runner.service <<'EOF'
[Unit]
Description=Sycord VM Runner — Deployer API + Proxy Manager
After=network.target

[Service]
Type=simple
WorkingDirectory=__RUNNER_DIR__
ExecStart=/usr/bin/node __RUNNER_DIR__/dist/server.js
Restart=always
Environment=NODE_ENV=production
Environment=VPS_RUNNER_TOKEN=__VPS_RUNNER_TOKEN__
Environment=SYCORD_BASE_DOMAIN=__BASE_DOMAIN__
Environment=RUNNER_PORT=__RUNNER_PORT__
Environment=SYCORD_NGINX_PORT=__NGINX_PORT__
Environment=SYCORD_CENTRAL_PORT=__CENTRAL_PORT__
Environment=SYCORD_SITES_DIR=/srv/sycord/sites
Environment=SYCORD_LOGS_DIR=/srv/sycord/logs
Environment=SYCORD_ENV_DIR=/srv/sycord/env
Environment=SYCORD_STATE_FILE=/srv/sycord/runner/state.json

[Install]
WantedBy=multi-user.target
EOF

sed -i "s#__RUNNER_DIR__#${RUNNER_DIR}#g" /etc/systemd/system/sycord-vm-runner.service
sed -i "s#__VPS_RUNNER_TOKEN__#${VPS_RUNNER_TOKEN:-}#g" /etc/systemd/system/sycord-vm-runner.service
sed -i "s#__BASE_DOMAIN__#${SYCORD_BASE_DOMAIN:-sycord.site}#g" /etc/systemd/system/sycord-vm-runner.service
sed -i "s#__RUNNER_PORT__#${RUNNER_PORT}#g" /etc/systemd/system/sycord-vm-runner.service
sed -i "s#__NGINX_PORT__#${NGINX_PORT}#g" /etc/systemd/system/sycord-vm-runner.service
sed -i "s#__CENTRAL_PORT__#${CENTRAL_PORT}#g" /etc/systemd/system/sycord-vm-runner.service
systemctl daemon-reload
systemctl enable --now sycord-vm-runner
echo "Service installed"
