import { executeCommand, writeFile, readFile, renameFile, deleteFile } from './webcontainer';
import { useStore } from '../store';
import { parseToolArguments } from './utils';
import { getHostProjectId, getProjectPagesMap, deleteProjectPage, isPageBackedFile } from './api';

/**
 * Result of attempting to persist a file to the project's Pages (MongoDB).
 * - `saved`   → the file was written to the Pages store (source of truth)
 * - `skipped` → not embedded in the dashboard, or a system/env file that must
 *               never become a page (this is NOT an error)
 * - `error`   → the Pages API rejected or could not be reached
 */
type PageSyncResult =
    | { status: 'saved' }
    | { status: 'skipped' }
    | { status: 'error'; message: string };

/**
 * Persist a single file to the project's Pages (MongoDB) via the REST API.
 *
 * This is the SOURCE OF TRUTH for the project's file base when Glovix is
 * embedded in the Sycord dashboard. It is intentionally independent of the
 * in-browser WebContainer filesystem so that a WebContainer failure — such as
 * the "object can not be cloned" DataCloneError thrown by the preview bridge —
 * can never block a file from being saved.
 */
async function syncFileToProjectPages(path: string, content: string): Promise<PageSyncResult> {
    const projectId = getHostProjectId();
    if (!projectId) return { status: 'skipped' };
    // Skip system / picker / env files — these must never become pages
    if (path.startsWith('.glovix/') || path === 'glovix-picker.js' || /^\.env(?:\.|$)/.test(path)) {
        return { status: 'skipped' };
    }
    try {
        const res = await fetch(`/api/projects/${projectId}/pages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: path, content, usedFor: 'AI Builder' }),
        });
        if (!res.ok) {
            let message = `HTTP ${res.status}`;
            try {
                const data = await res.json();
                if (data?.message) message = data.message;
            } catch { /* response had no JSON body */ }
            console.warn(`[GlovixTools] Pages API rejected "${path}": ${message}`);
            return { status: 'error', message };
        }
        return { status: 'saved' };
    } catch (err: any) {
        const message = err?.message || 'network error';
        console.warn(`[GlovixTools] Failed to sync "${path}" to pages API:`, err);
        return { status: 'error', message };
    }
}

/**
 * Best-effort write into the in-browser WebContainer filesystem so the live
 * preview reflects the change. The WebContainer is a preview convenience only;
 * when it is unavailable or its worker bridge throws (e.g. the
 * "object can not be cloned" DataCloneError), we swallow the error so the save
 * to Pages still succeeds. Returns the warning message, or null on success.
 */
async function tryWriteToWebContainer(path: string, content: string): Promise<string | null> {
    try {
        await writeFile(path, content);
        return null;
    } catch (e: any) {
        const message = e?.message || String(e);
        console.warn(`[GlovixTools] WebContainer preview write failed for "${path}" (file still saved to Pages):`, message);
        return message;
    }
}

/**
 * Pull the project's file base from the Pages tab (MongoDB) — the SOURCE OF
 * TRUTH when embedded in the dashboard — and mirror it into the in-memory store
 * so the UI/preview stays in sync. System/internal files that are not stored as
 * pages (`.glovix/`, `glovix-picker.js`, `.env*`) are preserved from the store.
 *
 * Returns the resulting files map, or null when not embedded (standalone
 * /builder), in which case callers keep using the local store as before.
 */
async function syncStoreFromPages(): Promise<Record<string, { file: { contents: string } }> | null> {
    if (!getHostProjectId()) return null;
    const pages = await getProjectPagesMap();
    if (!pages) return null; // request failed — keep current local state

    const state = useStore.getState();
    // Start from page-backed truth, then re-attach local system/internal files
    // that are intentionally never stored as pages.
    const merged: Record<string, { file: { contents: string } }> = { ...pages };
    for (const [name, file] of Object.entries(state.files)) {
        if (!isPageBackedFile(name)) {
            merged[name] = file;
        }
    }
    state.setFiles(merged);
    return merged;
}

/**
 * Read a file's content. When embedded in a Sycord project the Pages tab is the
 * source of truth, so we refresh from Pages first and read the freshly-synced
 * content. We then fall back to the WebContainer FS / in-memory store for
 * non-page files or when the Pages request is unavailable, so reads keep
 * working even if a layer is temporarily broken.
 */
async function readFileResilient(path: string, opts?: { skipPagesSync?: boolean }): Promise<string> {
    const normalized = path.replace(/^\/+/, '');

    // Pages-first for page-backed files when embedded.
    if (!opts?.skipPagesSync && getHostProjectId() && isPageBackedFile(normalized)) {
        const synced = await syncStoreFromPages();
        const fromPages = synced?.[normalized]?.file?.contents;
        if (fromPages !== undefined) return fromPages;
        // Not in Pages — fall through to WebContainer/store fallbacks below.
    } else if (opts?.skipPagesSync) {
        // Caller already synced from Pages — read the cached page content first.
        const cached = useStore.getState().files[normalized]?.file?.contents;
        if (cached !== undefined) return cached;
    }

    try {
        return await readFile(path);
    } catch (e: any) {
        const stored = useStore.getState().files[normalized] ?? useStore.getState().files[path];
        if (stored?.file?.contents !== undefined) {
            return stored.file.contents;
        }
        throw e;
    }
}

/**
 * Persist a file to every layer in the correct order of durability:
 *   1. the in-memory store (drives the UI + preview mount), always
 *   2. the project's Pages (MongoDB) — the durable source of truth
 *   3. the WebContainer FS — best-effort live preview only
 * Returns the Pages persistence result so callers can surface real failures.
 */
async function persistFile(path: string, content: string): Promise<PageSyncResult> {
    const state = useStore.getState();
    state.setFiles({ ...state.files, [path]: { file: { contents: content } } });
    state.removeErrorsForFile(path);

    const pageSync = await syncFileToProjectPages(path, content);
    await tryWriteToWebContainer(path, content);
    return pageSync;
}

// ============================================================
// SYCORD SERVER-SIDE WORKSPACE (execute / diagnostics / deploy)
//
// When embedded in a Sycord project, command execution, type diagnostics and
// deploys run on a sandboxed server (the /api/workspace/* endpoints) instead of
// the in-browser WebContainer. This avoids browser crashes / serialization
// ("object can not be cloned") / "not a valid workspace" failures entirely.
// ============================================================

/** True when running inside a Sycord project (server-side workspace available). */
function isServerWorkspace(): boolean {
    return !!getHostProjectId();
}

/** Run structured TypeScript diagnostics on the server-side workspace. */
async function typeCheckServerSide(projectId: string): Promise<string> {
    try {
        const res = await fetch(`/api/workspace/diagnostics?projectId=${encodeURIComponent(projectId)}`);
        if (!res.ok) {
            const msg = await res.text().catch(() => '');
            return `[SYSTEM] ❌ Type check could not run on the Sycord server (HTTP ${res.status}). ${msg}`.trim();
        }
        const data = await res.json();
        const errors: Array<{ file: string; line: number; message: string }> = Array.isArray(data?.errors) ? data.errors : [];

        if (errors.length === 0) {
            return '[SYSTEM] ✅ TypeScript check passed: No type errors found.';
        }

        // Feed the Error Panel.
        try {
            const parsed = errors.map((e) => ({
                file: e.file,
                line: e.line,
                column: 1,
                message: e.message,
                type: 'typescript' as const,
            }));
            useStore.getState().addParsedErrors(parsed as any);
        } catch { /* error panel is best-effort */ }

        const lines = errors
            .slice(0, 50)
            .map((e) => `  ${e.file}:${e.line} — ${e.message}`)
            .join('\n');
        return `[SYSTEM] TypeScript check found ${errors.length} error(s):\n${lines}\n\nYou MUST fix these errors now. Use readFile on the affected files, then editFile or createFile to fix them.`;
    } catch (e: any) {
        return `Error running TypeScript check on the server: ${e.message}`;
    }
}

/**
 * Save the project's source files to GitHub (creates the repo on first save).
 * This must run before deploy() so Dokploy has a git source to build from.
 */
export async function handleSave(): Promise<string> {
    const projectId = getHostProjectId();
    if (!projectId) {
        return '[SYSTEM] ❌ Save is only available when building inside a Sycord project.';
    }
    try {
        const res = await fetch(`/api/workspace/github-save?projectId=${encodeURIComponent(projectId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
        });
        const data = await res.json().catch(() => ({} as any));
        if (!res.ok || data?.status !== 'success' || !data?.url) {
            const errMsg = data?.message || "HTTP " + res.status;
            return "[SYSTEM] ❌ Save failed: " + errMsg;
        }
        return "[SYSTEM] ✅ Saved " + data.filesCount + " file(s) to GitHub: " + data.url + " (branch " + data.branch + "). You can now deploy().";
    } catch (e: any) {
        return "Error saving project to GitHub: " + e.message;
    }
}

/**
 * Deploy the project to sycord.site via the Dokploy API.
 *
 * IMPORTANT: This is a Docker-based deployment platform. The AI should NEVER
 * attempt to run npm install, npm build, or any other VPS-level commands.
 * Everything is handled through Docker containers managed by Dokploy.
 *
 * Deployment Logic (Per-User Project, Per-Deployment Service):
 * 1. User's Dokploy Project ID is reused across all their deployments
 * 2. Each new deployment gets its own Application/Service ID under that project
 * 3. The Dockerfile is auto-generated if missing
 * 4. Dokploy builds via GitHub source and deploys to Docker
 *
 * This single call performs three operations server-side:
 *  1. Set Application Build Type to Dockerfile (/application.saveBuildType)
 *  2. Create/ensure Application Domain (/domain.create) with host <appName>.sycord.site
 *  3. Trigger Deployment (/application.deploy) to build and serve the Docker container
 *
 * Also handles:
 *  - Auto-generates a Dockerfile if one doesn't exist in project pages
 *  - Reuses existing Dokploy project for this user (creates if first time)
 *  - Creates a NEW application/service for this specific deployment
 *  - Configures Dockerfile build type (always Docker, never nixpacks/heroku)
 *  - Attaches the GitHub source before triggering the deployment
 *
 * No browser-side file checks or WebContainer — everything runs on the server.
 * Returns the live URL and all provisioned IDs on success.
 *
 * IMPORTANT: Always call save() BEFORE deploy() to push code to GitHub first.
 */
export async function handleDeploy(): Promise<string> {
    const projectId = getHostProjectId();
    if (!projectId) {
        return '[SYSTEM] ❌ Deploy is only available when building inside a Sycord project.';
    }
    try {
        const res = await fetch("/api/workspace/deploy?projectId=" + encodeURIComponent(projectId), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                buildType: "dockerfile",
                dockerfile: "Dockerfile",
                dockerContextPath: "/",
            }),
        });
        const data = await res.json().catch(() => ({} as any));
        if (!res.ok || data?.status !== 'success' || !data?.url) {
            const errMsg = data?.message || "HTTP " + res.status;
            return "[SYSTEM] ❌ Deploy failed: " + errMsg + "\n\nDebug: " + JSON.stringify({ steps: data?.steps, error: data?.error }, null, 2);
        }
        return "[SYSTEM] ✅ Deployed successfully.\n\n" +
            "Live URL: " + data.url + "\n" +
            "Project ID: " + (data.projectId || "auto") + "\n" +
            "Environment ID: " + (data.environmentId || "auto") + "\n" +
            "Application ID: " + (data.applicationId || "auto") + "\n" +
            "Created: project=" + (data.createdProject ? "yes" : "no") + ", env=" + (data.createdEnvironment ? "yes" : "no") + ", app=" + (data.created ? "yes" : "no");
    } catch (e: any) {
        return "Error deploying project: " + e.message;
    }
}

