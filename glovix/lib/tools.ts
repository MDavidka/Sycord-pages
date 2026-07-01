import { executeCommand, writeFile, readFile, renameFile, deleteFile } from './webcontainer';
import { useStore } from '../store';
import { parseToolArguments } from './utils';
import { getHostProjectId, getProjectPagesMap, deleteProjectPage, isPageBackedFile } from './api';
import { collectEnvKeysForIntegrations, getIntegrationById } from '../../lib/integrations';
import {
    getMissingShadcnFoundationFiles,
    SHADCN_FOUNDATION_DEPENDENCIES,
} from './shadcn-init-files';
import { scanMissingShadcnImports, normalizeShadcnImportPaths, scanRegistryImportPaths } from '../../lib/shadcn-shared';

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
            if (res.status === 409 && msg.includes('createWorkspace')) {
                return `[SYSTEM] ❌ No Syte workspace UUID yet. Call createWorkspace() FIRST (POST /api/create_project), then typeCheck().\n${msg}`.trim();
            }
            return `[SYSTEM] ❌ Type check could not run on the Sycord server (HTTP ${res.status}). ${msg}`.trim();
        }
        const data = await res.json();
        const errors: Array<{ file: string; line: number; message: string }> = Array.isArray(data?.errors) ? data.errors : [];
        const summary = typeof data?.summary === 'string' ? data.summary : null;

        if (errors.length === 0) {
            return summary || '[SYSTEM] ✅ TypeScript check passed: No actionable errors in your project source.';
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

        if (summary) return summary;

        const lines = errors
            .slice(0, 40)
            .map((e) => `  ${e.file}:${e.line} — ${e.message}`)
            .join('\n');
        return `[SYSTEM] TypeScript check found ${errors.length} actionable error(s):\n${lines}\n\nYou MUST fix these errors now. Use readFile on the affected files, then editFile or createFile to fix them.`;
    } catch (e: any) {
        return `Error running TypeScript check on the server: ${e.message}`;
    }
}

/**
 * Step 1 — POST /api/create_project on Syte (https://sycord.site/api/).
 * Returns the workspace UUID required for all execute_command calls.
 */
export async function handleCreateWorkspace(): Promise<string> {
    const projectId = getHostProjectId();
    if (!projectId) {
        return '[SYSTEM] ❌ createWorkspace is only available when building inside a Sycord project.';
    }

    try {
        const res = await fetch('/api/workspace/syte', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, action: 'create_project' }),
        });
        const data = await res.json().catch(() => ({} as any));

        if (!res.ok || !data?.uuid) {
            const err = data?.error || data?.message || `HTTP ${res.status}`
            const endpoint = data?.endpoint ? ` (${data.endpoint})` : ""
            return `[SYSTEM] ❌ createWorkspace failed: ${err}${endpoint}`
        }

        const lines = [
            `[SYSTEM] ✅ Syte workspace ready.`,
            `UUID: ${data.uuid} (use for all execute_command calls)`,
            data.status === 'created' ? 'Status: newly created via POST /api/create_project' : 'Status: existing workspace reused',
        ];

        if (data.execute_command && typeof data.execute_command === 'object') {
            const body = data.execute_command as Record<string, unknown>;
            lines.push(`Suggested next command: ${JSON.stringify(body)}`);
        }

        if (Array.isArray(data.next_steps) && data.next_steps.length > 0) {
            lines.push('Next steps:');
            for (const step of data.next_steps.slice(0, 5)) {
                lines.push(`  • ${step}`);
            }
        } else {
            lines.push('Next steps:');
            lines.push('  1. executeCommand({ command: "npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias \\"@/*\\" --yes" }) OR write package.json via createFile');
            lines.push('  2. executeCommand({ command: "npx shadcn@latest init -y" }) to install shadcn/ui');
            lines.push('  3. executeCommand({ command: "npx shadcn@latest add button card input -y" }) for components');
            lines.push('  4. batchCreateFiles / editFile for your pages');
            lines.push('  5. executeCommand({ command: "npm install" }) → typeCheck() → deploy()');
        }

        return lines.join('\n');
    } catch (e: any) {
        return `Error creating Syte workspace: ${e.message}`;
    }
}

