# Sycord Deployer Architecture (AI Agent Reference)

## CRITICAL: Docker-Based Deployment Only

**Sycord is a Docker-based deployment platform managed by Dokploy. There is NO VPS/SSH/PM2/Nginx deployment.**

### What the AI MUST NOT do:
- ❌ DO NOT run `npm install`, `npm run build`, `npm run dev`, or any npm/npx commands on a VPS
- ❌ DO NOT attempt to SSH into servers or run shell commands
- ❌ DO NOT use PM2, systemd, or init scripts
- ❌ DO NOT configure nginx, Apache, or reverse proxies manually
- ❌ DO NOT try to "download dependencies" or "compile code" outside of Docker

### How deployment works:
- ✅ ALL deployments go through the `deploy()` tool → Dokploy API → Docker containers
- ✅ Dokploy handles building (via Dockerfile + Git source or direct Docker image)
- ✅ Traefik handles routing via labels, not manual nginx config
- ✅ Everything is containerized - the AI never touches the host system

## Deployment Backend

All deployments go through **Dokploy** — a container-based deployment platform. The old SSH/PM2/Nginx runner has been removed completely.

## Traffic Flow

```
User opens <appName>.sycord.site
  → Dokploy Traefik ingress (reads Docker labels)
    → Docker container running the deployed app

AI deploy call flow:
  deploy() → /api/workspace/deploy → Dokploy API (sycord.site/api)
```

## Dokploy API

The Dokploy API uses tRPC-flavoured REST endpoints at `{baseUrl}/api/{resource}.{action}`.
Base URL: `https://sycord.site/api`

### Configuration (env vars)
- `DOKPLOY_API_URL` — base URL (default: `https://sycord.site/api`)
- `DOKPLOY_API_KEY` — `x-api-key` header value for authentication
- `DOKPLOY_SERVER_ID` — optional default server ID
- `DOKPLOY_ENVIRONMENT_ID` — optional default environment ID
- `DOKPLOY_GITHUB_ID` — GitHub App provider id

### Code Surface
- **Client:** `lib/deploy/dokploy-client.ts` — typed API client for all Dokploy endpoints
- **Route:** `app/api/deploy/dokploy/route.ts` — authenticated GET (list) + POST (all actions)
- **Deploy route:** `app/api/workspace/deploy/route.ts` — primary deploy() endpoint with auto-provisioning
- **Debug route:** `app/api/debug/route.ts` — checks Dokploy API health (use `/dubrg` command)
- **AI tools:** `glovix/lib/tools.ts` — `save`, `deploy`, `createDokployProject`, `createDokployEnvironment`, `listDokployResources`, `manageContainer`, `generateDomain`

### API Endpoints Available

**Application (`application.*`):** `create`, `one`, `deploy`, `redeploy`, `start`, `stop`, `reload`, `delete`, `markRunning`, `clearDeployments`, `cancelDeployment`, `saveEnvironment`, `saveBuildType`, `saveGithubProvider`, `saveGitProvider`, `saveDockerProvider`, `saveBitbucketProvider`, `saveGiteaProvider`, `saveGitlabProvider`, `disconnectGitProvider`, `readLogs`, `search`

**Project (`project.*`):** `create`, `one`, `all`, `remove`, `update`

**Environment (`environment.*`):** `create`, `one`, `byProjectId`, `remove`, `update`

**Domain (`domain.*`):** `create`, `byApplicationId`, `one`, `delete`, `generateDomain`, `update`

**Docker (`docker.*`):** `getContainers`, `restartContainer`, `startContainer`, `stopContainer`, `killContainer`, `removeContainer`, `getConfig`, `getContainersByAppNameMatch`, `getContainersByAppLabel`, `getStackContainersByAppName`, `getServiceContainersByAppName`, `uploadFileToContainer`

## Project/Service ID Architecture (Per-User Logic)

### The Key Rule: ONE Project per User, ONE Application per Deployment

```
User Account
  └── Dokploy Project (same ID for ALL user's deployments)
        └── Environment (e.g., "production")
              └── Application/Service (NEW per project/deployment)
                    └── Docker container(s)
```

### How it works:

1. **Project ID (constant per user):**
   - Each user has ONE Dokploy project that is created on their first deployment
   - All subsequent deployments for that user reuse the SAME project
   - Project ID is stored as `dokployProjectId` on the user's project document
   - The project name can be the user's business name or "Sycord User - {userId}"

2. **Service/Application ID (unique per deployment/project):**
   - Each new project deployment gets its OWN application (service) in Dokploy
   - Stored as `dokployApplicationId` on the project document
   - Multiple applications can exist under one project (one per deployed app)

3. **Environment:**
   - The default "production" environment is auto-created with the project
   - Stored as `dokployEnvironmentId`

