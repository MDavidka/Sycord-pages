#!/bin/bash
# ============================================================================
# Sycord — One-time Host VPS Setup (run as root on the parent Ubuntu VPS)
# ----------------------------------------------------------------------------
# Configures Docker, the isolated `sycord-net` network, the persistent
# /opt/sycord folders for keys/workspaces/deployments, the local CDN web root,
# and the CDN receiver script that publishes built workspaces live.
#
# This script is idempotent: it can safely be re-run.
# ============================================================================
set -euo pipefail

echo "==> Sycord host setup starting"

# --- Update and install Docker -------------------------------------------------
export DEBIAN_FRONTEND=noninteractive
apt-get update && apt-get upgrade -y

if ! [ -x "$(command -v docker)" ]; then
  echo "==> Installing Docker"
  apt-get install -y apt-transport-https ca-certificates curl software-properties-common gnupg lsb-release
  install -m 0755 -d /usr/share/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
  chmod a+r /usr/share/keyrings/docker-archive-keyring.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io
fi

systemctl enable --now docker || true

# --- Create isolated Docker network -------------------------------------------
if ! docker network inspect sycord-net >/dev/null 2>&1; then
  echo "==> Creating sycord-net Docker network"
  docker network create --subnet=172.18.0.0/16 sycord-net
fi

# --- Create persistent storage directories ------------------------------------
echo "==> Creating /opt/sycord directories"
mkdir -p /opt/sycord/workspaces
mkdir -p /opt/sycord/deployments
mkdir -p /opt/sycord/keys
mkdir -p /opt/sycord/image
mkdir -p /var/www/sycord.site
chmod 700 /opt/sycord/keys

# --- Install the CDN receiver script ------------------------------------------
echo "==> Installing CDN receiver script"
cat << 'EOF' > /opt/sycord/deployments/receive-deploy.sh
#!/bin/bash
# Publishes a workspace build tarball to the live web root.
set -e
WORKSPACE_ID="$1"
BASE_DOMAIN="${SYCORD_BASE_DOMAIN:-sycord.site}"
BUILD_TAR="/opt/sycord/deployments/${WORKSPACE_ID}-build.tar.gz"

if [ -z "$WORKSPACE_ID" ]; then
  echo "Error: workspace id required"
  exit 1
fi

if [ ! -f "$BUILD_TAR" ]; then
  echo "Error: Build tarball not found at $BUILD_TAR"
  exit 1
fi

EXTRACT_DIR="/var/www/sycord.site/${WORKSPACE_ID}"
rm -rf "$EXTRACT_DIR"
mkdir -p "$EXTRACT_DIR"
tar -xzf "$BUILD_TAR" -C "$EXTRACT_DIR"
echo "SUCCESS: ${WORKSPACE_ID} published to https://${WORKSPACE_ID}.${BASE_DOMAIN}"
EOF
chmod +x /opt/sycord/deployments/receive-deploy.sh

echo "==> Sycord host setup complete"