async function callDokployApi(action: string, extra: Record<string, unknown> = {}): Promise<string> {
    try {
        const res = await fetch("/api/deploy/dokploy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, ...extra }),
        });
        const data = await res.json().catch(() => ({} as any));
        if (!res.ok || !data?.success) {
            const errMsg = data?.error || data?.message || "HTTP " + res.status;
            return "[SYSTEM] ❌ Dokploy " + action + " failed: " + errMsg;
        }
        return JSON.stringify(data, null, 2);
    } catch (e: any) {
        return "Error calling Dokploy API (" + action + "): " + e.message;
    }
}

async function callDokployGet(params: Record<string, string>): Promise<string> {
    try {
        const qs = new URLSearchParams(params).toString();
        const res = await fetch("/api/deploy/dokploy?" + qs, {
            headers: { Accept: "application/json" },
        });
        const data = await res.json().catch(() => ({} as any));
        if (!res.ok || !data?.success) {
            const errMsg = data?.error || data?.message || "HTTP " + res.status;
            return "[SYSTEM] ❌ Dokploy query failed: " + errMsg;
        }
        return JSON.stringify(data, null, 2);
    } catch (e: any) {
        return "Error calling Dokploy API (query): " + e.message;
    }
}

/**
 * Create a new Dokploy project.
 */
export async function handleCreateProject(args: Record<string, unknown>): Promise<string> {
    const name = typeof args.name === "string" ? args.name.trim() : "";
    if (!name) return "[SYSTEM] ❌ Project name is required.";
    return callDokployApi("createProject", { projectName: name, projectDescription: (args.description as string) || null });
}

/**
 * Create a new environment in a Dokploy project.
 */
export async function handleCreateEnvironment(args: Record<string, unknown>): Promise<string> {
    const name = typeof args.name === "string" ? args.name.trim() : "";
    const projectId = typeof args.projectId === "string" ? args.projectId.trim() : "";
    if (!name) return "[SYSTEM] ❌ Environment name is required.";
    if (!projectId) return "[SYSTEM] ❌ projectId is required to create an environment.";
    return callDokployApi("createEnvironment", { environmentName: name, environmentProjectId: projectId });
}

/**
 * List Dokploy projects or containers.
 */
export async function handleListDokployResources(args: Record<string, unknown>): Promise<string> {
    const resource = (typeof args.resource === "string" ? args.resource : "containers") as string;
    const params: Record<string, string> = { resource };
    if (args.projectId && typeof args.projectId === "string") params.projectId = args.projectId;
    if (args.applicationId && typeof args.applicationId === "string") params.applicationId = args.applicationId;
    if (args.appName && typeof args.appName === "string") params.appName = args.appName;
    return callDokployGet(params);
}

/**
 * Manage a Docker container (start, stop, restart, kill, remove).
 */
export async function handleManageContainer(args: Record<string, unknown>): Promise<string> {
    const containerId = typeof args.containerId === "string" ? args.containerId.trim() : "";
    const operation = (typeof args.operation === "string" ? args.operation : "restart") as string;
    if (!containerId) return "[SYSTEM] ❌ containerId is required.";
    const actionMap: Record<string, string> = {
        restart: "restartContainer",
        start: "startContainer",
        stop: "stopContainer",
        kill: "killContainer",
        remove: "removeContainer",
    };
    const action = actionMap[operation];
    if (!action) return `[SYSTEM] ❌ Unknown container operation: "${operation}". Use restart, start, stop, kill, or remove.`;
    return callDokployApi(action, { containerId });
}

/**
 * Generate a Traefik domain for a Dokploy application.
 */
