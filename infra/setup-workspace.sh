#!/bin/bash
# ============================================================================
# Sycord — Dynamic Workspace Provisioning (run as root on the parent VPS)
# ----------------------------------------------------------------------------
# Spins up an isolated Docker container for a single project, generates a
# dedicated Ed25519 keypair for SSH access, maps a dynamic host SSH port, and
# prints a JSON payload describing the connection details.
#
# Usage:  bash /opt/sycord/setup-workspace.sh <project_name>
#
# The JSON payload is emitted between the markers below so callers can parse it
# reliably even when Docker/apt print extra output. The private key is base64
# encoded so the JSON stays single-line and valid.
# ============================================================================
set -euo pipefail

PROJECT_NAME="${1:-}"
if [ -z "$PROJECT_NAME" ]; then
  echo "Error: Project name required." >&2
  exit 1
fi

IMAGE="${SYCORD_WORKSPACE_IMAGE:-sycord/workspace-base:latest}"

# Normalise the container name: lowercase, alphanumerics + dashes only.
CONTAINER_NAME="sycord-${PROJECT_NAME//[^a-zA-Z0-9]/-}"
CONTAINER_NAME="$(echo "$CONTAINER_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/-\{2,\}/-/g; s/-*$//')"

KEY_DIR="/opt/sycord/keys/$CONTAINER_NAME"
mkdir -p "$KEY_DIR"

# Generate a secure Ed25519 keypair for the container (once).
if [ ! -f "$KEY_DIR/id_ed25519" ]; then
  ssh-keygen -t ed25519 -f "$KEY_DIR/id_ed25519" -N "" -q -C "agent@$CONTAINER_NAME"
fi

PRIVATE_KEY_B64="$(base64 -w0 < "$KEY_DIR/id_ed25519")"
PUBLIC_KEY="$(cat "$KEY_DIR/id_ed25519.pub")"

# Build the base image locally if it is missing.
if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  if [ -f /opt/sycord/image/Dockerfile ]; then
    echo "==> Building workspace base image $IMAGE" >&2
    docker build -t "$IMAGE" /opt/sycord/image >&2
  else
    echo "Error: image $IMAGE not found and /opt/sycord/image/Dockerfile is missing." >&2
    exit 1
  fi
fi

# Recreate the container if it already exists so provisioning is idempotent.
if docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
fi

mkdir -p "/opt/sycord/workspaces/$CONTAINER_NAME"

docker run -d \
  --name "$CONTAINER_NAME" \
  --network sycord-net \
  --memory="2g" \
  --cpus="2" \
  --restart unless-stopped \
  -e "SSH_PUBLIC_KEY=$PUBLIC_KEY" \
  -e "WORKSPACE_ID=$CONTAINER_NAME" \
  -v "/opt/sycord/workspaces/$CONTAINER_NAME:/workspace" \
  -v "/opt/sycord/deployments:/deployments" \
  -p "0:22" \
  "$IMAGE" >&2

# Resolve the dynamically assigned host SSH port.
HOST_PORT="$(docker port "$CONTAINER_NAME" 22 | head -n1 | cut -d':' -f2)"
SSH_HOST="$(hostname -I | awk '{print $1}')"

# Emit the connection payload (private key base64 encoded).
echo "---SYCORD_JSON_BEGIN---"
cat <<EOF
{"status":"success","container_name":"$CONTAINER_NAME","ssh_host":"$SSH_HOST","ssh_port":$HOST_PORT,"ssh_user":"sycord","private_key_b64":"$PRIVATE_KEY_B64","public_key":"$PUBLIC_KEY"}
EOF
echo "---SYCORD_JSON_END---"