/** Run any shell command in the Syte workspace (https://sycord.site/api). */
export async function handleExecuteCommand(
    args: { command?: string; cwd?: string; timeout?: number },
    ctx?: ToolContext,
): Promise<string> {
    const projectId = getHostProjectId();
    if (!projectId) {
        return '[SYSTEM] ❌ executeCommand is only available when building inside a Sycord project.';
    }

    const command = typeof args.command === "string" ? args.command.trim() : "";
    if (!command) {
        return "[SYSTEM] ❌ executeCommand requires a command string.";
    }

    try {
        ctx?.addTerminalOutput?.(`\r\n\x1b[38;5;243m$ ${command}\x1b[0m\r\n`);

        const res = await fetch("/api/workspace/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                projectId,
                command,
                cwd: args.cwd || "app",
                timeout: args.timeout || 300,
            }),
        });

        const text = await res.text();
        if (ctx?.addTerminalOutput) {
            ctx.addTerminalOutput(text);
        }

        if (!res.ok) {
            if (res.status === 409) {
                return `[SYSTEM] ❌ Cannot run command — no workspace UUID.\n${text.slice(0, 2000)}\n\nYou MUST call createWorkspace() first (POST /api/create_project).`;
            }
            return `[SYSTEM] ❌ Command failed (HTTP ${res.status}):\n${text.slice(0, 4000)}`;
        }

        const exitMatch = text.match(/\[syte\] exit code (\d+)/) || text.match(/\[ssh-exec\] exit code (\d+)/);
        const exitCode = exitMatch ? Number(exitMatch[1]) : 0;

        if (exitCode === 0) {
            return `[SYSTEM] ✅ Command succeeded:\n${text.slice(-3500)}`;
        }

        return `[SYSTEM] ❌ Command exited with code ${exitCode}:\n${text.slice(-4000)}\n\nFix the errors above, then retry.`;
    } catch (e: any) {
        return `Error running command: ${e.message}`;
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
export async function handleDeploy(ctx?: ToolContext): Promise<string> {
    const projectId = getHostProjectId();
    if (!projectId) {
        return '[SYSTEM] ❌ Deploy is only available when building inside a Sycord project.';
    }

    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let applicationId: string | null = null;
    let deploymentId: string | null = null;

    const startProgressPolling = () => {
        if (pollTimer) return;
        pollTimer = setInterval(async () => {
            try {
                const qs = new URLSearchParams({ projectId });
                if (applicationId) qs.set('applicationId', applicationId);
                if (deploymentId) qs.set('deploymentId', deploymentId);
                const st = await fetch(`/api/workspace/deploy/status?${qs.toString()}`);
                if (!st.ok) return;
                const data = await st.json().catch(() => ({} as any));
                if (data.applicationId) applicationId = data.applicationId;
                if (data.deploymentId) deploymentId = data.deploymentId;
                if (data.progressMessage) {
                    ctx?.onDeployProgress?.(data.progressMessage);
                }
            } catch { /* best-effort UI poll */ }
        }, 3500);
    };

    try {
        ctx?.onDeployProgress?.('Starting deployment on Coolify…');
        startProgressPolling();

        const res = await fetch(`/api/workspace/deploy?projectId=${encodeURIComponent(projectId)}&wait=true`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                buildType: "dockerfile",
                dockerfile: "Dockerfile",
                dockerContextPath: "/",
            }),
        });
        const data = await res.json().catch(() => ({} as any));
        applicationId = data?.applicationId ?? applicationId;
        deploymentId = data?.deploymentId ?? deploymentId;

        if (!res.ok || data?.status !== 'success' || !data?.url) {
            const errMsg = data?.message || data?.autofix?.split('\n')[0] || `HTTP ${res.status}`;
            if (Array.isArray(data?.missingRequiredEnvKeys) || Array.isArray(data?.missingRequiredIntegrationIds)) {
                const missingEnv = Array.isArray(data?.missingRequiredEnvKeys) ? data.missingRequiredEnvKeys : [];
                const missingIntegrations = Array.isArray(data?.missingRequiredIntegrationIds) ? data.missingRequiredIntegrationIds : [];
                return "[SYSTEM] ⏸ Deploy is blocked until required integrations/env values are loaded.\n" +
                    (missingIntegrations.length ? "Missing integrations: " + missingIntegrations.join(", ") + "\n" : "") +
                    (missingEnv.length ? "Missing env keys: " + missingEnv.join(", ") + "\n" : "") +
                    "Call integration() or wait for the user to complete the integrations popup, then continue.";
            }
            if (typeof data?.autofix === 'string' && data.autofix.length > 0) {
                return data.autofix;
            }
            const logsTail = data?.logsTail ? `\n\nBuild logs:\n${data.logsTail}` : '';
            return `[SYSTEM] ❌ Deploy failed: ${errMsg}${logsTail}\n\nAUTO-FIX: read the logs, fix source files, typeCheck(), save(), deploy() again.`;
        }

        ctx?.onDeployProgress?.(data.buildComplete || '✅ Deployment build completed');

        return '[SYSTEM] ✅ Deployment build completed on Coolify.\n\n' +
            (data.buildComplete ? `Build log: ${data.buildComplete}\n` : '') +
            'Live URL: ' + data.url + '\n' +
            'Project ID: ' + (data.projectId || 'auto') + '\n' +
            'Environment ID: ' + (data.environmentId || 'auto') + '\n' +
            'Application ID: ' + (data.applicationId || 'auto') + '\n' +
            'Created: project=' + (data.createdProject ? 'yes' : 'no') + ', env=' + (data.createdEnvironment ? 'yes' : 'no') + ', app=' + (data.created ? 'yes' : 'no');
    } catch (e: any) {
        return "Error deploying project: " + e.message;
    } finally {
        if (pollTimer) clearInterval(pollTimer);
    }
}

async function callCoolifyApi(action: string, extra: Record<string, unknown> = {}): Promise<string> {
    try {
        const res = await fetch("/api/deploy/coolify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, ...extra }),
        });
        const data = await res.json().catch(() => ({} as any));
        if (!res.ok || data?.success === false) {
            const errMsg = data?.error || data?.message || "HTTP " + res.status;
            return "[SYSTEM] ❌ Coolify " + action + " failed: " + errMsg;
        }
        return JSON.stringify(data, null, 2);
    } catch (e: any) {
        return "Error calling Coolify API (" + action + "): " + e.message;
    }
}

async function callCoolifyGet(params: Record<string, string>): Promise<string> {
    try {
        const qs = new URLSearchParams(params).toString();
        const res = await fetch("/api/deploy/coolify?" + qs, {
            headers: { Accept: "application/json" },
        });
        const data = await res.json().catch(() => ({} as any));
        if (!res.ok || data?.success === false) {
            const errMsg = data?.error || data?.message || "HTTP " + res.status;
            return "[SYSTEM] ❌ Coolify query failed: " + errMsg;
        }
        return JSON.stringify(data, null, 2);
    } catch (e: any) {
        return "Error calling Coolify API (query): " + e.message;
    }
}

