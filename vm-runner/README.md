# Sycord VM Runner

A Node.js/TypeScript mini-server running on the Ubuntu VM to build, deploy, and manage AI-generated Next.js websites.

## Architecture

1. Sycord App sends website files to this mini-server.
2. The mini-server installs dependencies and builds the project.
3. PM2 starts the process.
4. Nginx proxy config is generated to map the subdomain to the local port.
5. Cloudflared handles routing the public traffic into Nginx.
