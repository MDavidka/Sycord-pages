#!/bin/bash
# ============================================================================
# Sycord — Tear down a workspace container and its artifacts (run as root)
# ----------------------------------------------------------------------------
# Removes the container, its workspace volume, generated keys, deployment
# tarball and the published site directory.
#
# Usage:  bash /opt/sycord/destroy-workspace.sh <container_name>
# ============================================================================
set -euo pipefail

CONTAINER_NAME="${1:-}"
if [ -z "$CONTAINER_NAME" ]; then
  echo "Error: container name required." >&2
  exit 1
fi

docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
rm -rf "/opt/sycord/workspaces/$CONTAINER_NAME"
rm -rf "/opt/sycord/keys/$CONTAINER_NAME"
rm -f "/opt/sycord/deployments/${CONTAINER_NAME}-build.tar.gz"
rm -rf "/var/www/sycord.site/${CONTAINER_NAME}"

echo "SUCCESS: ${CONTAINER_NAME} destroyed"