async function callCoolifyMcp(body: Record<string, unknown>): Promise<string> {
    try {
        const res = await fetch("/api/ai/coolify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({} as any));
        if (typeof data?.summary === "string") return data.summary;
        if (!res.ok || !data?.ok) {
            return "[SYSTEM] ❌ Coolify MCP failed: " + (data?.error || "HTTP " + res.status);
        }
        return JSON.stringify(data, null, 2);
    } catch (e: any) {
        return "Error calling Coolify MCP: " + e.message;
    }
}

/** @deprecated use callCoolifyApi */
async function callDokployApi(action: string, extra: Record<string, unknown> = {}): Promise<string> {
    return callCoolifyApi(action, extra);
}

/** @deprecated use callCoolifyGet */
async function callDokployGet(params: Record<string, string>): Promise<string> {
    return callCoolifyGet(params);
}

async function getProjectEnvStatus(projectId: string): Promise<{
    envKeys: string[];
    integrationIds: string[];
}> {
    try {
        const res = await fetch(`/api/projects/${projectId}/env`);
        const data = await res.json().catch(() => ({} as any));
        const envVars = Array.isArray(data?.envVars) ? data.envVars : [];
        return {
            envKeys: envVars
                .map((item: any) => (typeof item?.key === 'string' ? item.key : ''))
                .filter(Boolean),
            integrationIds: envVars
                .map((item: any) => (typeof item?.integration === 'string' ? item.integration : ''))
                .filter(Boolean),
        };
    } catch {
        return { envKeys: [], integrationIds: [] };
    }
}

function uniqueStrings(values: unknown[]): string[] {
    const seen = new Set<string>();
    const output: string[] = [];
    for (const value of values) {
        if (typeof value !== 'string') continue;
        const trimmed = value.trim();
        if (!trimmed || seen.has(trimmed)) continue;
        seen.add(trimmed);
        output.push(trimmed);
    }
    return output;
}

export async function handleIntegration(args: Record<string, unknown>): Promise<string> {
    const projectId = getHostProjectId();
    if (!projectId) {
        return '[SYSTEM] ❌ integration() is only available when building inside a Sycord project.';
    }

    const requestedIntegrationIds = uniqueStrings([
        typeof args.integration === 'string' ? args.integration : '',
        ...(Array.isArray(args.integrations) ? args.integrations : []),
    ]);
    const requestedEnvKeys = uniqueStrings([
        ...(Array.isArray(args.envKeys) ? args.envKeys : []),
        ...collectEnvKeysForIntegrations(requestedIntegrationIds),
    ]);
    const reason = typeof args.reason === 'string' ? args.reason.trim() : '';

    if (requestedIntegrationIds.length === 0 && requestedEnvKeys.length === 0) {
        return '[SYSTEM] ❌ integration() requires at least one integration id or env key.';
    }

    const envStatus = await getProjectEnvStatus(projectId);
    const existingEnvKeys = new Set(envStatus.envKeys);
    const existingIntegrationIds = new Set(envStatus.integrationIds);
    const missingEnvKeys = requestedEnvKeys.filter((envKey) => !existingEnvKeys.has(envKey));
    const missingIntegrationIds = requestedIntegrationIds.filter((integrationId) => !existingIntegrationIds.has(integrationId));

    if (missingEnvKeys.length === 0 && missingIntegrationIds.length === 0) {
        const readyNames = requestedIntegrationIds
            .map((integrationId) => getIntegrationById(integrationId)?.name || integrationId)
            .join(', ');
        return `[SYSTEM] ✅ Required integration/environment values are already configured.${readyNames ? ` Ready: ${readyNames}.` : ''} You can continue.`;
    }

    try {
        await fetch(`/api/projects/${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requiredEnvKeys: missingEnvKeys,
                requiredIntegrationIds: missingIntegrationIds,
                pendingIntegrationRequest: {
                    integrations: missingIntegrationIds,
                    envKeys: missingEnvKeys,
                    reason: reason || null,
                    requestedAt: new Date().toISOString(),
                    source: 'ai-tool',
                },
            }),
        });
    } catch {
        // The popup bridge below is the critical path; project metadata persistence
        // is best-effort so deploy() can enforce missing envs later.
    }

    if (typeof window !== 'undefined') {
        window.dispatchEvent(
            new CustomEvent('sycord:integration-request', {
                detail: {
                    integrations: missingIntegrationIds,
                    envKeys: missingEnvKeys,
                    reason,
                    source: 'ai-tool',
                },
            }),
        );
    }

    const integrationNames = missingIntegrationIds
        .map((integrationId) => getIntegrationById(integrationId)?.name || integrationId)
        .join(', ');
    return (
        `[SYSTEM] ⏸ Integration setup required.\n` +
        (integrationNames ? `Requested integrations: ${integrationNames}\n` : '') +
        (missingEnvKeys.length > 0 ? `Missing env keys: ${missingEnvKeys.join(', ')}\n` : '') +
        `I opened the integrations popup/tab for the user. Stop here and wait for the user to load the required environment values before continuing.`
    );
}

/**
 * Create a new Coolify project.
 */
export async function handleCreateProject(args: Record<string, unknown>): Promise<string> {
    const name = typeof args.name === "string" ? args.name.trim() : "";
    if (!name) return "[SYSTEM] ❌ Project name is required.";
    return callCoolifyMcp({
        action: "create_project",
        name,
        description: typeof args.description === "string" ? args.description : undefined,
    });
}

/**
 * Create environment — Coolify uses named environments on projects (no separate create API needed for deploy).
 */
export async function handleCreateEnvironment(args: Record<string, unknown>): Promise<string> {
    const name = typeof args.name === "string" ? args.name.trim() : "production";
    return `[SYSTEM] ✅ Coolify uses environment names like "${name}" when creating applications. Pass environment_name on deploy — no separate environment UUID required.`;
}

/**
 * List Coolify projects, servers, applications, or deployments.
 */
export async function handleListDokployResources(args: Record<string, unknown>): Promise<string> {
    const resource = (typeof args.resource === "string" ? args.resource : "applications") as string;
    const map: Record<string, string> = {
        projects: "projects",
        servers: "servers",
        applications: "applications",
        containers: "applications",
        deployments: "deployments",
    };
    const mapped = map[resource] || "applications";
    return callCoolifyGet({ resource: mapped });
}

/**
 * Manage a Coolify application (restart, start, stop).
 */
export async function handleManageContainer(args: Record<string, unknown>): Promise<string> {
    const applicationUuid = typeof args.containerId === "string" ? args.containerId.trim() : "";
    const operation = (typeof args.operation === "string" ? args.operation : "restart") as string;
    if (!applicationUuid) return "[SYSTEM] ❌ applicationUuid (containerId) is required.";
    const actionMap: Record<string, string> = {
        restart: "restart",
        start: "start",
        stop: "stop",
        deploy: "deploy",
    };
    const action = actionMap[operation] || "restart";
    return callCoolifyApi(action, { applicationUuid, force: false });
}

/**
 * Domains are set during deploy() on Coolify via the domains field.
 */
export async function handleGenerateDomain(args: Record<string, unknown>): Promise<string> {
    const appName = typeof args.appName === "string" ? args.appName.trim() : "";
    if (!appName) return "[SYSTEM] ❌ appName is required.";
    return `[SYSTEM] ✅ Coolify domain for deploy: https://${appName}.sycord.site — set automatically when you call deploy().`;
}

export async function handleCoolifyMcp(args: Record<string, unknown>): Promise<string> {
    const action = typeof args.action === "string" ? args.action.trim() : "";
    if (!action) return "[SYSTEM] ❌ coolifyMcp requires action.";
    return callCoolifyMcp({
        action,
        applicationUuid: typeof args.applicationUuid === "string" ? args.applicationUuid : undefined,
        deploymentUuid: typeof args.deploymentUuid === "string" ? args.deploymentUuid : undefined,
        uuid: typeof args.uuid === "string" ? args.uuid : undefined,
        command: typeof args.command === "string" ? args.command : undefined,
        force: Boolean(args.force),
        name: typeof args.name === "string" ? args.name : undefined,
        description: typeof args.description === "string" ? args.description : undefined,
        envs: Array.isArray(args.envs) ? args.envs : undefined,
    });
}

export async function handleCoolifyCommand(args: Record<string, unknown>): Promise<string> {
    const applicationUuid = typeof args.applicationUuid === "string" ? args.applicationUuid : "";
    const command = typeof args.command === "string" ? args.command.trim() : "";
    if (!applicationUuid) return "[SYSTEM] ❌ applicationUuid is required.";
    if (!command) return "[SYSTEM] ❌ command is required.";
    return callCoolifyMcp({ action: "execute_command", applicationUuid, command });
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

/**
 * Merge npm dependencies into the project's package.json (never runs npm install).
 */
async function mergePackageDependencies(newDeps: Record<string, string>): Promise<string[]> {
    await syncStoreFromPages();
    const files = useStore.getState().files;
    const pkgPath = 'package.json';
    let pkgRaw = files[pkgPath]?.file?.contents;

    if (!pkgRaw) {
        try {
            pkgRaw = await readFileResilient(pkgPath);
        } catch {
            return [];
        }
    }

    let pkg: { dependencies?: Record<string, string> };
    try {
        pkg = JSON.parse(pkgRaw);
    } catch {
        return ['⚠️ package.json is invalid JSON — could not merge npm dependencies'];
    }

    pkg.dependencies = pkg.dependencies || {};
    const added: string[] = [];

    for (const [name, version] of Object.entries(newDeps)) {
        if (!pkg.dependencies[name]) {
            pkg.dependencies[name] = version;
            added.push(name);
        }
    }

    if (added.length > 0) {
        const updated = `${JSON.stringify(pkg, null, 2)}\n`;
        await persistFile(pkgPath, updated);
    }

    return added;
}

/** Ensure lib/utils.ts, components.json, globals.css, and tailwind tokens exist. */
async function ensureShadcnFoundationInProject(): Promise<string[]> {
    await syncStoreFromPages();
    const files = useStore.getState().files;
    const missing = getMissingShadcnFoundationFiles(files);
    const results: string[] = [];

    for (const [path, content] of Object.entries(missing)) {
        await persistFile(path, content);
        results.push(`📦 shadcn foundation: ${path}`);
    }

    const addedDeps = await mergePackageDependencies(SHADCN_FOUNDATION_DEPENDENCIES);
    if (addedDeps.length > 0) {
        results.push(`📦 npm deps added: ${addedDeps.join(', ')}`);
    }

    return results;
}

/**
 * Add shadcn/ui components by fetching official registry source (no CLI).
 * Files are written to components/ui/ and persisted to Pages automatically.
 */
export async function handleAddShadcnComponent(args: Record<string, unknown>): Promise<string> {
    const component = typeof args.component === 'string' ? args.component.trim() : '';
    const components = Array.isArray(args.components) ? args.components : [];
    const items = [...(component ? [component] : []), ...components.map(String)];

    if (items.length === 0) {
        return '[SYSTEM] ❌ addShadcnComponent requires at least one component name. Example: addShadcnComponent({ component: "button" })';
    }

    const results: string[] = [];

    try {
        const foundation = await ensureShadcnFoundationInProject();
        results.push(...foundation);
    } catch (e: any) {
        results.push(`⚠️ shadcn foundation setup: ${e.message}`);
    }

    try {
        const res = await fetch('/api/ai/shadcn-registry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ components: items }),
            signal: AbortSignal.timeout(60000),
        });

        const data = await res.json().catch(() => ({} as any));

        if (!res.ok) {
            return `[SYSTEM] ❌ shadcn registry failed: ${data?.error || `HTTP ${res.status}`}`;
        }

        const registryFiles: Array<{ path: string; content: string }> = Array.isArray(data.files) ? data.files : [];
        const npmDeps: Record<string, string> = data.dependencies && typeof data.dependencies === 'object' ? data.dependencies : {};

        if (registryFiles.length === 0) {
            return '[SYSTEM] ❌ Registry returned no files. Check component names with shadcnDocs() or listShadcnComponents().';
        }

        const addedDeps = await mergePackageDependencies(npmDeps);
        if (addedDeps.length > 0) {
            results.push(`📦 npm deps added: ${addedDeps.join(', ')}`);
        }

        let savedCount = 0;
        let pathFixCount = 0;
        for (const file of registryFiles) {
            if (!file.path || file.content === undefined) continue;
            const { content, count } = normalizeShadcnImportPaths(file.content);
            pathFixCount += count;
            await persistFile(file.path, content);
            savedCount++;
        }

        const source = data.source === 'local' ? 'local Sycord fallback' : 'ui.shadcn.com registry';
        const installed = Array.isArray(data.installed) ? data.installed.join(', ') : items.join(', ');
        results.push(`✅ Installed ${savedCount} file(s) for [${installed}] from ${source}`);
        if (pathFixCount > 0) {
            results.push(`🔧 Rewrote ${pathFixCount} registry import path(s): @/registry/new-york/ui/* → @/components/ui/*`);
        }
        results.push('Re-run listShadcnComponents() to verify before writing imports.');
    } catch (e: any) {
        results.push(`❌ Registry install failed: ${e.message}`);
    }

    return '[SYSTEM] Shadcn component installation:\n' + results.join('\n');
}

// Tool definitions for AI
export const TOOL_DEFINITIONS = [
    {
        type: 'function',
        function: {
            name: 'saveKnowledge',
            description: 'Save short-form logic or deep-think context to a separated knowledge block. Used to build a deep memory of the project. AI should use this when generating logic-heavy files.',
            parameters: {
                type: 'object',
                properties: {
                    title: { type: 'string', description: 'A short, descriptive title for the knowledge block (acts as the filename without extension).' },
                    content: { type: 'string', description: 'The knowledge content, logic, or deep-think notes.' }
                },
                required: ['title', 'content'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'listKnowledge',
            description: 'List all separated knowledge blocks available in deep memory.',
            parameters: { type: 'object', properties: {}, required: [] },
        },
    },
    {
        type: 'function',
        function: {
            name: 'callKnowledge',
            description: 'Retrieve the content of a specific knowledge block to use its information to move forward.',
            parameters: {
                type: 'object',
                properties: {
                    title: { type: 'string', description: 'The exact title of the knowledge block to retrieve.' }
                },
                required: ['title'],
            },
        },
    },

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
            name: 'grep',
            description: `Regex search across project files. Returns file paths, line numbers, and matching lines. USE THIS to find bad imports (e.g. pattern "@/registry/new-york"), missing symbols, or strings before fixing with write_file/editFile. Prefer grep over guessing file locations.`,
            parameters: {
                type: 'object',
                properties: {
                    pattern: { type: 'string', description: 'Regex pattern to search for, e.g. "@/registry/new-york" or "from \'@/components/ui/"' },
                    filePattern: { type: 'string', description: 'Optional glob to filter paths, e.g. "*.tsx" or "components/**"' },
                    caseSensitive: { type: 'boolean', description: 'Default false (case-insensitive). Set true for exact case matching.' },
                },
                required: ['pattern'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'write_file',
            description: `Write or patch a file without rewriting the whole project. Saves to Pages (MongoDB).
- Full file: write_file({ path, content }) — same as createFile for new/complete rewrites.
- Surgical patch: write_file({ path, content, startLine, endLine }) — replace ONLY lines startLine–endLine (1-based, inclusive) with content. Use after grep() shows line numbers.
- For find/replace by exact text, prefer editFile({ path, oldContent, newContent }) after readFile.`,
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'File path, e.g. components/ui/form.tsx' },
                    content: { type: 'string', description: 'New content — full file OR replacement lines for a line-range patch' },
                    startLine: { type: 'number', description: '1-based start line for partial patch (from grep output)' },
                    endLine: { type: 'number', description: '1-based end line for partial patch (inclusive)' },
                },
                required: ['path', 'content'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'searchInFiles',
            description: 'Alias for grep({ pattern: query }). Prefer grep() for regex search with line numbers.',
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
            name: 'createWorkspace',
            description: 'REQUIRED FIRST STEP — POST /api/create_project on Syte (https://sycord.site/api/). Creates an empty workspace and returns the UUID needed for executeCommand, typeCheck, write_file, and deploy. Call this before ANY other workspace command. Response includes execute_command.body pre-filled for npm install.',
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
            name: 'typeCheck',
            description: 'Run TypeScript in the Syte workspace (requires createWorkspace first). Syncs files, npm install, npx tsc --noEmit. Same as executeCommand("npx tsc --noEmit --pretty").',
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
            name: 'executeCommand',
            description: 'Run ANY shell command in the Syte workspace (requires createWorkspace UUID first). Examples: npm install, npx shadcn@latest init -y, npx shadcn@latest add button -y, npm run build, npx tsc --noEmit. Docs: https://sycord.site/api/',
            parameters: {
                type: 'object',
                properties: {
                    command: { type: 'string', description: 'Shell command to run, e.g. "npm install", "npm run build", "npx tsc --noEmit --pretty"' },
                    cwd: { type: 'string', description: 'Working directory inside workspace (default: app)' },
                    timeout: { type: 'number', description: 'Timeout in seconds (default 300, max 1800)' },
                },
                required: ['command'],
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
            description: 'Save the project source files to GitHub (creates the repository on first save). Call this BEFORE deploy() — Coolify deploys by building the GitHub repository.',
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
            description: "Deploy the project to sycord.site via Coolify (Docker/Nixpacks). Waits for build completion in logs. Syncs env vars from Integrations, attaches GitHub source, creates domain, triggers deployment. Call save() first. On failure use coolifyMcp/get_deployment logs for AUTO-FIX.",
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
            name: 'integration',
            description: 'Open the integrations popup/tab and request required providers or environment keys. Use this when the project needs database, auth, email, payment, AI, or other secrets. After calling this tool, STOP and wait for the user to load the requested env values.',
            parameters: {
                type: 'object',
                properties: {
                    integration: { type: 'string', description: 'Single integration id, e.g. "supabase", "resend", or "stripe".' },
                    integrations: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Optional list of integration ids to request at once.',
                    },
                    envKeys: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Optional list of exact environment variable keys the project requires.',
                    },
                    reason: { type: 'string', description: 'Short explanation shown in the popup so the user knows why these keys are needed.' },
                },
                required: [],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'createDokployProject',
            description: 'Create a new project in Coolify (legacy tool name). Prefer coolifyMcp({ action: "create_project", name }).',
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
            description: 'Coolify environments are named (e.g. production) — no separate env UUID needed. Use deploy() directly.',
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
            description: 'List Coolify projects, servers, applications, or deployments. resource: projects | servers | applications | deployments',
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
            description: 'Manage a Coolify application by UUID: restart, start, stop, or deploy. Pass application UUID as containerId.',
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
            description: 'Coolify sets the public domain automatically during deploy() as https://{appName}.sycord.site',
            parameters: {
                type: 'object',
                properties: {
                    appName: { type: 'string', description: 'The deploy app name slug (required)' },
                },
                required: ['appName'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'coolifyMcp',
            description: 'Coolify MCP/API bridge — list apps, get deployment logs, deploy, restart, sync envs. Auth: DEPLOYER_API_KEY. Actions: health, version, list_projects, create_project, list_servers, list_applications, get_application, deploy_application, restart_application, stop_application, start_application, list_deployments, get_deployment, get_application_logs, bulk_update_envs, execute_command.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', description: 'Coolify MCP action name (required)' },
                    applicationUuid: { type: 'string', description: 'Coolify application UUID' },
                    deploymentUuid: { type: 'string', description: 'Coolify deployment UUID' },
                    uuid: { type: 'string', description: 'Generic UUID for get operations' },
                    command: { type: 'string', description: 'Shell command for execute_command' },
                    force: { type: 'boolean', description: 'Force rebuild on deploy/restart' },
                    name: { type: 'string', description: 'Project name for create_project' },
                    description: { type: 'string', description: 'Project description for create_project' },
                },
                required: ['action'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'coolifyCommand',
            description: 'Run a one-shot shell command on a Coolify application container via post-deployment hook + restart. Requires applicationUuid.',
            parameters: {
                type: 'object',
                properties: {
                    applicationUuid: { type: 'string', description: 'Coolify application UUID (required)' },
                    command: { type: 'string', description: 'Shell command to run (required)' },
                },
                required: ['applicationUuid', 'command'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'listShadcnComponents',
            description: `List every shadcn/ui component that is ALREADY installed in this project (files present under components/ui/).
ALWAYS call this FIRST before writing any import statement like \`import { X } from '@/components/ui/x'\`.
The returned list is the ground truth — if a component is NOT in the list, it is NOT installed and any import of it will cause a build error.
After calling this:
- If the component is in the list → import it safely.
- If the component is NOT in the list → call addShadcnComponent({ component: "<name>" }) first, then import it.
Never skip this check. Build failures from missing UI modules happen 100% of the time when this check is skipped.`,
            parameters: { type: 'object', properties: {}, required: [] },
        },
    },
    {
        type: 'function',
        function: {
            name: 'addShadcnComponent',
            description: 'Install shadcn/ui components from the official ui.shadcn.com registry (NO CLI — files are copied into components/ui/ with correct Radix deps). This is the ONLY way to add UI primitives — never write component files manually. PREREQUISITE: call listShadcnComponents() first. Automatically sets up lib/utils.ts, components.json, CSS design tokens, and package.json deps. Use for: button, card, dialog, sheet, dropdown-menu, table, tabs, form, input, select, checkbox, switch, badge, avatar, separator, accordion, alert, and all other shadcn components.',
            parameters: {
                type: 'object',
                properties: {
                    component: { type: 'string', description: 'Single component name, e.g., "button" or "card"' },
                    components: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Optional list of component names to install at once, e.g., ["button", "card", "dialog"]'
                    },
                },
                required: [],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'shadcnDocs',
            description: `Fetch live, accurate documentation for any shadcn/ui component from ui.shadcn.com.
Use this BEFORE using or installing any shadcn/ui component to get its exact current API, props, composition patterns, and usage examples.
This prevents hallucination and ensures the generated code matches the real component API.
Always call this when:
- You are about to use a shadcn/ui component for the first time in a session
- You are unsure of a component's correct props, variants, or composition pattern
- The user asks about a specific shadcn component's API
- You need to know if a component exists and what it's called

Available components: accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, combobox, command, context-menu, data-table, date-picker, dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toggle, toggle-group, tooltip, typography.`,
            parameters: {
                type: 'object',
                properties: {
                    component: {
                        type: 'string',
                        description: 'The shadcn/ui component name to look up documentation for, e.g. "button", "dialog", "form", "data-table". Use the kebab-case name.',
                    },
                },
                required: ['component'],
            },
        },
    },
];

// Tool execution context
export interface ToolContext {
    addTerminalOutput: (output: string) => void;
    setSelectedFile: (path: string) => void;
    /** Live status while deploy() polls Dokploy build logs. */
    onDeployProgress?: (message: string) => void;
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

export async function handleGrep(args: {
    pattern?: string;
    query?: string;
    filePattern?: string;
    caseSensitive?: boolean;
}): Promise<string> {
    try {
        const pattern = args.pattern ?? args.query;
        if (!pattern) {
            return 'Error: grep requires a `pattern` (regex string). Example: grep({ pattern: "@/registry/new-york" })';
        }

        const { filePattern, caseSensitive } = args;
        await syncStoreFromPages();
        const files = useStore.getState().files;
        const results: string[] = [];
        let totalMatches = 0;

        let regex: RegExp;
        try {
            regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
        } catch (e: any) {
            return `Error: Invalid regex pattern "${pattern}": ${e.message}. Escape special chars or simplify the pattern.`;
        }

        for (const [path, file] of Object.entries(files)) {
            if (filePattern) {
                const glob = filePattern.replace(/\*\*/g, '§§').replace(/\*/g, '[^/]*').replace(/§§/g, '.*').replace(/\?/g, '.');
                if (!new RegExp(`^${glob}$`).test(path.replace(/\\/g, '/'))) continue;
            }

            const content = file.file?.contents ?? '';
            const lines = content.split('\n');
            const matchingLines: string[] = [];

            lines.forEach((line, idx) => {
                regex.lastIndex = 0;
                if (regex.test(line)) {
                    matchingLines.push(`  L${idx + 1}: ${line.trim().substring(0, 140)}`);
                    totalMatches++;
                }
            });

            if (matchingLines.length > 0) {
                results.push(
                    `📄 ${path} (${matchingLines.length} match${matchingLines.length === 1 ? '' : 'es'}):\n` +
                    `${matchingLines.slice(0, 15).join('\n')}` +
                    `${matchingLines.length > 15 ? `\n  ... and ${matchingLines.length - 15} more lines` : ''}`,
                );
            }
        }

        if (results.length === 0) {
            return `[SYSTEM] grep: no matches for /${pattern}/${caseSensitive ? '' : 'i'}${filePattern ? ` in ${filePattern}` : ''}.`;
        }

        return `[SYSTEM] grep: ${totalMatches} match${totalMatches === 1 ? '' : 'es'} in ${results.length} file${results.length === 1 ? '' : 's'} (pattern /${pattern}/):\n\n${results.join('\n\n')}\n\nTip: fix a single line with write_file({ path, content, startLine, endLine }) or batch-fix with editFile after readFile.`;
    } catch (e: any) {
        return `Error in grep: ${e.message}`;
    }
}

/** @deprecated Prefer grep({ pattern }) — kept for backward compatibility. */
export async function handleSearchInFiles(args: { query: string; filePattern?: string }): Promise<string> {
    return handleGrep({ pattern: args.query, filePattern: args.filePattern });
}

export async function handleWriteFile(
    args: { path: string; content: string; startLine?: number; endLine?: number },
    ctx: ToolContext,
): Promise<string> {
    const { path, content, startLine, endLine } = args;

    if (!path || typeof path !== 'string') {
        return 'Error: write_file requires a valid path';
    }
    if (content === undefined || content === null) {
        return `Error: write_file requires content for ${path}`;
    }

    try {
        ctx.setSelectedFile(path);

        let newContent = content;
        let patchNote = '';

        if (startLine !== undefined || endLine !== undefined) {
            const currentContent = await readFileResilient(path);
            const lines = currentContent.split('\n');
            const start = startLine ?? endLine ?? 1;
            const end = endLine ?? startLine ?? start;

            if (start < 1 || end < start || end > lines.length) {
                return `Error: write_file line range ${start}-${end} is invalid (file has ${lines.length} lines). Run grep({ pattern: "..." }) to get correct line numbers, then readFile("${path}") to confirm.`;
            }

            const replacementLines = content.split('\n');
            newContent = [...lines.slice(0, start - 1), ...replacementLines, ...lines.slice(end)].join('\n');
            patchNote = ` (patched lines ${start}-${end})`;
        } else {
            patchNote = ` (${content.split('\n').length} lines)`;
        }

        const pageSync = await persistFile(path, newContent);
        if (pageSync.status === 'error') {
            return `Error saving file ${path} to Pages: ${pageSync.message}`;
        }
        const savedNote = pageSync.status === 'saved' ? ' (saved to Pages)' : '';
        return `[SYSTEM] write_file: ${path}${patchNote}${savedNote}`;
    } catch (e: any) {
        return `Error in write_file ${path}: ${e.message}`;
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

    // 0. Missing shadcn import scan (client-side ground truth)
    try {
        await syncStoreFromPages();
        const files = useStore.getState().files;
        const scanFiles = Object.entries(files).map(([name, f]) => ({
            name,
            content: f.file.contents,
        }));
        const missingImports = [
            ...scanMissingShadcnImports(scanFiles),
            ...scanRegistryImportPaths(scanFiles),
        ];
        if (missingImports.length > 0) {
            const lines = missingImports.slice(0, 15).map((e) => `  ${e.file}:${e.line} — ${e.message}`).join('\n');
            results.push(`🔴 Missing shadcn/ui modules:\n${lines}`);
        }
    } catch { /* best-effort */ }

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


/**
 * List every shadcn/ui component already installed in the project by scanning
 * the store for files under components/ui/. This is the ground-truth check
 * Syra must run before writing ANY @/components/ui/<x> import statement.
 *
 * If a component is not in this list it is not installed and importing it will
 * cause a "Module not found" build error.
 */
export async function handleListShadcnComponents(): Promise<string> {
    try {
        // Sync from the Pages tab so the store reflects the real file system.
        await syncStoreFromPages();
        const files = useStore.getState().files;

        // Collect all .tsx files under components/ui/ at any nesting depth.
        const installed: string[] = Object.keys(files)
            .filter(p => {
                const norm = p.replace(/\\/g, '/').toLowerCase();
                return (
                    norm.includes('components/ui/') &&
                    (norm.endsWith('.tsx') || norm.endsWith('.ts'))
                );
            })
            .map(p => {
                // Extract the bare component name: components/ui/button.tsx → button
                const parts = p.replace(/\\/g, '/').split('/');
                const filename = parts[parts.length - 1];
                return filename.replace(/\.(tsx|ts)$/, '');
            })
            .sort();

        if (installed.length === 0) {
            return (
                '[SYSTEM] No shadcn/ui components are installed yet (components/ui/ is empty or does not exist).\n' +
                'Before importing any @/components/ui/<name>, call addShadcnComponent({ component: "<name>" }) first.'
            );
        }

        return (
            `[SYSTEM] Installed shadcn/ui components (${installed.length} total):\n` +
            installed.map(c => `  - ${c}`).join('\n') +
            '\n\nIMPORTANT: Only import components from this list. ' +
            'If the component you need is missing, call addShadcnComponent({ component: "<name>" }) before writing the import.'
        );
    } catch (e: any) {
        return `[SYSTEM] ❌ listShadcnComponents failed: ${e.message}`;
    }
}

/**
 * Fetch live shadcn/ui component documentation from the Syra server-side
 * endpoint (/api/ai/shadcn-docs). This gives Syra accurate, up-to-date
 * component APIs without hallucination.
 */
export async function handleShadcnDocs(args: Record<string, unknown>): Promise<string> {
    const component = typeof args.component === 'string' ? args.component.trim().toLowerCase() : '';
    if (!component) {
        return '[SYSTEM] ❌ shadcnDocs requires a "component" field, e.g. shadcnDocs({ component: "button" })';
    }

    try {
        const res = await fetch('/api/ai/shadcn-docs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ component }),
            signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
            const text = await res.text().catch(() => `HTTP ${res.status}`);
            return `[SYSTEM] ❌ shadcnDocs failed for "${component}": ${text}`;
        }

        const data = await res.json().catch(() => ({} as any));
        const source = data.source === 'live' ? 'live docs from ui.shadcn.com' : 'cached reference';
        const url = data.url || `https://ui.shadcn.com/docs/components/${component}`;

        if (!data.docs) {
            return `[SYSTEM] No documentation found for "${component}". See ${url}`;
        }

        return (
            `[SYSTEM] shadcn/ui docs for "${data.component || component}" (${source}):\n` +
            `Reference URL: ${url}\n\n` +
            data.docs
        );
    } catch (e: any) {
        // Graceful degradation — tell Syra to use its built-in knowledge
        return (
            `[SYSTEM] ⚠️ Could not fetch live docs for "${component}" (${e.message}). ` +
            `Use your built-in shadcn/ui knowledge and check https://ui.shadcn.com/docs/components/${component} for reference.`
        );
    }
}


export async function handleSaveKnowledge(args: { title: string; content: string }): Promise<string> {
    const { title, content } = args;
    if (!title || !content) return 'Error: title and content are required.';
    const path = `.glovix/knowledge/${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
    try {
        const pageSync = await persistFile(path, content);
        if (pageSync.status === 'error') {
            return `Error saving knowledge to Pages: ${pageSync.message}`;
        }
        return `[SYSTEM] Saved knowledge block: ${title}`;
    } catch (e: any) {
        return `Error saving knowledge: ${e.message}`;
    }
}

export async function handleListKnowledge(): Promise<string> {
    try {
        await syncStoreFromPages();
        const files = useStore.getState().files;
        const blocks = Object.keys(files)
            .filter(p => p.startsWith('.glovix/knowledge/') && p.endsWith('.md'))
            .map(p => p.replace('.glovix/knowledge/', '').replace('.md', ''));

        if (blocks.length === 0) {
            return '[SYSTEM] No knowledge blocks found in deep memory.';
        }
        return `[SYSTEM] Available knowledge blocks:\n` + blocks.map(b => `- ${b}`).join('\n');
    } catch (e: any) {
        return `Error listing knowledge: ${e.message}`;
    }
}

export async function handleCallKnowledge(args: { title: string }): Promise<string> {
    const { title } = args;
    if (!title) return 'Error: title is required.';
    const path = `.glovix/knowledge/${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
    try {
        const content = await readFileResilient(path);
        return `[SYSTEM] Knowledge block "${title}":\n\n${content}`;
    } catch (e: any) {
        return `Error reading knowledge block "${title}": ${e.message}`;
    }
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
    const toolName = name === 'Grep' ? 'grep' : name === 'writeFile' ? 'write_file' : name;

    // Handle tools without arguments
    if (toolName === 'createWorkspace') return handleCreateWorkspace();
    if (toolName === 'typeCheck') return handleTypeCheck(ctx);
    if (toolName === 'listFiles') return await handleListFiles();
    if (toolName === 'getErrors') return handleGetErrors(ctx);
    if (toolName === 'save') return handleSave();
    if (toolName === 'deploy') return handleDeploy(ctx);

    // Parse arguments
    const argsList = parseToolArguments(argsString);
    if (argsList.length === 0) {
        return `Error: Invalid arguments for tool "${toolName}". Could not parse JSON.\nRaw input: ${argsString.substring(0, 300)}\n\n⚠️ Make sure your tool arguments are valid JSON.`;
    }

    const results: string[] = [];

    for (const args of argsList) {
        let result: string;

        try {
            switch (toolName) {
                case 'createFile':
                    result = await handleCreateFile(args, ctx);
                    break;
                case 'write_file':
                    result = await handleWriteFile(args, ctx);
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
                case 'grep':
                    result = await handleGrep(args);
                    break;
                case 'searchInFiles':
                    result = await handleSearchInFiles(args);
                    break;
                case 'executeCommand':
                    result = await handleExecuteCommand(args, ctx);
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
                case 'integration':
                    result = await handleIntegration(args);
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
                case 'coolifyMcp':
                    result = await handleCoolifyMcp(args);
                    break;
                case 'coolifyCommand':
                    result = await handleCoolifyCommand(args);
                    break;
                case 'addShadcnComponent':
                    result = await handleAddShadcnComponent(args);
                    break;
                case 'listShadcnComponents':
                    result = await handleListShadcnComponents();
                    break;

                case 'saveKnowledge':
                    result = await handleSaveKnowledge(args);
                    break;
                case 'listKnowledge':
                    result = await handleListKnowledge();
                    break;
                case 'callKnowledge':
                    result = await handleCallKnowledge(args);
                    break;

                case 'shadcnDocs':
                    result = await handleShadcnDocs(args);
                    break;
                default:
                    result = `Unknown tool: "${name}". Available: createWorkspace, createFile, write_file, editFile, readFile, readMultipleFiles, deleteFile, renameFile, listFiles, grep, searchInFiles, executeCommand, typeCheck, lintCheck, drawDiagram, batchCreateFiles, getErrors, save, deploy, integration, coolifyMcp, coolifyCommand, createDokployProject, createDokployEnvironment, listDokployResources, manageContainer, generateDomain, listShadcnComponents, addShadcnComponent, shadcnDocs, saveKnowledge, listKnowledge, callKnowledge`;
            }
        } catch (e: any) {
            result = `[SYSTEM] ❌ Tool "${name}" crashed: ${e.message}. Try again or use a different approach.`;
        }

        results.push(result);
    }

    return results.join('\n');
}