export async function handleGenerateDomain(args: Record<string, unknown>): Promise<string> {
    const appName = typeof args.appName === "string" ? args.appName.trim() : "";
    if (!appName) return "[SYSTEM] ❌ appName is required to generate a domain.";
    return callDokployApi("generateDomain", { appName });
}

/**
 * Generate a Dockerfile optimized for the project framework.
 * - Multi-stage builds for small final images
 * - Falls back from npm ci to npm install when package-lock.json is missing
 * - Runs as non-root user in runner stages
 * - Uses Docker build cache efficiently with COPY package*.json first
 */
export async function handleCreateDockerfile(args: Record<string, unknown>): Promise<string> {
    const framework = typeof args.framework === "string" ? args.framework.toLowerCase() : "nextjs";
    const nodeVersion = (typeof args.nodeVersion === "string" ? args.nodeVersion : "22") || "22";
    const port = (typeof args.port === "string" ? args.port : "3000") || "3000";

    // npm ci fails if package-lock.json is missing — fall back to npm install
    const npmInstall = "npm install --no-audit --no-fund --prefer-offline && npm cache clean --force";
    const npmCi = "(npm ci && npm cache clean --force) || (" + npmInstall + ")";

    let dockerfile = "";
    if (framework === "nextjs" || framework === "next") {
        dockerfile = "# syntax=docker/dockerfile:1\n" +
"# Multi-stage Next.js Dockerfile — optimized for Dokploy deployments\n" +
"FROM node:" + nodeVersion + "-alpine AS deps\n" +
"WORKDIR /app\n" +
"COPY package*.json ./\n" +
"RUN apk add --no-cache libc6-compat && " + npmCi + "\n" +
"\n" +
"FROM node:" + nodeVersion + "-alpine AS builder\n" +
"WORKDIR /app\n" +
"COPY --from=deps /app/node_modules ./node_modules\n" +
"COPY . .\n" +
"RUN npm run build\n" +
"\n" +
"FROM node:" + nodeVersion + "-alpine AS runner\n" +
"WORKDIR /app\n" +
"RUN addgroup -S appgroup && adduser -S appuser -G appgroup\n" +
"COPY --from=builder /app/public ./public\n" +
"COPY --from=builder /app/.next/standalone ./\n" +
"COPY --from=builder /app/.next/static ./.next/static\n" +
"RUN chown -R appuser:appgroup /app\n" +
"USER appuser\n" +
"EXPOSE " + port + "\n" +
"ENV PORT=" + port + "\n" +
"ENV NODE_ENV=production\n" +
"HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \\\n" +
"  CMD wget -qO- http://127.0.0.1:" + port + "/ || exit 1\n" +
"CMD [\"node\", \"server.js\"]\n";
    } else if (framework === "react" || framework === "vite") {
        dockerfile = "# syntax=docker/dockerfile:1\n" +
"# React / Vite static site Dockerfile\n" +
"FROM node:" + nodeVersion + "-alpine AS builder\n" +
"WORKDIR /app\n" +
"COPY package*.json ./\n" +
"RUN " + npmCi + "\n" +
"COPY . .\n" +
"RUN npm run build\n" +
"\n" +
"FROM nginx:alpine AS runner\n" +
"COPY --from=builder /app/dist /usr/share/nginx/html\n" +
"COPY nginx.conf /etc/nginx/conf.d/default.conf 2>/dev/null; true\n" +
"RUN echo 'server { listen 80; root /usr/share/nginx/html; index index.html; location / { try_files $uri /index.html; } }' > /etc/nginx/conf.d/default.conf\n" +
"EXPOSE 80\n" +
"HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \\\n" +
"  CMD wget -qO- http://127.0.0.1:80/ || exit 1\n" +
"CMD [\"nginx\", \"-g\", \"daemon off;\"]\n";
    } else {
        dockerfile = "# syntax=docker/dockerfile:1\n" +
"# Generic Node.js Dockerfile\n" +
"FROM node:" + nodeVersion + "-alpine AS builder\n" +
"WORKDIR /app\n" +
"COPY package*.json ./\n" +
"RUN " + npmCi + "\n" +
"COPY . .\n" +
"RUN npm run build 2>/dev/null; true\n" +
"\n" +
"FROM node:" + nodeVersion + "-alpine AS runner\n" +
"WORKDIR /app\n" +
"RUN addgroup -S appgroup && adduser -S appuser -G appgroup\n" +
"COPY --from=builder /app ./\n" +
"RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev --no-audit --no-fund\n" +
"RUN chown -R appuser:appgroup /app\n" +
"USER appuser\n" +
"EXPOSE " + port + "\n" +
"ENV PORT=" + port + "\n" +
"ENV NODE_ENV=production\n" +
"HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \\\n" +
"  CMD wget -qO- http://127.0.0.1:" + port + "/ || exit 1\n" +
"CMD [\"node\", \"server.js\"]\n";
    }

    try {
        await writeFile("Dockerfile", dockerfile);
        const projectId = getHostProjectId();
        if (projectId) {
            await syncFileToProjectPages("Dockerfile", dockerfile);
        }
        return "[SYSTEM] ✅ Created Dockerfile for " + framework + " (Node " + nodeVersion + ", port " + port + "). Make sure to call save() then deploy().";
    } catch (e: any) {
        return "Error creating Dockerfile: " + e.message;
    }
}

