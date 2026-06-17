#!/bin/bash
# ============================================================================
# Sycord — Host CDN Receiver
# ----------------------------------------------------------------------------
# Publishes a workspace build tarball (written by the in-container
# `sycord-deploy` to the shared /opt/sycord/deployments volume) to the live web
# root served at https://<workspace_id>.<base_domain>.
#
# Installed by host-setup.sh at /opt/sycord/deployments/receive-deploy.sh and
# kept here in the repo as the canonical source.
#
# Usage:  receive-deploy.sh <workspace_id>
# ============================================================================
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
