#!/usr/bin/env bash
set -euo pipefail

AUTO_FIX_PORT_80="${SYCORD_AUTO_FIX_PORT_80:-1}"

log() {
  printf '%s\n' "${1:-}"
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

startup_references_for_pattern() {
  local pattern="$1"
  grep -RInE "${pattern}" /etc/systemd/system /lib/systemd/system /usr/lib/systemd/system /etc/rc.local /etc/crontab /var/spool/cron/crontabs/root /root/.config/systemd /root 2>/dev/null \
    | grep -vE '/root/myapp/cloudflared|/srv/sycord/vm-runner|sycord-vm-runner' \
    || true
}

print_port_80_pid_details() {
  local pid service exe ps_line
  pid="$(port_80_pid)"
  [[ -z "${pid}" ]] && return 0
  service="$(service_for_pid "${pid}")"
  exe="$(exe_for_pid "${pid}")"
  ps_line="$(process_line_for_pid "${pid}")"
  log "PID: ${pid}"
  [[ -n "${service}" ]] && log "Service: ${service}"
  [[ -n "${exe}" ]] && log "Executable: ${exe}"
  [[ -n "${ps_line}" ]] && log "Process: ${ps_line}"
  log "Startup references:"
  startup_references_for_pattern "${exe:-/go/bin/main}|/go/bin/main|main /go/bin/main" || true
}

looks_like_old_sycord_stack() {
  local owner_text="$1"
  if [[ -z "${owner_text}" ]]; then
    return 1
  fi
  grep -Eiq 'flask|python|gunicorn|caddy|sycord|server|runner|main|node|static' <<<"${owner_text}"
}

disable_startup_references() {
  local service_lines matched_service
  service_lines="$(startup_references_for_pattern '/go/bin/main|main /go/bin/main|/root/myapp')"
  if [[ -n "${service_lines}" ]]; then
    log "Found startup references for old public app:"
    log "${service_lines}"
  fi

  matched_service="$(grep -oE '[[:alnum:]_.@-]+\.service' <<<"${service_lines}" | sort -u || true)"
  if [[ -n "${matched_service}" ]]; then
    while read -r unit; do
      [[ -z "${unit}" ]] && continue
      if grep -Eiq 'nginx|cloudflared|sycord-vm-runner' <<<"${unit}"; then
        continue
      fi
      log "Stopping startup unit: ${unit}"
      systemctl stop "${unit}" || true
      log "Disabling startup unit: ${unit}"
      systemctl disable "${unit}" || true
    done <<<"${matched_service}"
  fi
}

kill_port_80_pid() {
  local pid ppid exe ps_line parent_line
  pid="$(port_80_pid)"
  [[ -z "${pid}" ]] && return 0
  ppid="$(ppid_for_pid "${pid}")"
  exe="$(exe_for_pid "${pid}")"
  ps_line="$(process_line_for_pid "${pid}")"
  parent_line="$(process_line_for_pid "${ppid}")"

  if grep -Eiq 'nginx|cloudflared|sycord-vm-runner' <<<"${exe} ${ps_line}"; then
    log "Refusing to kill protected port 80 owner: ${ps_line}"
    return 0
  fi

  disable_startup_references

  log "Stopping raw port 80 owner PID ${pid}"
  kill "${pid}" || true
  sleep 2
  if kill -0 "${pid}" 2>/dev/null; then
    log "PID ${pid} still alive, sending SIGKILL"
    kill -9 "${pid}" || true
  fi

  if [[ -n "${ppid}" ]] && [[ "${ppid}" != "1" ]] && ! grep -Eiq 'nginx|cloudflared|sycord-vm-runner' <<<"${parent_line}"; then
    log "Stopping parent PID ${ppid}: ${parent_line}"
    kill "${ppid}" || true
    sleep 1
    if kill -0 "${ppid}" 2>/dev/null; then
      log "Parent PID ${ppid} still alive, sending SIGKILL"
      kill -9 "${ppid}" || true
    fi
  fi
}

stop_old_services() {
  local pid service exe
  pid="$(port_80_pid)"
  if [[ -z "${pid}" ]]; then
    log "No process found on port 80"
    return 0
  fi

  service="$(service_for_pid "${pid}")"
  exe="$(exe_for_pid "${pid}")"

  if grep -Eiq 'nginx|cloudflared|sycord-vm-runner' <<<"${exe} ${service}"; then
    log "Port 80 is held by a protected service (nginx/cloudflared/runner) — skipping cleanup"
    return 0
  fi

  log "Port 80 owner: PID=${pid} service=${service:-none} exe=${exe:-unknown}"

  # Step 1: Stop and mask the systemd service if we can find it
  if [[ -n "${service}" ]]; then
    log "Stopping systemd unit: ${service}"
    systemctl stop "${service}" 2>/dev/null || true
    log "Disabling systemd unit: ${service}"
    systemctl disable "${service}" 2>/dev/null || true
    log "Masking systemd unit to prevent restart: ${service}"
    systemctl mask "${service}" 2>/dev/null || true
    sleep 1
  fi

  # Step 2: Also search for and disable any startup references
  disable_startup_references

  # Step 3: If still running, kill directly
  if kill -0 "${pid}" 2>/dev/null; then
    log "PID ${pid} still alive, sending SIGTERM"
    kill "${pid}" 2>/dev/null || true
    sleep 3
  fi

  if kill -0 "${pid}" 2>/dev/null; then
    log "PID ${pid} still alive after SIGTERM, sending SIGKILL"
    kill -9 "${pid}" 2>/dev/null || true
    sleep 2
  fi

  # Step 4: If STILL running, kill everything on port 80
  if kill -0 "${pid}" 2>/dev/null; then
    log "PID ${pid} refuses to die, using fuser -k 80/tcp as last resort"
    fuser -k 80/tcp 2>/dev/null || true
    sleep 2
  fi

  # Step 5: Kill parent
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

  # Step 6: Additional — find any service by scanning systemd for this executable
  if [[ -n "${exe}" ]]; then
    local extra_units
    extra_units="$(systemctl list-units --type=service --all --no-legend 2>/dev/null | awk '{print $1}' | while read -r u; do
      local ep
      ep="$(systemctl show -p ExecStart "${u}" 2>/dev/null | head -1 || true)"
      if [[ "${ep}" == *"${exe}"* ]]; then
        echo "${u}"
      fi
    done || true)"
    if [[ -n "${extra_units}" ]]; then
      while read -r unit; do
        [[ -z "${unit}" ]] && continue
        if grep -Eiq 'nginx|cloudflared|sycord-vm-runner' <<<"${unit}"; then continue; fi
        log "Found additional service matching exe: ${unit}"
        systemctl stop "${unit}" 2>/dev/null || true
        systemctl disable "${unit}" 2>/dev/null || true
        systemctl mask "${unit}" 2>/dev/null || true
      done <<<"${extra_units}"
    fi
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
