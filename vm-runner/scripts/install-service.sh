#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNNER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${RUNNER_DIR}"
npm install
npm run build

cat >/etc/systemd/system/sycord-vm-runner.service <<'EOF'
[Unit]
Description=Sycord VM Runner
After=network.target

[Service]
Type=simple
WorkingDirectory=__RUNNER_DIR__
ExecStart=/usr/bin/node __RUNNER_DIR__/dist/server.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

sed -i "s#__RUNNER_DIR__#${RUNNER_DIR}#g" /etc/systemd/system/sycord-vm-runner.service
systemctl daemon-reload
systemctl enable --now sycord-vm-runner
echo "Service installed"
