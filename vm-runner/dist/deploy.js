import { promises as fs } from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { appendLog, ensureBaseDirectories, resetProjectLogs } from "./logs.js";
import { getEnvFilePath, getProcessName, getProjectRoot, validateDeployPath, validateProjectId, validateSubdomain } from "./paths.js";
import { runHealthCheck } from "./health.js";
import { startOrRestartProcess } from "./processes.js";
import { reloadProxy, writeProxyConfig } from "./proxy.js";
import { allocatePort, getWebsiteState, retryAllocatePort, upsertWebsiteState } from "./state.js";
async function writeFiles(projectId, files) {
    const root = getProjectRoot(projectId);
    await fs.rm(root, { recursive: true, force: true });
    await fs.mkdir(root, { recursive: true });
    for (const file of files) {
        validateDeployPath(file.path);
        const outputPath = path.join(root, file.path);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, file.content);
    }
    return root;
}
async function writeEnvFile(projectId, envVars = {}) {
    const content = Object.entries(envVars)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join("\n");
    const envPath = getEnvFilePath(projectId);
    await fs.mkdir(path.dirname(envPath), { recursive: true });
    await fs.writeFile(envPath, content, { mode: 0o600 });
    await fs.chmod(envPath, 0o600);
    return envPath;
}
async function runBuildStep(projectId, cwd, stream) {
    const buildLogs = [];
    stream?.stage("installing", "running", "Installing dependencies");
    const { runCommand } = await import("./processes.js");
    const install = await runCommand("npm", ["install", "--no-fund", "--no-audit", "--legacy-peer-deps"], {
        cwd,
        onLine: (line) => {
            buildLogs.push(line);
            void appendLog(projectId, "deploy", line);
            void appendLog(projectId, "build", line);
            stream?.log("install", line);
        },
    });
    if (install.code !== 0) {
        const lastLines = buildLogs.slice(-20).join("\n");
        throw new Error(`npm install failed (exit ${install.code}): ${lastLines}`);
    }
    stream?.stage("building", "running", "Running next build");
    const build = await runCommand("npm", ["run", "build"], {
        cwd,
        onLine: (line) => {
            buildLogs.push(line);
            void appendLog(projectId, "build", line);
            stream?.log("build", line);
        },
    });
    if (build.code !== 0) {
        const lastLines = buildLogs.slice(-20).join("\n");
        throw new Error(`npm run build failed (exit ${build.code}): ${lastLines}`);
    }
    return { logs: buildLogs };
}
const MAX_START_RETRIES = 3;
export async function deployProject(projectId, payload, stream = null) {
    validateProjectId(projectId);
    validateSubdomain(payload.subdomain);
    if (payload.deployment_mode !== "next-server") {
        throw new Error('deployment_mode must be "next-server"');
    }
    await ensureBaseDirectories();
    await resetProjectLogs(projectId);
    stream?.stage("queued", "pending", "Deployment queued");
    stream?.stage("preparing-files", "running", "Preparing project directory");
    await appendLog(projectId, "deploy", `Preparing deployment for ${projectId}`);
    const cwd = await writeFiles(projectId, payload.files);
    stream?.stage("preparing-files", "success", `Wrote ${payload.files.length} files`);
    stream?.log("runner", `Writing ${payload.files.length} files`);
    const envFile = await writeEnvFile(projectId, payload.env_vars);
    const buildResult = await runBuildStep(projectId, cwd, stream);
    stream?.stage("allocating-port", "running", "Allocating port for website");
    const previous = await getWebsiteState(projectId);
    const port = previous?.port || (await allocatePort(projectId));
    const processName = getProcessName(projectId);
    stream?.log("runner", `Allocated port ${port}`);
    stream?.stage("allocating-port", "success", `Port ${port} allocated`);
    stream?.stage("starting-server", "running", "Starting Next.js server");
    let startCode = 0;
    let runtimeOut = [];
    let runtimeErr = [];
    let currentPort = port;
    for (let attempt = 0; attempt < MAX_START_RETRIES; attempt += 1) {
        const result = await startOrRestartProcess(projectId, processName, currentPort, cwd, envFile);
        startCode = result.code;
        runtimeOut = result.stdout;
        runtimeErr = result.stderr;
        for (const line of runtimeOut.concat(runtimeErr)) {
            await appendLog(projectId, "runtime", line);
            stream?.log("runtime", line);
        }
        if (startCode === 0)
            break;
        const combined = runtimeErr.join("\n").toLowerCase();
        if (combined.includes("eaddrinuse") || combined.includes("address already in use")) {
            const newPort = await retryAllocatePort(projectId, currentPort);
            stream?.log("runner", `Port ${currentPort} in use, retrying with port ${newPort}`);
            await appendLog(projectId, "error", `EADDRINUSE on port ${currentPort}, retrying with ${newPort}`);
            currentPort = newPort;
            continue;
        }
        throw new Error(`Failed to start Next.js server (exit ${startCode})`);
    }
    if (startCode !== 0) {
        throw new Error(`Failed to start Next.js server after ${MAX_START_RETRIES} attempts`);
    }
    const domain = `${payload.subdomain}.${config.baseDomain}`;
    stream?.stage("configuring-proxy", "running", "Configuring nginx reverse proxy");
    await writeProxyConfig(projectId, domain, currentPort);
    await reloadProxy();
    stream?.stage("configuring-proxy", "success", "Proxy configured");
    stream?.stage("health-check", "running", "Checking root HTML response");
    const health = await runHealthCheck(projectId, currentPort);
    if (!health.ok || !health.htmlOk) {
        stream?.stage("health-check", "error", health.error || "Root response invalid");
        stream?.error({
            error: health.error || "Root route did not return valid HTML",
            stage: "health-check",
            logs: [health.detail || ""],
        });
        const failResponse = {
            success: false,
            deployment_mode: "next-server",
            project_id: projectId,
            domain,
            port: currentPort,
            processName,
            build: { ok: true, logs: buildResult.logs },
            running: false,
            health: {
                ok: health.ok,
                htmlOk: health.htmlOk,
                statusCode: health.statusCode,
                contentType: health.contentType,
                latencyMs: health.latencyMs,
                error: health.error || undefined,
            },
            logs: [],
            error: health.error || "Health check failed: root route did not return valid HTML",
        };
        await upsertWebsiteState({
            projectId,
            subdomain: payload.subdomain,
            domain,
            port: currentPort,
            processName,
            status: "failed",
            health: "unhealthy",
            lastDeployAt: new Date().toISOString(),
            lastHealthCheckAt: new Date().toISOString(),
            lastDeployError: failResponse.error || null,
        });
        return failResponse;
    }
    stream?.stage("health-check", "success", `Root returns valid HTML (HTTP ${health.statusCode})`);
    await upsertWebsiteState({
        projectId,
        subdomain: payload.subdomain,
        domain,
        port: currentPort,
        processName,
        status: "running",
        health: "healthy",
        lastDeployAt: new Date().toISOString(),
        lastHealthCheckAt: new Date().toISOString(),
        lastDeployError: null,
    });
    stream?.stage("complete", "success", "Deployment complete");
    stream?.result({
        success: true,
        domain,
        url: `https://${domain}`,
        port: currentPort,
        processName,
        running: true,
        build: { ok: true },
        health,
    });
    return {
        success: true,
        deployment_mode: "next-server",
        project_id: projectId,
        domain,
        url: `https://${domain}`,
        port: currentPort,
        processName,
        build: { ok: true, logs: buildResult.logs },
        running: true,
        health: {
            ok: health.ok,
            htmlOk: health.htmlOk,
            statusCode: health.statusCode,
            contentType: health.contentType,
            latencyMs: health.latencyMs,
        },
        logs: [],
    };
}