### Deployment Resolution Order:
1. **Project:** Reuse `dokployProjectId` if exists, otherwise create new
2. **Environment:** Reuse `dokployEnvironmentId` if exists, otherwise fetch or create "production"
3. **Application:** Reuse `dokployApplicationId` if exists (for this specific project), otherwise create new
4. **Build Type:** Always `dockerfile` (not nixpacks, heroku_buildpacks, etc.)
5. **Git Source:** Attach via `saveGithubProvider` or `saveGitProvider`
6. **Deploy:** Trigger via `application.deploy`

## /dubrg Command (Debug Connection Status)

Use the `/dubrg` slash command to check if Dokploy is properly connected:

The command calls `GET /api/debug` which returns:
- **`configured`**: Whether `DOKPLOY_API_KEY` is set
- **`reachable`**: Whether the Dokploy API responds
- **`apiUrl`**: The configured API URL
- **`projectsCount`**: Number of projects (indicates successful auth)
- **`latencyMs`**: API response time
- **`error`**: Error message if not reachable (e.g., "Invalid API key", "Connection refused")

### Debug Response Examples:

**Connected:**
```json
{
  "timestamp": "2024-...",
  "dokploy": {
    "configured": true,
    "reachable": true,
    "apiUrl": "https://sycord.site/api",
    "projectsCount": 3,
    "latencyMs": 45
  }
}
```

**Not Connected (reason shown):**
```json
{
  "timestamp": "2024-...",
  "dokploy": {
    "configured": true,
    "reachable": false,
    "apiUrl": "https://sycord.site/api",
    "projectsCount": 0,
    "latencyMs": null,
    "error": "Invalid API key"
  }
}
```

## AI Tools

| Tool | Description |
|------|-------------|
| `save` | Push project files to GitHub (required BEFORE deploy) |
| `deploy` | Deploy project via Dokploy (auto-provisions project/environment/app, builds via Docker) |
| `createDokployProject` | Create a new Dokploy project (rarely needed - deploy() auto-creates) |
| `createDokployEnvironment` | Create a new environment in a Dokploy project |
| `listDokployResources` | List projects, environments, containers, deployments, or domains |
| `manageContainer` | Restart, start, stop, kill, or remove a Docker container |
| `generateDomain` | Generate a Traefik domain for a Dokploy application |

## deploy() Tool Detailed Logic

The `deploy()` tool (`POST /api/workspace/deploy`) performs this exact sequence:

```
1. INPUT: projectId, GitHub source (owner/repo/branch)

2. CHECK: Is Dokploy configured?
   - No → Return error "Dokploy is not configured"

3. GET USER PROJECT from MongoDB
   - Find user's project document
   - Extract: dokployProjectId, dokployEnvironmentId, dokployApplicationId

4. AUTO-GENERATE DOCKERFILE if missing
   - Create multi-stage Dockerfile for the project type (Next.js, React, etc.)
   - Save to project pages

5. ENSURE DOKPLOY PROJECT (reuse if exists)
   - If dokployProjectId exists → skip creation
   - Else → POST /project.create with user/business name
   - Save returned projectId to user's project document

6. ENSURE ENVIRONMENT (reuse if exists)
   - If dokployEnvironmentId exists → skip
   - Else → GET /environment.byProjectId (look for "production")
   - If none found → POST /environment.create with name="production"
   - Save returned environmentId

7. ENSURE APPLICATION/SERVICE (create if not exists for this deployment)
   - If dokployApplicationId exists → skip creation
   - Else → POST /application.create with:
       - name: app name
       - appName: sanitized slug
       - environmentId: from step 6
   - Save returned applicationId

8. CONFIGURE BUILD TYPE (always dockerfile)
   - POST /application.saveBuildType with:
       - buildType: "dockerfile"
       - dockerfile: "Dockerfile"
       - dockerContextPath: "/"

9. ATTACH GIT SOURCE
   - POST /application.saveGithubProvider (if GitHub App connected)
     OR
   - POST /application.saveGitProvider (if public git URL)

10. SAVE ENV VARS
    - POST /application.saveEnvironment with env variables

11. TRIGGER DEPLOY
    - POST /application.deploy

12. SAVE RESULT
    - Update MongoDB with all IDs
    - Return: url, projectId, environmentId, applicationId, created flags
```

## Dockerfile Requirements

Every deployed application MUST have a Dockerfile. The `deploy()` tool auto-generates one if missing.

### Dockerfile Must:
- Use multi-stage builds (deps → builder → runner)
- Run as non-root user in runner stage
- Expose the correct port
- Set `ENV NODE_ENV=production`
- Include HEALTHCHECK directive

### Dockerfile Auto-generation:
The system auto-generates Dockerfiles for:
- **Next.js**: Multi-stage with standalone output
- **React/Vite**: Build → nginx static serving
- **Generic Node.js**: Build → production install

## Important Notes

1. **Services are ALWAYS Docker type** - No heroku_buildpacks, nixpacks, or other build types
2. **No VPS commands** - The AI should never try to run `npm install` or similar on the host
3. **Project is per-user** - One project ID reused for all deployments by the same user
4. **Service is per-deployment** - Each project/deployment gets its own application ID
5. **Always save() before deploy()** - GitHub source is required for Dokploy to build
