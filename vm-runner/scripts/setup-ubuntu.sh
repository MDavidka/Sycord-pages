#!/usr/bin/env bash
set -euo pipefail

AUTO_FIX_PORT="${SYCORD_AUTO_FIX_PORT:-1}"
NGINX_PORT="${SYCORD_NGINX_PORT:-5050}"
CENTRAL_PORT="${SYCORD_CENTRAL_PORT:-3000}"
RUNNER_PORT="${RUNNER_PORT:-5051}"
BASE_DOMAIN="${SYCORD_BASE_DOMAIN:-sycord.site}"
RUNNER_DIR="${SYCORD_RUNNER_DIR:-/srv/sycord/vm-runner}"
NGINX_SITES="/etc/nginx/sites-enabled"
SYCORD_WILDCARD_CONF="${NGINX_SITES}/sycord-wildcard.conf"
SYCORD_RUNNER_CONF="${NGINX_SITES}/sycord-runner.conf"

log() {
  printf '%s\n' "${1:-}"
}

diagnostics() {
  log "== Port ${NGINX_PORT} owner via ss =="
  ss -ltnp | grep ":${NGINX_PORT}" || true
  log
  log "== Port ${NGINX_PORT} owner via lsof =="
  lsof -nP -iTCP:${NGINX_PORT} -sTCP:LISTEN || true
  log
  log "== Related services =="
  systemctl list-units --type=service --all | grep -Ei 'flask|python|runner|sycord|server|nginx|caddy|cloudflared' || true
  log
}

nginx_port_is_busy() {
  ss -ltnp | grep -q ":${NGINX_PORT}"
}

nginx_port_owner_text() {
  {
    ss -ltnp | grep ":${NGINX_PORT}" || true
    lsof -nP -iTCP:${NGINX_PORT} -sTCP:LISTEN || true
  } | sed '/^\s*$/d'
}

nginx_port_pid() {
  ss -ltnp | grep ":${NGINX_PORT}" | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | head -n1
}

service_for_pid() {
  local pid="$1"
  [[ -z "${pid}" ]] && return 0
  grep -oE '[^/[:space:]]+\.service' "/proc/${pid}/cgroup" 2>/dev/null | head -n1 || true
}

exe_for_pid() {
  local pid="$1"
  [[ -z "${pid}" ]] && return 0
  readlink -f "/proc/${pid}/exe" 2>/dev/null || true
}

process_line_for_pid() {
  local pid="$1"
  [[ -z "${pid}" ]] && return 0
  ps -p "${pid}" -o pid=,ppid=,comm=,args= 2>/dev/null || true
}

ppid_for_pid() {
  local pid="$1"
  [[ -z "${pid}" ]] && return 0
  ps -p "${pid}" -o ppid= 2>/dev/null | tr -d ' '
}

stop_foreign_process_on_nginx_port() {
  local pid service exe
  pid="$(nginx_port_pid)"
  if [[ -z "${pid}" ]]; then
    log "No foreign process on port ${NGINX_PORT}"
    return 0
  fi

  service="$(service_for_pid "${pid}")"
  exe="$(exe_for_pid "${pid}")"

  if grep -Eiq 'nginx|cloudflared|sycord-vm-runner' <<<"${exe} ${service}"; then
    log "Port ${NGINX_PORT} is held by a protected service — skipping cleanup"
    return 0
  fi

  log "Foreign process on port ${NGINX_PORT}: PID=${pid} service=${service:-none} exe=${exe:-unknown}"

  if [[ -n "${service}" ]]; then
    log "Stopping systemd unit: ${service}"
    systemctl stop "${service}" 2>/dev/null || true
    systemctl disable "${service}" 2>/dev/null || true
    systemctl mask "${service}" 2>/dev/null || true
    sleep 1
  fi

  if kill -0 "${pid}" 2>/dev/null; then
    log "Sending SIGTERM to PID ${pid}"
    kill "${pid}" 2>/dev/null || true
    sleep 3
  fi

  if kill -0 "${pid}" 2>/dev/null; then
    log "Sending SIGKILL to PID ${pid}"
    kill -9 "${pid}" 2>/dev/null || true
    sleep 2
  fi

  if kill -0 "${pid}" 2>/dev/null; then
    log "PID ${pid} refuses to die, using fuser -k ${NGINX_PORT}/tcp"
    fuser -k ${NGINX_PORT}/tcp 2>/dev/null || true
    sleep 2
  fi

  local ppid parent_line
  ppid="$(ppid_for_pid "${pid}")"
  if [[ -n "${ppid}" ]] && [[ "${ppid}" != "1" ]]; then
    parent_line="$(process_line_for_pid "${ppid}")"
    if ! grep -Eiq 'nginx|cloudflared|sycord-vm-runner' <<<"${parent_line}"; then
      log "Stopping parent PID ${ppid}"
      kill "${ppid}" 2>/dev/null || true
      sleep 1
      kill -9 "${ppid}" 2>/dev/null || true
    fi
  fi
}

