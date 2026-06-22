# Sycord Deployer Architecture (AI Agent Reference)

## Deployment Backend

All deployments go through **Dokploy** — a container-based deployment platform running on the VPS.
The old SSH/PM2/Nginx runner has been removed.

## Traffic Flow

```
User opens <appName>.sycord.site
  → Dokploy Traefik ingress
    → Docker container running the deployed app

Deploy calls go through the Next.js API routes:
  Syra AI → /api/workspace/deploy → Dokploy API (localhost:3000/api)
```

## Dokploy API

The Dokploy API uses tRPC-flavoured REST endpoints at `{baseUrl}/api/{resource}.{action}`.

### Configuration (env vars)
- `DOKPLOY_API_URL` — base URL (default: `http://localhost:3000/api`)
- `DOKPLOY_API_KEY` — `x-api-key` header value for authentication
- `DOKPLOY_SERVER_ID` — optional default server ID
- `DOKPLOY_ENVIRONMENT_ID` — optional default environment ID
- `DOKPLOY_GITHUB_ID` — GitHub App provider id

### Code Surface
- **Client:** `lib/deploy/dokploy-client.ts` — typed API client for all Dokploy endpoints
- **Route:** `app/api/deploy/dokploy/route.ts` — authenticated GET (list) + POST (all actions)
- **Deploy route:** `app/api/workspace/deploy/route.ts` — primary deploy() endpoint with auto-provisioning
- **Debug route:** `app/api/debug/route.ts` — checks Dokploy API health
- **AI tools:** `glovix/lib/tools.ts` — `save`, `deploy`, `createDokployProject`, `createDokployEnvironment`, `listDokployResources`, `manageContainer`, `generateDomain`

### API Endpoints Available

**Docker (`docker.*`):** `getContainers`, `restartContainer`, `startContainer`, `stopContainer`, `killContainer`, `removeContainer`, `getConfig`, `getContainersByAppNameMatch`, `getContainersByAppLabel`, `getStackContainersByAppName`, `getServiceContainersByAppName`, `uploadFileToContainer`

**Application (`application.*`):** `create`, `one`, `deploy`, `redeploy`, `start`, `stop`, `reload`, `delete`, `markRunning`, `clearDeployments`, `cancelDeployment`, `saveEnvironment`, `saveBuildType`, `saveGithubProvider`, `saveGitProvider`, `saveDockerProvider`, `saveBitbucketProvider`, `saveGiteaProvider`, `saveGitlabProvider`, `disconnectGitProvider`, `readLogs`, `search`

**Project (`project.*`):** `create`, `one`, `all`, `remove`, `update`

**Environment (`environment.*`):** `create`, `one`, `byProjectId`, `remove`, `update`

**Domain (`domain.*`):** `create`, `byApplicationId`, `one`, `delete`, `generateDomain`, `update`

### App-facing Route: `/api/deploy/dokploy`

#### GET — listings
```
GET /api/deploy/dokploy                          # list all containers
GET /api/deploy/dokploy?applicationId=abc        # single application detail
GET /api/deploy/dokploy?appName=my-app           # containers by app name
GET /api/deploy/dokploy?resource=projects         # list all projects
GET /api/deploy/dokploy?resource=projects&projectId=abc   # single project
GET /api/deploy/dokploy?resource=environments&projectId=abc  # environments by project
GET /api/deploy/dokploy?resource=domains&applicationId=abc   # domains by application
GET /api/deploy/dokploy?resource=deployments&applicationId=abc # deployments by application
```

#### POST — all actions
```json
{ "action": "createProject", "projectName": "My Project", "projectDescription": "Optional" }
{ "action": "createEnvironment", "environmentName": "staging", "environmentProjectId": "abc" }
{ "action": "restartContainer", "containerId": "def456" }
{ "action": "startContainer", "containerId": "def456" }
{ "action": "stopContainer", "containerId": "def456" }
{ "action": "killContainer", "containerId": "def456" }
{ "action": "removeContainer", "containerId": "def456" }
{ "action": "generateDomain", "appName": "my-app" }
{ "action": "deploy", "applicationId": "app_123", "syncEnv": true }
{ "action": "redeploy", "applicationId": "app_123" }
{ "action": "start", "applicationId": "app_123" }
{ "action": "stop", "applicationId": "app_123" }
{ "action": "reload", "applicationId": "app_123", "appName": "my-app" }
{ "action": "delete", "applicationId": "app_123" }
```

