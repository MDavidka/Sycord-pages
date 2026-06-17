# ============================================================================
# Sycord — Workspace base image (sycord/workspace-base)
# ----------------------------------------------------------------------------
# A self-contained Ubuntu dev container the AI agent connects into over SSH to
# write, build and deploy a Next.js app. Exposes SSH on 22; the host maps it to
# a dynamic port during provisioning.
# ============================================================================
FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    openssh-server \
    curl \
    git \
    sudo \
    ca-certificates \
    build-essential \
    libpng-dev \
    libwebp-dev \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir /var/run/sshd

# Install Node.js v20 and pnpm.
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g pnpm

# Create a non-root developer user with passwordless sudo.
RUN useradd -m -s /bin/bash sycord \
    && echo "sycord ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Prepare the workspace directory.
RUN mkdir -p /workspace && chown -R sycord:sycord /workspace

COPY entrypoint.sh /entrypoint.sh
COPY sycord-deploy /usr/bin/sycord-deploy
RUN chmod +x /entrypoint.sh /usr/bin/sycord-deploy

EXPOSE 22
ENTRYPOINT ["/entrypoint.sh"]
