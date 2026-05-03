#!/usr/bin/env bash
set -euo pipefail

AUTO_FIX_PORT_80="${SYCORD_AUTO_FIX_PORT_80:-1}"

log() {
  printf '%s\n' "$1"
}

diagnostics() {
  log "== Port 80 owner via ss =="
  ss -ltnp | grep ':80' || true
  log
  log "== Port 80 owner via lsof =="
  lsof -nP -iTCP:80 -sTCP:LISTEN || true
  log
  log "== Related services =="
  systemctl list-units --type=service --all | grep -Ei 'flask|python|runner|sycord|server|nginx|caddy|cloudflared' || true
  log
  log "== Port 80 PID details =="
  print_port_80_pid_details || true
}

related_service_units() {
  systemctl list-units --type=service --all --no-legend \
    | awk '{print $1}' \
    | grep -Ei 'flask|python|gunicorn|sycord|server|runner|caddy' \
    | grep -Evi 'sycord-vm-runner|nginx|cloudflared' || true
}

port_80_is_busy() {
  ss -ltnp | grep -q ':80'
}

port_80_owner_text() {
  {
    ss -ltnp | grep ':80' || true
    lsof -nP -iTCP:80 -sTCP:LISTEN || true
    print_port_80_pid_details || true
  } | sed '/^\s*$/d'
}

port_80_pid() {
  ss -ltnp | grep ':80' | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | head -n1
}

service_for_pid() {
  local pid="$1"
  [[ -z "${pid}" ]] && return 0
  grep -oE '[^/[:space:]]+\.service' "/proc/${pid}/cgroup" 2>/dev/null | head -n1 || true
}

print_port_80_pid_details() {
  local pid service exe ps_line
  pid="$(port_80_pid)"
  [[ -z "${pid}" ]] && return 0
  service="$(service_for_pid "${pid}")"
  exe="$(readlink -f "/proc/${pid}/exe" 2>/dev/null || true)"
  ps_line="$(ps -p "${pid}" -o pid=,ppid=,comm=,args= 2>/dev/null || true)"
  log "PID: ${pid}"
  [[ -n "${service}" ]] && log "Service: ${service}"
  [[ -n "${exe}" ]] && log "Executable: ${exe}"
  [[ -n "${ps_line}" ]] && log "Process: ${ps_line}"
}

looks_like_old_sycord_stack() {
  local owner_text="$1"
  if [[ -z "${owner_text}" ]]; then
    return 1
  fi
  grep -Eiq 'flask|python|gunicorn|caddy|sycord|server|runner|main' <<<"${owner_text}"
}

stop_old_services() {
  local units
  units="$(related_service_units)"
  if [[ -n "${units}" ]]; then
    while read -r unit; do
      [[ -z "${unit}" ]] && continue
      log "Stopping old service: ${unit}"
      systemctl stop "${unit}" || true
      log "Disabling old service: ${unit}"
      systemctl disable "${unit}" || true
    done <<<"${units}"
  fi

  local pid service
  pid="$(port_80_pid)"
  service="$(service_for_pid "${pid}")"
  if [[ -n "${service}" ]] && ! grep -Eiq 'nginx|cloudflared|sycord-vm-runner' <<<"${service}"; then
    log "Stopping port 80 owning service: ${service}"
    systemctl stop "${service}" || true
    log "Disabling port 80 owning service: ${service}"
    systemctl disable "${service}" || true
  fi
}

ensure_nginx() {
  log "Validating Nginx configuration"
  nginx -t
  log "Restarting Nginx"
  systemctl restart nginx
  systemctl enable nginx
  systemctl is-active nginx >/dev/null
}

apt-get update
apt-get install -y nginx curl git lsof
npm install -g pm2
mkdir -p /srv/sycord/sites /srv/sycord/logs /srv/sycord/env /srv/sycord/runner
chmod 700 /srv/sycord/env

diagnostics

if port_80_is_busy; then
  OWNER_TEXT="$(port_80_owner_text)"
  log
  log "Port 80 is currently blocked:"
  log "${OWNER_TEXT}"

  if [[ "${AUTO_FIX_PORT_80}" == "1" ]] && looks_like_old_sycord_stack "${OWNER_TEXT}"; then
    log
    log "Detected old Flask/static/Sycord traffic owner on port 80. Attempting automatic cleanup."
    stop_old_services
    sleep 2
    diagnostics
  fi
fi

if port_80_is_busy; then
  OWNER_TEXT="$(port_80_owner_text)"
  log
  log "SETUP ERROR: Port 80 is already in use. Nginx cannot start."
  log "${OWNER_TEXT}"
  exit 1
fi

ensure_nginx

log
log "Ubuntu setup complete"
log "Expected final state:"
log "- nginx active on :80"
log "- sycord-vm-runner active on :5050"
log "- cloudflared active"