## Auto-provisioning Chain (deploy tool)

The `deploy()` tool (`POST /api/workspace/deploy`) provisions the full Dokploy hierarchy:

1. **Project** — reuse `project.dokployProjectId`, else `POST /project.create`
2. **Environment** — reuse `project.dokployEnvironmentId`, else `GET /environment.byProjectId`, else `POST /environment.create`
3. **Application** — reuse `project.dokployApplicationId`, else `POST /application.create`
4. **Env vars** — `POST /application.saveEnvironment`
5. **Git source** — `POST /application.saveGithubProvider` or `saveGitProvider`
6. **Deploy** — `POST /application.deploy`

All ids are persisted on the project document for reuse on subsequent deploys.

## AI Tools

| Tool | Description |
|------|-------------|
| `save` | Push project files to GitHub (required before deploy) |
| `deploy` | Deploy project via Dokploy (auto-provisions project/environment/app) |
| `createDokployProject` | Create a new Dokploy project |
| `createDokployEnvironment` | Create a new environment in a Dokploy project |
| `listDokployResources` | List projects, environments, containers, deployments, or domains |
| `manageContainer` | Restart, start, stop, kill, or remove a Docker container |
| `generateDomain` | Generate a Traefik domain for a Dokploy application |

## /debug Command

The `/debug` slash command in the chat pane checks if the Dokploy API is reachable:
- Shows whether `DOKPLOY_API_KEY` is configured
- Shows whether the API URL responds
- Shows project count and latency
- No SSH/VPS/Cloudflare probing

## Docker Infrastructure Knowledge

### Docker Socket & Permissions
Dokploy and the backend run inside Docker but need to manage other containers. Mount the host Docker socket:
```bash
sudo chmod 666 /var/run/docker.sock
docker run -v /var/run/docker.sock:/var/run/docker.sock ...
```

### Isolated Docker Network
All workspace containers, proxies, and tunnels must run on the same Docker network to resolve each other by container name:
```bash
docker network create --subnet=172.18.0.0/16 sycord-net
docker run --network sycord-net ...
```

### Dockerfile Best Practices (auto-generated by `createDockerfile` tool)

1. **npm ci vs npm install**: `npm ci` is faster but crashes if `package-lock.json` is missing. The tool auto-falls back: `(npm ci && npm cache clean --force) || (npm install --no-audit --no-fund --prefer-offline && npm cache clean --force)`

2. **Non-root user**: Runner stages create a dedicated `appuser:appgroup` non-root user with `chown -R appuser:appgroup /app` before `USER appuser`.

3. **Multi-stage builds**: Separate `deps` → `builder` → `runner` stages for minimal final image size.

4. **Cache invalidation**: Docker caches `COPY . .` aggressively. Bumping the version in `package.json` on every save forces cache invalidation.

5. **Layer ordering**: `COPY package*.json` before `COPY . .` so dependency installs are cached unless package.json changes.

6. **Health checks**: All runner stages include `HEALTHCHECK` with wget probes every 30s.

7. **libc6-compat**: Alpine-based `deps` stage installs `libc6-compat` for native module compatibility.

### Dynamic Port Mapping
Let Docker allocate free host ports to avoid collisions:
```bash
docker run -p "0:22" ...  # Docker allocates random host port for container port 22
docker port <container_name> 22 | cut -d':' -f2  # retrieve allocated port
```

### TypeScript Crypto Bypass
When generating SSH keys with `crypto.generateKeyPairSync`, TypeScript's type definitions throw overload errors on `"ed25519"`. Always cast:
```typescript
crypto.generateKeyPairSync("ed25519" as any, { ... } as any)
```

### Dokploy Build Type
Dokploy applications must be configured to use Dockerfile builds. The `deploy()` flow automatically calls `application.saveBuildType` with `buildType: "dockerfile"` and `dockerfile: "Dockerfile"`.
