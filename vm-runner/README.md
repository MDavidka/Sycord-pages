# Sycord VM Runner

Node.js/TypeScript mini-server for deploying generated Next.js projects onto an Ubuntu VM behind Cloudflare Tunnel and nginx.

## Environment

`VPS_RUNNER_TOKEN`
`SYCORD_BASE_DOMAIN=sycord.site`
`SYCORD_SITES_DIR=/srv/sycord/sites`
`SYCORD_LOGS_DIR=/srv/sycord/logs`
`SYCORD_ENV_DIR=/srv/sycord/env`
`SYCORD_STATE_FILE=/srv/sycord/runner/state.json`
`SYCORD_PORT_START=4100`
`SYCORD_PORT_END=4999`
`SYCORD_PROXY=nginx`
`RUNNER_PORT=5050`
`SYCORD_NGINX_SITES_DIR=/etc/nginx/sites-enabled`

## Commands

`npm install`
`npm run build`
`npm start`

## Service setup

Use the scripts in `scripts/` to install dependencies, build the runner, and manage the `sycord-vm-runner` systemd service.
