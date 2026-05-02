#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." >/dev/null 2>&1 && pwd)"
USER=$(whoami)

cat << SERVICE | sudo tee /etc/systemd/system/sycord-runner.service
[Unit]
Description=Sycord VM Runner
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$DIR
ExecStart=/usr/bin/node $DIR/dist/server.js
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=5000

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable sycord-runner
sudo systemctl start sycord-runner

echo "Sycord VM Runner service installed and started."
