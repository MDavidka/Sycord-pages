#!/bin/bash
# ============================================================================
# Sycord workspace container entrypoint
# ----------------------------------------------------------------------------
# Installs the injected public key for the `sycord` user, hardens the SSH
# server to key-only auth, then runs sshd in the foreground.
# ============================================================================
set -e

# Write the public key to the developer user's authorized_keys.
if [ -n "${SSH_PUBLIC_KEY:-}" ]; then
  mkdir -p /home/sycord/.ssh
  echo "$SSH_PUBLIC_KEY" > /home/sycord/.ssh/authorized_keys
  chmod 700 /home/sycord/.ssh
  chmod 600 /home/sycord/.ssh/authorized_keys
  chown -R sycord:sycord /home/sycord/.ssh
fi

# Secure the SSH server: disable password auth, allow public-key auth.
sed -i 's/#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
sed -i 's/#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config

exec /usr/sbin/sshd -D