write_nginx_wildcard_config() {
  if [[ -f "${SYCORD_WILDCARD_CONF}" ]]; then
    log "Wildcard proxy config already exists at ${SYCORD_WILDCARD_CONF}"
    return 0
  fi

  mkdir -p "${NGINX_SITES}"

  local template="/srv/sycord/vm-runner/templates/nginx-wildcard.conf"
  if [[ ! -f "${template}" ]]; then
    template="${RUNNER_DIR}/templates/nginx-wildcard.conf"
  fi

  if [[ -f "${template}" ]]; then
    log "Installing wildcard proxy config from template"
    sed -e "s/__NGINX_PORT__/${NGINX_PORT}/g" \
        -e "s/__CENTRAL_PORT__/${CENTRAL_PORT}/g" \
        "${template}" > "${SYCORD_WILDCARD_CONF}"
  else
    log "Template not found — writing static wildcard config"
    cat > "${SYCORD_WILDCARD_CONF}" << 'WILDCARD_EOF'
server {
    listen __NGINX_PORT__;
    server_name *.sycord.site;

    location / {
        proxy_pass http://127.0.0.1:__CENTRAL_PORT__;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600;
        proxy_connect_timeout 60;
        proxy_send_timeout 3600;
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;
    }
}
WILDCARD_EOF
    sed -i "s/__NGINX_PORT__/${NGINX_PORT}/g; s/__CENTRAL_PORT__/${CENTRAL_PORT}/g" "${SYCORD_WILDCARD_CONF}"
  fi
}

write_nginx_runner_config() {
  if [[ -f "${SYCORD_RUNNER_CONF}" ]]; then
    log "Runner proxy config already exists at ${SYCORD_RUNNER_CONF}"
    return 0
  fi

  local template="/srv/sycord/vm-runner/templates/nginx-runner.conf"
  if [[ ! -f "${template}" ]]; then
    template="${RUNNER_DIR}/templates/nginx-runner.conf"
  fi

  if [[ -f "${template}" ]]; then
    log "Installing runner proxy config from template"
    sed -e "s/__NGINX_PORT__/${NGINX_PORT}/g" \
        -e "s/__RUNNER_PORT__/${RUNNER_PORT}/g" \
        -e "s/__BASE_DOMAIN__/${BASE_DOMAIN}/g" \
        "${template}" > "${SYCORD_RUNNER_CONF}"
  else
    log "Writing static runner proxy config"
    cat > "${SYCORD_RUNNER_CONF}" << RUNNER_EOF
server {
    listen ${NGINX_PORT};
    server_name server.${BASE_DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${RUNNER_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600;
        proxy_connect_timeout 60;
        proxy_send_timeout 3600;
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;
    }
}
RUNNER_EOF
  fi
}

ensure_nginx() {
  log "Validating Nginx configuration"
  nginx -t
  log "Enabling and (re)starting Nginx"
  systemctl enable nginx
  if systemctl is-active nginx >/dev/null 2>&1; then
    systemctl reload nginx
  else
    systemctl start nginx
  fi
  systemctl is-active nginx >/dev/null
}

# ---------------------------------------------------------------------------
# Main bootstrap
# ---------------------------------------------------------------------------

log "=== Sycord Dynamic Reverse Proxy Setup ==="
log "Nginx port:     ${NGINX_PORT}"
log "Central port:   ${CENTRAL_PORT}"
log "Runner port:    ${RUNNER_PORT}"
log "Base domain:    ${BASE_DOMAIN}"
log "Runner dir:     ${RUNNER_DIR}"
log ""

apt-get update
apt-get install -y nginx curl git lsof ca-certificates

if ! command -v node &>/dev/null; then
  log "Node.js not found, installing LTS..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

log "Node.js $(node --version) / npm $(npm --version)"

npm install -g pm2
mkdir -p /srv/sycord/sites /srv/sycord/logs /srv/sycord/env /srv/sycord/runner
chmod 700 /srv/sycord/env

diagnostics

if nginx_port_is_busy; then
  OWNER_TEXT="$(nginx_port_owner_text)"

  if grep -Eiq 'nginx' <<<"${OWNER_TEXT}"; then
    log "Port ${NGINX_PORT} is held by nginx — correct."
  else
    log "Port ${NGINX_PORT} is occupied by a non-nginx process:"
    log "${OWNER_TEXT}"

    if [[ "${AUTO_FIX_PORT}" == "1" ]]; then
      log "Attempting automatic cleanup of port ${NGINX_PORT} owner..."
      stop_foreign_process_on_nginx_port
      sleep 2
    fi

    if nginx_port_is_busy; then
      local final_owner
      final_owner="$(nginx_port_owner_text)"
      if grep -Eiq 'nginx' <<<"${final_owner}"; then
        log "Cleanup succeeded — nginx now holds port ${NGINX_PORT}."
      else
        log "SETUP ERROR: Port ${NGINX_PORT} still occupied after cleanup. Nginx cannot start."
        log "${final_owner}"
        exit 1
      fi
    fi
    diagnostics
  fi
fi

write_nginx_wildcard_config
write_nginx_runner_config
ensure_nginx

log ""
log "Ubuntu setup complete"
log "Expected final state:"
log "- nginx active on :${NGINX_PORT} — wildcard *.${BASE_DOMAIN} → :${CENTRAL_PORT} (central app)"
log "- server.${BASE_DOMAIN} → :${RUNNER_PORT} (runner API)"
log "- sycord-vm-runner active on :${RUNNER_PORT}"
log "- cloudflared routes *.${BASE_DOMAIN} → localhost:${NGINX_PORT}"