// Tool definitions for AI
export const TOOL_DEFINITIONS = [
    {
        type: 'function',
        function: {
            name: 'createFile',
            description: 'Create or update a file in the file system. Use for new files or complete rewrites.',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'The file path, e.g., src/App.tsx' },
                    content: { type: 'string', description: 'The content of the file.' },
                },
                required: ['path', 'content'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'editFile',
            description: `Edit a specific part of a file by replacing old content with new content. CRITICAL RULES:
1. You MUST call readFile first to get the exact current content
2. oldContent must match EXACTLY (whitespace, indentation, line breaks)
3. If editFile fails, use readFile again and retry with the exact content
4. For large changes (>30 lines), prefer createFile instead
5. oldContent should be unique in the file — include enough context lines`,
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'The file path to edit, e.g., src/App.tsx' },
                    oldContent: { type: 'string', description: 'The exact content to find and replace. Must match exactly including whitespace.' },
                    newContent: { type: 'string', description: 'The new content to replace the old content with.' },
                },
                required: ['path', 'oldContent', 'newContent'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'readFile',
            description: 'Read the content of a file. ALWAYS call this before editFile to get exact content.',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'The file path, e.g., src/App.tsx' },
                },
                required: ['path'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'readMultipleFiles',
            description: 'Read multiple files at once. More efficient than calling readFile multiple times. Use when you need to understand how several files relate to each other.',
            parameters: {
                type: 'object',
                properties: {
                    paths: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Array of file paths to read, e.g., ["src/App.tsx", "src/store.ts"]'
                    },
                },
                required: ['paths'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'deleteFile',
            description: 'Delete a file or directory.',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'The path to delete.' },
                },
                required: ['path'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'renameFile',
            description: 'Rename or move a file.',
            parameters: {
                type: 'object',
                properties: {
                    oldPath: { type: 'string', description: 'The current file path.' },
                    newPath: { type: 'string', description: 'The new file path.' },
                },
                required: ['oldPath', 'newPath'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'listFiles',
            description: 'List all files and folders in the project. Returns the project structure as a tree.',
            parameters: {
                type: 'object',
                properties: {},
                required: [],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'searchInFiles',
            description: 'Search for a text pattern across project files. Returns matching lines with file paths and line numbers. Use this to find where something is defined or used.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Text or regex pattern to search for' },
                    filePattern: { type: 'string', description: 'Optional glob pattern to filter files, e.g., "*.tsx" or "src/**/*.ts"' },
                },
                required: ['query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'typeCheck',
            description: 'Run TypeScript type checking to find type errors in the project. Returns errors with file paths and line numbers.',
            parameters: {
                type: 'object',
                properties: {},
                required: [],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'lintCheck',
            description: 'Run ESLint to find code quality issues. Returns warnings and errors with file paths.',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'Optional: specific file or directory to lint. Defaults to app/' },
                },
                required: [],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'drawDiagram',
            description: 'Generate and display an architecture diagram using Mermaid syntax.',
            parameters: {
                type: 'object',
                properties: {
                    mermaidCode: { type: 'string', description: 'The Mermaid diagram syntax code.' },
                    title: { type: 'string', description: 'Title of the diagram' },
                },
                required: ['mermaidCode'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'batchCreateFiles',
            description: 'Create multiple files at once. Much faster than calling createFile multiple times. Use when scaffolding a project or creating several related files.',
            parameters: {
                type: 'object',
                properties: {
                    files: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                path: { type: 'string', description: 'File path' },
                                content: { type: 'string', description: 'File content' },
                            },
                            required: ['path', 'content'],
                        },
                        description: 'Array of files to create, each with path and content'
                    },
                },
                required: ['files'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'getErrors',
            description: 'Get a summary of all current errors in the project: TypeScript errors, build errors, and runtime errors from the terminal. Use this to quickly understand what is broken.',
            parameters: {
                type: 'object',
                properties: {},
                required: [],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'save',
            description: 'Save the project source files to GitHub (creates the repository on first save). Call this BEFORE deploy() — Dokploy deploys by building the GitHub repository. Use when the user asks to save, push to GitHub, or before publishing.',
            parameters: {
                type: 'object',
                properties: {},
                required: [],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'deploy',
            description: "Deploy the project to sycord.site via Dokploy Docker containers. Performs three operations: (1) sets Application Build Type to Dockerfile, (2) creates domain <appName>.sycord.site with HTTPS (Let's Encrypt), (3) triggers deployment to build and serve the Docker container. Also auto-generates Dockerfile if missing, reuses existing user project, creates new application/service per deployment, configures Docker build type (NOT nixpacks/heroku), and attaches GitHub source. IMPORTANT: Always call save() BEFORE deploy(). Project ID is reused per user; Application ID is unique per deployment. Returns the live URL and all provisioned IDs on success.",
            parameters: {
                type: 'object',
                properties: {},
                required: [],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'createDokployProject',
            description: 'Create a new project in Dokploy. Use this when you need to set up a new project container before deploying.',
            parameters: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'Project name (required)' },
                    description: { type: 'string', description: 'Optional project description' },
                },
                required: ['name'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'createDokployEnvironment',
            description: 'Create a new environment inside a Dokploy project (e.g., "production", "staging").',
            parameters: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'Environment name, e.g. "production" or "staging" (required)' },
                    projectId: { type: 'string', description: 'Dokploy project ID to create the environment in (required)' },
                },
                required: ['name', 'projectId'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'listDokployResources',
            description: 'List Dokploy projects, environments, containers, deployments, or domains. Use to inspect what is currently deployed.',
            parameters: {
                type: 'object',
                properties: {
                    resource: { type: 'string', description: 'Resource type: "projects", "environments", "containers", "deployments", or "domains" (default: "containers")' },
                    projectId: { type: 'string', description: 'Filter environments or deployments by projectId' },
                    applicationId: { type: 'string', description: 'Filter deployments or domains by applicationId' },
                },
                required: [],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'manageContainer',
            description: 'Manage a Dokploy Docker container: restart, start, stop, kill, or remove it.',
            parameters: {
                type: 'object',
                properties: {
                    containerId: { type: 'string', description: 'The Docker container ID or name (required)' },
                    operation: { type: 'string', description: 'Operation: "restart", "start", "stop", "kill", or "remove" (default: "restart")' },
                },
                required: ['containerId', 'operation'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'generateDomain',
            description: 'Generate a Traefik domain for a Dokploy application so it gets a public URL.',
            parameters: {
                type: 'object',
                properties: {
                    appName: { type: 'string', description: 'The Dokploy appName (container name) to generate a domain for (required)' },
                },
                required: ['appName'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'createDockerfile',
            description: 'Generate a Dockerfile for the project. Dokploy requires a Dockerfile to build and deploy. Creates a multi-stage Node.js Dockerfile optimized for the chosen framework. Call this BEFORE save() and deploy() if the project lacks a Dockerfile.',
            parameters: {
                type: 'object',
                properties: {
                    framework: { type: 'string', description: 'Project framework: "nextjs", "react", "vite", or "node" (default: "nextjs")' },
                    nodeVersion: { type: 'string', description: 'Node.js version to use (default: "22")' },
                    port: { type: 'string', description: 'Port the app listens on (default: "3000")' },
                },
                required: [],
            },
        },
    },
];

// Tool execution context
export interface ToolContext {
    addTerminalOutput: (output: string) => void;
    setSelectedFile: (path: string) => void;
}

// ============================================================
// TERMINAL OUTPUT CLEANER
// Cleans up raw WebContainer output for readable terminal display
// ============================================================

// WebContainer home path pattern — these long hashes make output unreadable
const WC_PATH_REGEX = /\/home\/[a-z0-9_-]+\//g;
const WC_FILE_PATH_REGEX = /file:\/\/\/home\/[a-z0-9_-]+\//g;
const WC_URL_REGEX = /https?:\/\/[a-z0-9_-]+\.w-corp-staticblitz\.com\/[^\s)]+/g;

// Track recent error messages to deduplicate
let recentErrors: string[] = [];
let lastCleanTime = Date.now();

function cleanTerminalOutput(raw: string): string {
    // Reset dedup cache every 10 seconds
    if (Date.now() - lastCleanTime > 10000) {
        recentErrors = [];
        lastCleanTime = Date.now();
    }

    let output = raw;

    // 1. Shorten WebContainer paths: /home/abc123xyz/ → ./
    output = output.replace(WC_FILE_PATH_REGEX, 'file:///');
    output = output.replace(WC_PATH_REGEX, './');

    // 2. Shorten internal StackBlitz URLs
    output = output.replace(WC_URL_REGEX, '[internal]');

    // 3. Collapse stack traces — keep first 3 "at" lines, skip the rest
    const lines = output.split('\n');
    const filtered: string[] = [];
    let atCount = 0;
    let skippedAt = false;

    for (const line of lines) {
        const trimmed = line.trim();

        // Count consecutive "at " lines (stack trace)
        if (trimmed.startsWith('at ')) {
            atCount++;
            if (atCount <= 3) {
                filtered.push(line);
            } else if (!skippedAt) {
                filtered.push('    ... (stack trace truncated)');
                skippedAt = true;
            }
            continue;
        }

        // Reset stack trace counter
        if (atCount > 0) {
            atCount = 0;
            skippedAt = false;
        }

        // Skip "Require stack:" lines and the lines after them that are just paths
        if (trimmed === 'Require stack:') {
            continue;
        }
        if (trimmed.startsWith('- ./') && filtered.length > 0 && 
            (filtered[filtered.length - 1].includes('Cannot find module') || 
             filtered[filtered.length - 1].includes('Require stack') ||
             filtered[filtered.length - 1].trim().startsWith('- ./'))) {
            continue;
        }

        // Deduplicate repeated error messages
        if (trimmed.includes('[vite]') && trimmed.includes('error')) {
            const errorKey = trimmed.replace(/\(x\d+\)/, '').trim();
            if (recentErrors.includes(errorKey)) {
                continue; // Skip duplicate
            }
            recentErrors.push(errorKey);
            if (recentErrors.length > 20) recentErrors.shift();
        }

        filtered.push(line);
    }

    output = filtered.join('\n');

    // 4. Collapse 3+ consecutive newlines into 2 (one blank line max)
    output = output.replace(/\n{3,}/g, '\n\n');

    return output;
}

// Wrapper that cleans output before sending to terminal.
// Also filters out error lines — errors go to Errors panel only.
export function createCleanTerminalWriter(addTerminalOutput: (output: string) => void) {
    return (raw: string) => {
        // First, parse errors from raw output BEFORE filtering
        // (so errors still reach the Errors panel via store)
        try {
            const parsed = parseErrorsFromOutput(raw, 'command');
            if (parsed.length > 0) {
                useStore.getState().addParsedErrors(parsed);
            }
        } catch { /* ignore */ }

        const cleaned = cleanTerminalOutput(raw);

        // Now filter out error lines from what goes to terminal display
        const lines = cleaned.split('\n');
        const displayLines: string[] = [];
        for (const line of lines) {
            const t = line.trim();
            // Skip error lines — they're in the Errors panel
            if (t.startsWith('at ') && (/\(file:\/\/\//.test(t) || /\(\//.test(t) || /\(https?:\/\//.test(t) || t.includes('eval'))) continue;
            if (/\[vite\]/.test(t) && (/error/i.test(t) || /Error/.test(t))) continue;
            if (t.includes('Failed to resolve import')) continue;
            if (t.includes('Cannot find module')) continue;
            if (/^(Error|SyntaxError|TypeError|ReferenceError|RangeError):/.test(t)) continue;
            if (/npm (ERR!|error)/.test(t)) continue;
            if (/error TS\d+:/.test(t)) continue;
            if (t === 'Are they installed?') continue;
            if (t === 'Require stack:' || /^- (\/|file:\/\/\/)/.test(t)) continue;
            if (t.startsWith('Plugin:') || (t.startsWith('File:') && t.includes(':undefined'))) continue;
            if (/^\d+\s*\|/.test(t) || /^\s*\|?\s*\^/.test(t)) continue;
            if (/\(imported by\s/.test(t)) continue;
            if (t === '... (stack trace truncated)') continue;
            displayLines.push(line);
        }

        let display = displayLines.join('\n');
        // Collapse excessive blank lines
        display = display.replace(/\n{3,}/g, '\n\n');
        // Trim leading blank lines only
        display = display.replace(/^\n+/, '');

        if (display.trim() || raw.includes('\r')) {
            addTerminalOutput(display);
        }
    };
}

// ============================================================
// ERROR PARSER — extracts structured errors from command output
// ============================================================

import type { ParsedError } from '../store';

let errorIdCounter = 0;

function parseErrorsFromOutput(output: string, source: string): ParsedError[] {
    const errors: ParsedError[] = [];
    const now = Date.now();
    const seen = new Set<string>();

    const addError = (type: ParsedError['type'], message: string, file?: string, line?: number, column?: number) => {
        const key = `${type}:${file || ''}:${line || ''}:${message.slice(0, 80)}`;
        if (seen.has(key)) return;
        seen.add(key);
        errors.push({
            id: `err_${++errorIdCounter}_${now}`,
            type,
            message: message.trim(),
            file: file?.replace(/^\.\//, ''),
            line,
            column,
            timestamp: now,
            source,
        });
    };

    const lines = output.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // TypeScript errors: src/App.tsx(10,5): error TS2345: Argument of type...
        const tsMatch = line.match(/^(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)/);
        if (tsMatch) {
            addError('typescript', `${tsMatch[4]}: ${tsMatch[5]}`, tsMatch[1], parseInt(tsMatch[2]), parseInt(tsMatch[3]));
            continue;
        }

        // TypeScript errors (alternative format): src/App.tsx:10:5 - error TS2345: ...
        const tsMatch2 = line.match(/^(.+?):(\d+):(\d+)\s*-\s*error\s+(TS\d+):\s*(.+)/);
        if (tsMatch2) {
            addError('typescript', `${tsMatch2[4]}: ${tsMatch2[5]}`, tsMatch2[1], parseInt(tsMatch2[2]), parseInt(tsMatch2[3]));
            continue;
        }

        // Vite: Failed to resolve import "xxx" from "src/file.tsx"
        const viteImportMatch = line.match(/Failed to resolve import "([^"]+)" from "([^"]+)"/);
        if (viteImportMatch) {
            addError('module', `Cannot find module "${viteImportMatch[1]}"`, viteImportMatch[2]);
            continue;
        }

        // Vite: Cannot find module '@tailwindcss/typography'
        const moduleMatch = line.match(/Cannot find module '([^']+)'/);
        if (moduleMatch && !line.includes('at ')) {
            addError('module', `Missing module: ${moduleMatch[1]}`);
            continue;
        }

        // Vite: [vite] Internal server error: ...
        const viteErrorMatch = line.match(/\[vite\]\s*(Internal server error|Pre-transform error):\s*(.+)/);
        if (viteErrorMatch) {
            const msg = viteErrorMatch[2].replace(/\[postcss\]\s*/, '');
            // Don't add if it's a duplicate of a module error we already captured
            if (!msg.includes('Cannot find module') && !msg.includes('Failed to resolve import')) {
                addError('vite', msg);
            }
            continue;
        }

        // SyntaxError: ...
        const syntaxMatch = line.match(/SyntaxError:\s*(.+)/);
        if (syntaxMatch) {
            addError('syntax', syntaxMatch[1]);
            continue;
        }

        // npm ERR!
        const npmMatch = line.match(/npm (?:ERR!|error)\s*(.+)/);
        if (npmMatch && npmMatch[1].trim()) {
            const msg = npmMatch[1].trim();
            if (msg && !msg.startsWith('A complete log') && msg.length > 3) {
                addError('npm', msg, undefined, undefined, undefined);
            }
            continue;
        }

        // Runtime errors: TypeError, ReferenceError, etc.
        const runtimeMatch = line.match(/^(TypeError|ReferenceError|RangeError|URIError|EvalError):\s*(.+)/);
        if (runtimeMatch) {
            addError('runtime', `${runtimeMatch[1]}: ${runtimeMatch[2]}`);
            continue;
        }
    }

    return errors;
}


// ============================================================
// TOOL HANDLERS
// ============================================================

export async function handleCreateFile(
    args: { path: string; content: string },
    ctx: ToolContext
): Promise<string> {
    const { path, content } = args;

    if (!path || typeof path !== 'string') {
        return 'Error: Invalid file path';
    }
    if (content === undefined || content === null) {
        return `Error: Invalid file content for ${path}`;
    }

    try {
        ctx.setSelectedFile(path);

        // Save to Pages (MongoDB) first — this is the durable source of truth.
        // The WebContainer preview write happens inside persistFile as a
        // best-effort step and can never block the save.
        const pageSync = await persistFile(path, content);

        if (pageSync.status === 'error') {
            return `Error saving file ${path} to Pages: ${pageSync.message}`;
        }
        const savedNote = pageSync.status === 'saved' ? ' (saved to Pages)' : '';
        return `[SYSTEM] File created: ${path} (${content.split('\n').length} lines)${savedNote}`;
    } catch (e: any) {
        return `Error creating file ${path}: ${e.message}`;
    }
}

export async function handleEditFile(
    args: { path: string; oldContent: string; newContent: string }
): Promise<string> {
    const { path, oldContent, newContent } = args;

    try {
        const currentContent = await readFileResilient(path);

        // Exact match first
        if (currentContent.includes(oldContent)) {
            const matches = currentContent.split(oldContent).length - 1;
            if (matches > 1) {
                return `Error editing ${path}: Found ${matches} matches for oldContent. Include more surrounding lines to make it unique.\n\nHint: Add 2-3 extra lines before and after the section you want to change.`;
            }

            const newFileContent = currentContent.replace(oldContent, newContent);
            const pageSync = await persistFile(path, newFileContent);
            if (pageSync.status === 'error') {
                return `Error saving file ${path} to Pages: ${pageSync.message}`;
            }
            return `[SYSTEM] File edited: ${path}`;
        }

        // Fuzzy match: try trimming whitespace from each line
        const normalizeWs = (s: string) => s.split('\n').map(l => l.trim()).join('\n');
        const normalizedContent = normalizeWs(currentContent);
        const normalizedOld = normalizeWs(oldContent);

        if (normalizedContent.includes(normalizedOld)) {
            // Find the actual content by matching line-by-line
            const oldLines = oldContent.split('\n').map(l => l.trim());
            const contentLines = currentContent.split('\n');
            let startIdx = -1;

            for (let i = 0; i <= contentLines.length - oldLines.length; i++) {
                let match = true;
                for (let j = 0; j < oldLines.length; j++) {
                    if (contentLines[i + j].trim() !== oldLines[j]) {
                        match = false;
                        break;
                    }
                }
                if (match) {
                    startIdx = i;
                    break;
                }
            }

            if (startIdx !== -1) {
                const actualOld = contentLines.slice(startIdx, startIdx + oldLines.length).join('\n');
                const newFileContent = currentContent.replace(actualOld, newContent);
                const pageSync = await persistFile(path, newFileContent);
                if (pageSync.status === 'error') {
                    return `Error saving file ${path} to Pages: ${pageSync.message}`;
                }
                return `[SYSTEM] File edited: ${path} (matched with normalized whitespace)`;
            }
        }

        // Show helpful context for debugging
        const lines = currentContent.split('\n');
        const firstOldLine = oldContent.split('\n')[0].trim();
        const similarLines = lines
            .map((l, i) => ({ line: l, num: i + 1 }))
            .filter(({ line }) => line.trim().includes(firstOldLine) || firstOldLine.includes(line.trim()))
            .slice(0, 3);

        let hint = `Error editing ${path}: Could not find the specified content to replace.`;
        hint += `\n\n⚠️ IMPORTANT: You must call readFile("${path}") first and copy the EXACT content.`;

        if (similarLines.length > 0) {
            hint += `\n\nSimilar lines found at:`;
            similarLines.forEach(({ line, num }) => {
                hint += `\n  Line ${num}: ${line.substring(0, 100)}`;
            });
            hint += `\n\nUse readFile to get the exact content, then retry editFile.`;
        } else {
            hint += `\n\nThe content you provided does not exist in this file. Use readFile("${path}") to see the current content.`;
        }

        return hint;
    } catch (e: any) {
        return `Error editing file ${path}: ${e.message}`;
    }
}

export async function handleReadFile(args: { path: string }): Promise<string> {
    const { path } = args;
    try {
        const content = await readFileResilient(path);
        const lines = content.split('\n');
        // Add line numbers for easier reference
        const numbered = lines.map((l, i) => `${String(i + 1).padStart(4)} | ${l}`).join('\n');
        return `[SYSTEM] File content of ${path} (${lines.length} lines):\n${numbered}`;
    } catch (e: any) {
        return `Error reading file ${path}: ${e.message}`;
    }
}

export async function handleReadMultipleFiles(args: { paths: string[] }): Promise<string> {
    const { paths } = args;
    const results: string[] = [];

    // Refresh from the Pages tab once for the whole batch (source of truth).
    const synced = await syncStoreFromPages();

    for (const path of paths) {
        try {
            const content = await readFileResilient(path, { skipPagesSync: !!synced });
            const lines = content.split('\n');
            const numbered = lines.map((l, i) => `${String(i + 1).padStart(4)} | ${l}`).join('\n');
            results.push(`━━━ ${path} (${lines.length} lines) ━━━\n${numbered}`);
        } catch (e: any) {
            results.push(`━━━ ${path} ━━━\nError: ${e.message}`);
        }
    }

    return `[SYSTEM] Read ${paths.length} files:\n\n${results.join('\n\n')}`;
}

export async function handleDeleteFile(args: { path: string }): Promise<string> {
    const { path } = args;

    // Protect .glovix directory
    if (path === '.glovix' || path.startsWith('.glovix/')) {
        return `Error: Cannot delete .glovix — this is a protected system directory.`;
    }

    // Protect picker script
    if (path === 'glovix-picker.js') {
        return `Error: Cannot delete glovix-picker.js — this is a system file.`;
    }

    try {
        // Best-effort remove from the WebContainer preview FS.
        try { await deleteFile(path); } catch { /* preview-only */ }

        // Remove from the Pages tab (source of truth) when embedded.
        if (getHostProjectId() && isPageBackedFile(path)) {
            await deleteProjectPage(path);
        }

        const state = useStore.getState();
        const newFiles = { ...state.files };
        // Delete the file and any children (for directories)
        Object.keys(newFiles).forEach(key => {
            if (key === path || key.startsWith(path + '/')) {
                delete newFiles[key];
            }
        });
        state.setFiles(newFiles);
        return `[SYSTEM] Deleted: ${path}`;
    } catch (e: any) {
        return `Error deleting ${path}: ${e.message}`;
    }
}

export async function handleRenameFile(
    args: { oldPath: string; newPath: string }
): Promise<string> {
    const { oldPath, newPath } = args;
    try {
        // Update the WebContainer preview FS (best-effort).
        try { await renameFile(oldPath, newPath); } catch { /* preview-only */ }

        const state = useStore.getState();
        const newFiles = { ...state.files };
        const moved = newFiles[oldPath];
        if (moved) {
            newFiles[newPath] = moved;
            delete newFiles[oldPath];
            state.setFiles(newFiles);
        }

        // Reflect the rename in the Pages tab (source of truth): write the new
        // page, then remove the old one.
        if (getHostProjectId()) {
            const content = moved?.file?.contents
                ?? (await readFileResilient(newPath).catch(() => undefined))
                ?? '';
            if (isPageBackedFile(newPath)) {
                await syncFileToProjectPages(newPath, content);
            }
            if (isPageBackedFile(oldPath)) {
                await deleteProjectPage(oldPath);
            }
        }

        return `[SYSTEM] Renamed: ${oldPath} → ${newPath}`;
    } catch (e: any) {
        return `Error renaming ${oldPath}: ${e.message}`;
    }
}

export async function handleListFiles(): Promise<string> {
    try {
        // Refresh from the Pages tab (source of truth) when embedded.
        await syncStoreFromPages();
        const files = useStore.getState().files;
        const paths = Object.keys(files).filter(f => f !== 'glovix-picker.js').sort();

        if (paths.length === 0) {
            return '[SYSTEM] Project is empty. No files found.';
        }

        const tree: string[] = [];
        const dirs = new Set<string>();

        for (const path of paths) {
            const parts = path.split('/');
            let currentPath = '';
            for (let i = 0; i < parts.length - 1; i++) {
                currentPath += (currentPath ? '/' : '') + parts[i];
                dirs.add(currentPath);
            }
        }

        const allPaths = [...Array.from(dirs).map(d => d + '/'), ...paths].sort();

        for (const path of allPaths) {
            const depth = path.split('/').length - 1;
            const indent = '  '.repeat(depth);
            const name = path.split('/').filter(Boolean).pop() || path;
            const isDir = path.endsWith('/');
            tree.push(`${indent}${isDir ? '📁 ' : '📄 '}${name}`);
        }

        return `[SYSTEM] Project structure (${paths.length} files):\n${tree.join('\n')}`;
    } catch (e: any) {
        return `Error listing files: ${e.message}`;
    }
}

export async function handleSearchInFiles(args: { query: string; filePattern?: string }): Promise<string> {
    try {
        const { query, filePattern } = args;
        // Refresh from the Pages tab (source of truth) when embedded.
        await syncStoreFromPages();
        const files = useStore.getState().files;
        const results: string[] = [];
        let totalMatches = 0;

        const regex = new RegExp(query, 'gi');

        for (const [path, file] of Object.entries(files)) {
            // Apply file pattern filter
            if (filePattern) {
                const pattern = filePattern.replace(/\*/g, '.*').replace(/\?/g, '.');
                if (!new RegExp(pattern).test(path)) continue;
            }

            const content = file.file.contents;
            const lines = content.split('\n');

            const matchingLines: string[] = [];
            lines.forEach((line, idx) => {
                if (regex.test(line)) {
                    matchingLines.push(`  ${idx + 1}: ${line.trim().substring(0, 120)}`);
                    totalMatches++;
                }
                regex.lastIndex = 0; // Reset regex state
            });

            if (matchingLines.length > 0) {
                results.push(`📄 ${path} (${matchingLines.length} matches):\n${matchingLines.slice(0, 10).join('\n')}${matchingLines.length > 10 ? `\n  ... and ${matchingLines.length - 10} more` : ''}`);
            }
        }

        if (results.length === 0) {
            return `[SYSTEM] No matches found for "${query}"${filePattern ? ` in ${filePattern}` : ''}.`;
        }

        return `[SYSTEM] Found ${totalMatches} matches in ${results.length} files:\n\n${results.join('\n\n')}`;
    } catch (e: any) {
        return `Error searching: ${e.message}`;
    }
}


// Parse npm install/build errors into structured format
function parseNpmErrors(output: string): string | null {
    const errors: string[] = [];

    // npm ERR! lines
    const errLines = output.split('\n').filter(l => l.includes('npm ERR!') || l.includes('npm error'));
    if (errLines.length > 0) {
        errors.push(...errLines.slice(0, 10).map(l => l.replace(/npm (ERR!|error)\s*/, '').trim()).filter(Boolean));
    }

    // Module not found
    const moduleNotFound = output.match(/Module not found:.*$/gm);
    if (moduleNotFound) {
        errors.push(...moduleNotFound);
    }

    // Cannot find package
    const pkgNotFound = output.match(/Cannot find package '([^']+)'/g);
    if (pkgNotFound) {
        errors.push(...pkgNotFound);
    }

    return errors.length > 0 ? errors.join('\n') : null;
}

// Parse TypeScript and build errors
function parseBuildErrors(output: string): string | null {
    const errors: string[] = [];

    // TypeScript errors: src/file.tsx(10,5): error TS2345: ...
    const tsErrors = output.match(/[^\n]*error TS\d+:[^\n]*/g);
    if (tsErrors) {
        errors.push(...tsErrors.slice(0, 15));
    }

    // Vite/esbuild errors
    const viteErrors = output.match(/\[vite\][^\n]*/g);
    if (viteErrors) {
        errors.push(...viteErrors.slice(0, 10));
    }

    // SyntaxError
    const syntaxErrors = output.match(/SyntaxError:[^\n]*/g);
    if (syntaxErrors) {
        errors.push(...syntaxErrors);
    }

    return errors.length > 0 ? errors.join('\n') : null;
}

export async function handleTypeCheck(ctx: ToolContext): Promise<string> {
    // When embedded in a Sycord project, use the structured server-side
    // diagnostics endpoint instead of spawning tsc in the browser WebContainer.
    if (isServerWorkspace()) {
        return typeCheckServerSide(getHostProjectId()!);
    }
    try {
        ctx.addTerminalOutput(`\r\n\x1b[38;5;243m$ npx tsc --noEmit --pretty\x1b[0m\r\n`);
        const writeToTerminal = createCleanTerminalWriter(ctx.addTerminalOutput);
        let output = '';
        const exitCode = await executeCommand('npx', ['tsc', '--noEmit', '--pretty'], (data) => {
            output += data;
            writeToTerminal(data);
        }, 60000); // 60s timeout for type checking
        if (exitCode === 0) {
            return '[SYSTEM] ✅ TypeScript check passed: No type errors found.';
        } else if (exitCode === 124) {
            return '[SYSTEM] ⏰ TypeScript check timed out. The project may be too large or tsc is not installed. Try running `npm run build` instead — Next.js will report type/build errors.';
        } else {
            // Parse and structure errors
            const errorLines = output.split('\n').filter(l => l.includes('error TS'));
            const errorCount = errorLines.length;

            // Send to Error Panel
            const parsed = parseErrorsFromOutput(output, 'npx tsc --noEmit');
            if (parsed.length > 0) {
                useStore.getState().addParsedErrors(parsed);
            }

            return `[SYSTEM] TypeScript check found ${errorCount} error(s):\n${cleanTerminalOutput(output).slice(0, 3000)}\n\nYou MUST fix these errors now. Use readFile on the affected files, then editFile or createFile to fix them. Do NOT stop or report to the user until all errors are fixed.`;
        }
    } catch (e: any) {
        return `Error running TypeScript check: ${e.message}. Try running \`npm run build\` instead.`;
    }
}

export async function handleLintCheck(args: { path?: string }, ctx: ToolContext): Promise<string> {
    try {
        const target = args.path || 'src/';
        ctx.addTerminalOutput(`\r\n\x1b[38;5;243m$ npx eslint ${target} --format compact\x1b[0m\r\n`);
        const writeToTerminal = createCleanTerminalWriter(ctx.addTerminalOutput);
        let output = '';
        const exitCode = await executeCommand('npx', ['eslint', target, '--format', 'compact'], (data) => {
            output += data;
            writeToTerminal(data);
        });
        if (exitCode === 0) {
            return `[SYSTEM] ✅ ESLint check passed for ${target}: No issues found.`;
        } else {
            return `[SYSTEM] ⚠️ ESLint found issues in ${target}:\n${output}`;
        }
    } catch (e: any) {
        return `Error running lint: ${e.message}`;
    }
}

export async function handleDrawDiagram(args: { mermaidCode: string; title?: string }): Promise<string> {
    try {
        const { mermaidCode, title } = args;

        const openSq = (mermaidCode.match(/\[/g) || []).length;
        const closeSq = (mermaidCode.match(/\]/g) || []).length;
        if (openSq !== closeSq) {
            throw new Error(`Syntax Error: Unbalanced brackets [] (${openSq} vs ${closeSq}).`);
        }

        const openParen = (mermaidCode.match(/\(/g) || []).length;
        const closeParen = (mermaidCode.match(/\)/g) || []).length;
        if (openParen !== closeParen) {
            throw new Error(`Syntax Error: Unbalanced parentheses () (${openParen} vs ${closeParen}).`);
        }

        if (/\[[^"\]]*\([^\)\]]+\)[^"\]]*\]/.test(mermaidCode)) {
            throw new Error(`Syntax Error: Parentheses inside brackets without quotes. Use A["Text (Info)"] instead.`);
        }

        if (/\[[^\]]*\[/.test(mermaidCode)) {
            throw new Error(`Syntax Error: Nested brackets detected. Use quotes: A["Text [Details]"].`);
        }

        if (mermaidCode.includes(']]')) {
            throw new Error(`Syntax Error: Double closing brackets ]] detected.`);
        }

        return `[SYSTEM] Diagram generated.\n\n### ${title || 'Architecture'}\n\`\`\`mermaid\n${mermaidCode}\n\`\`\``;
    } catch (e: any) {
        return `Error generating diagram: ${e.message}\n\nPlease fix the syntax and try again.`;
    }
}

export async function handleBatchCreateFiles(
    args: { files: { path: string; content: string }[] },
    ctx: ToolContext
): Promise<string> {
    const { files } = args;

    if (!files || !Array.isArray(files) || files.length === 0) {
        return 'Error: No files provided. Pass an array of {path, content} objects.';
    }

    const results: string[] = [];
    let successCount = 0;
    let pageErrorCount = 0;
    const newFilesMap: Record<string, { file: { contents: string } }> = {};

    for (const file of files) {
        if (!file.path || file.content === undefined) {
            results.push(`  ❌ Invalid file entry (missing path or content)`);
            continue;
        }

        newFilesMap[file.path] = { file: { contents: file.content } };

        // Save to Pages (MongoDB) — the durable source of truth.
        const pageSync = await syncFileToProjectPages(file.path, file.content);
        // Best-effort live-preview write; never blocks the save.
        await tryWriteToWebContainer(file.path, file.content);

        if (pageSync.status === 'error') {
            pageErrorCount++;
            results.push(`  ⚠️ ${file.path} (preview updated, Pages save failed: ${pageSync.message})`);
        } else {
            successCount++;
            results.push(`  ✅ ${file.path}`);
        }
    }

    // Single store update for all files (instead of N updates)
    if (Object.keys(newFilesMap).length > 0) {
        const state = useStore.getState();
        state.setFiles({ ...state.files, ...newFilesMap });
    }

    // Select the first file
    if (files.length > 0 && files[0].path) {
        ctx.setSelectedFile(files[0].path);
    }

    const tail = pageErrorCount > 0
        ? `\n⚠️ ${pageErrorCount} file(s) could not be saved to Pages — see above.`
        : '';
    return `[SYSTEM] Batch create: ${successCount}/${files.length} files saved.\n${results.join('\n')}${tail}`;
}

export async function handleGetErrors(ctx: ToolContext): Promise<string> {
    // In a Sycord project, get structured diagnostics from the server instead
    // of spawning tsc in the browser WebContainer.
    if (isServerWorkspace()) {
        return typeCheckServerSide(getHostProjectId()!);
    }

    const results: string[] = [];

    // 1. TypeScript errors
    try {
        let tsOutput = '';
        const tsExit = await executeCommand('npx', ['tsc', '--noEmit', '--pretty'], (data) => {
            tsOutput += data;
            ctx.addTerminalOutput(data);
        });
        if (tsExit !== 0) {
            const errorLines = tsOutput.split('\n').filter(l => l.includes('error TS') || l.includes('.tsx') || l.includes('.ts'));
            results.push(`🔴 TypeScript Errors:\n${errorLines.slice(0, 20).join('\n')}`);
        } else {
            results.push('✅ TypeScript: No errors');
        }
    } catch {
        results.push('⚠️ TypeScript check unavailable');
    }

    // 2. Terminal errors (from recent output)
    const terminalOutput = useStore.getState().terminalOutput;
    const recentOutput = terminalOutput.slice(-50).join('\n');
    const terminalErrors = recentOutput.split('\n').filter(l =>
        l.toLowerCase().includes('error') ||
        l.toLowerCase().includes('failed') ||
        l.toLowerCase().includes('cannot find') ||
        l.toLowerCase().includes('syntaxerror')
    );
    if (terminalErrors.length > 0) {
        results.push(`🔴 Terminal Errors:\n${terminalErrors.slice(0, 10).join('\n')}`);
    } else {
        results.push('✅ Terminal: No recent errors');
    }

    const hasErrors = results.some(r => r.includes('🔴'));
    const suffix = hasErrors
        ? '\n\n⚠️ Fix all errors above. Use readFile on affected files, then editFile/createFile to fix.'
        : '';
    return `[SYSTEM] Error Report:\n\n${results.join('\n\n')}${suffix}`;
}


// ============================================================
// MAIN TOOL EXECUTOR — with validation and error boundaries
// ============================================================

export async function executeTool(
    name: string,
    argsString: string,
    ctx: ToolContext
): Promise<string> {
    // Global timeout for any tool execution (5 minutes max)
    const TOOL_TIMEOUT_MS = 300000;

    const timeoutPromise = new Promise<string>((resolve) => {
        setTimeout(() => {
            resolve(`[SYSTEM] ⏰ Tool "${name}" timed out after ${TOOL_TIMEOUT_MS / 1000}s. The operation was taking too long. Try a simpler approach.`);
        }, TOOL_TIMEOUT_MS);
    });

    const executionPromise = _executeToolInternal(name, argsString, ctx);

    try {
        return await Promise.race([executionPromise, timeoutPromise]);
    } catch (e: any) {
        return `[SYSTEM] ❌ Unexpected error in tool "${name}": ${e.message}. This is a system error — try the operation again.`;
    }
}

async function _executeToolInternal(
    name: string,
    argsString: string,
    ctx: ToolContext
): Promise<string> {
    // Handle tools without arguments
    if (name === 'typeCheck') return handleTypeCheck(ctx);
    if (name === 'listFiles') return await handleListFiles();
    if (name === 'getErrors') return handleGetErrors(ctx);
    if (name === 'save') return handleSave();
    if (name === 'deploy') return handleDeploy();

    // Parse arguments
    const argsList = parseToolArguments(argsString);
    if (argsList.length === 0) {
        return `Error: Invalid arguments for tool "${name}". Could not parse JSON.\nRaw input: ${argsString.substring(0, 300)}\n\n⚠️ Make sure your tool arguments are valid JSON.`;
    }

    const results: string[] = [];

    for (const args of argsList) {
        let result: string;

        try {
            switch (name) {
                case 'createFile':
                    result = await handleCreateFile(args, ctx);
                    break;
                case 'editFile':
                    result = await handleEditFile(args);
                    break;
                case 'readFile':
                    result = await handleReadFile(args);
                    break;
                case 'readMultipleFiles':
                    result = await handleReadMultipleFiles(args);
                    break;
                case 'deleteFile':
                    result = await handleDeleteFile(args);
                    break;
                case 'renameFile':
                    result = await handleRenameFile(args);
                    break;
                case 'searchInFiles':
                    result = await handleSearchInFiles(args);
                    break;
                case 'drawDiagram':
                    result = await handleDrawDiagram(args);
                    break;
                case 'lintCheck':
                    result = await handleLintCheck(args, ctx);
                    break;
                case 'batchCreateFiles':
                    result = await handleBatchCreateFiles(args, ctx);
                    break;
                case 'createDokployProject':
                    result = await handleCreateProject(args);
                    break;
                case 'createDokployEnvironment':
                    result = await handleCreateEnvironment(args);
                    break;
                case 'listDokployResources':
                    result = await handleListDokployResources(args);
                    break;
                case 'manageContainer':
                    result = await handleManageContainer(args);
                    break;
                case 'generateDomain':
                    result = await handleGenerateDomain(args);
                    break;
                case 'createDockerfile':
                    result = await handleCreateDockerfile(args);
                    break;
                default:
                    result = `Unknown tool: "${name}". Available: createFile, editFile, readFile, readMultipleFiles, deleteFile, renameFile, listFiles, searchInFiles, typeCheck, lintCheck, drawDiagram, batchCreateFiles, getErrors, save, deploy, createDokployProject, createDokployEnvironment, listDokployResources, manageContainer, generateDomain, createDockerfile`;
            }
        } catch (e: any) {
            result = `[SYSTEM] ❌ Tool "${name}" crashed: ${e.message}. Try again or use a different approach.`;
        }

        results.push(result);
    }

    return results.join('\n');
}
