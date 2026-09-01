import { promises as fs } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { config } from "./config.js";
import { appendLog, ensureBaseDirectories, resetProjectLogs } from "./logs.js";
import { getEnvFilePath, getProcessName, getProjectRoot, getProxyConfigPath, validateDeployPath, validateProjectId, validateSubdomain } from "./paths.js";
import { runHealthCheck, runPublicHealthCheck } from "./health.js";
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
    const startedAt = new Date().toISOString();
    validateProjectId(projectId);
    validateSubdomain(payload.subdomain);
    if (payload.deployment_mode !== "next-server") {
        throw new Error('deployment_mode must be "next-server"');
    }
    const debug = {
        startedAt,
        completedAt: "",
        durationMs: 0,
        cwd: "",
        envFile: "",
        portAllocation: { phase: "fresh", attempts: 0, blockedBy: [] },
        pm2Start: { attempts: 0, exitCodes: [], eaddrRetries: 0 },
        nginx: { configPath: "", serverName: "", proxyPort: 0, nginxPort: config.nginxPort, reloaded: false },
        healthChecks: {
            local: { url: "", ok: false, htmlOk: false, statusCode: 0, contentType: "", latencyMs: 0 },
            public: { urls: [], ok: false, htmlOk: false, statusCode: 0, contentType: "", latencyMs: 0 },
        },
        fileCount: payload.files.length,
        envVarCount: Object.keys(payload.env_vars || {}).length,
    };
    let nodeVersion = "";
    let npmVersion = "";
    try {
        nodeVersion = execFileSync("node", ["--version"], { encoding: "utf8" }).trim();
    }
    catch { }
    try {
        npmVersion = execFileSync("npm", ["--version"], { encoding: "utf8" }).trim();
    }
    catch { }
    debug.nodeVersion = nodeVersion;
    debug.npmVersion = npmVersion;
    await ensureBaseDirectories();
    await resetProjectLogs(projectId);
    stream?.stage("queued", "pending", "Deployment queued");
    stream?.stage("preparing-files", "running", "Preparing project directory");
    await appendLog(projectId, "deploy", `Preparing deployment for ${projectId}`);
    const cwd = await writeFiles(projectId, payload.files);
    debug.cwd = cwd;
    stream?.stage("preparing-files", "success", `Wrote ${payload.files.length} files`);
    stream?.log("runner", `Writing ${payload.files.length} files`);
    const envFile = await writeEnvFile(projectId, payload.env_vars);
    debug.envFile = envFile;
    const buildResult = await runBuildStep(projectId, cwd, stream);
    stream?.stage("allocating-port", "running", "Allocating port for website");
    const previous = await getWebsiteState(projectId);
    let port;
    if (previous?.port) {
        port = previous.port;
        debug.portAllocation.phase = "reused";
    }
    else {
        port = await allocatePort(projectId);
    }
    debug.portAllocation.attempts = 1;
    const processName = getProcessName(projectId);
    stream?.log("runner", `Allocated port ${port}`);
    stream?.stage("allocating-port", "success", `Port ${port} allocated`);
    stream?.stage("starting-server", "running", "Starting Next.js server");
    let startCode = 0;
    let runtimeOut = [];
    let runtimeErr = [];
    let currentPort = port;
    for (let attempt = 0; attempt < MAX_START_RETRIES; attempt += 1) {
        debug.pm2Start.attempts = attempt + 1;
        const result = await startOrRestartProcess(projectId, processName, currentPort, cwd, envFile);
        startCode = result.code;
        debug.pm2Start.exitCodes.push(result.code);
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
            debug.pm2Start.eaddrRetries += 1;
            if (!debug.portAllocation.blockedBy)
                debug.portAllocation.blockedBy = [];
            debug.portAllocation.blockedBy.push(currentPort);
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
    debug.nginx.serverName = domain;
    debug.nginx.proxyPort = currentPort;
    debug.nginx.configPath = getProxyConfigPath(projectId);
    stream?.stage("configuring-proxy", "running", "Configuring nginx reverse proxy");
    await writeProxyConfig(projectId, domain, currentPort);
    try {
        await reloadProxy();
        debug.nginx.reloaded = true;
    }
    catch (err) {
        debug.nginx.reloaded = false;
        debug.nginx.reloadError = err?.message;
    }
    stream?.stage("configuring-proxy", "success", "Proxy configured");
    stream?.stage("health-check", "running", "Checking local Next.js HTML response");
    const health = await runHealthCheck(projectId, currentPort);
    debug.healthChecks.local = {
        url: `http://127.0.0.1:${currentPort}/`,
        ok: health.ok,
        htmlOk: health.htmlOk,
        statusCode: health.statusCode,
        contentType: health.contentType,
        latencyMs: health.latencyMs,
        error: health.error,
    };
    const baseResponse = (success, error) => {
        debug.completedAt = new Date().toISOString();
        debug.durationMs = new Date(debug.completedAt).getTime() - new Date(debug.startedAt).getTime();
        return {
            success,
            deployment_mode: "next-server",
            project_id: projectId,
            domain,
            port: currentPort,
            processName,
            build: success ? { ok: true, logs: buildResult.logs } : { ok: true, logs: buildResult.logs },
            running: success,
            health: success ? {
                ok: debug.healthChecks.public.ok,
                htmlOk: debug.healthChecks.public.htmlOk,
                statusCode: debug.healthChecks.public.statusCode,
                contentType: debug.healthChecks.public.contentType,
                latencyMs: debug.healthChecks.public.latencyMs,
                url: debug.healthChecks.public.urls[0] || `https://${domain}`,
                protocol: debug.healthChecks.public.error ? undefined : debug.healthChecks.public.urls[0]?.startsWith("http://") ? "http" : "https",
            } : { ok: false, htmlOk: false },
            localHealth: health,
            publicHealth: success ? undefined : undefined,
            logs: [],
            error,
            debug,
        };
    };
    if (!health.ok || !health.htmlOk) {
        const errMsg = health.error || "Root route did not return valid HTML";
        stream?.stage("health-check", "error", errMsg);
        stream?.error({ error: errMsg, stage: "health-check", logs: [health.detail || ""] });
        await upsertWebsiteState({
            projectId, subdomain: payload.subdomain, domain,
            port: currentPort, processName,
            status: "failed", health: "unhealthy",
            lastDeployAt: new Date().toISOString(),
            lastHealthCheckAt: new Date().toISOString(),
            lastDeployError: errMsg,
        });
        return baseResponse(false, errMsg);
    }
    stream?.stage("health-check", "success", `Local root returns valid HTML (HTTP ${health.statusCode})`);
    stream?.stage("health-check", "running", `Checking public subdomain ${domain}`);
    const publicHealth = await runPublicHealthCheck(projectId, domain);
    const publicUrl = publicHealth.url || `https://${domain}`;
    debug.healthChecks.public = {
        urls: [`https://${domain}/`, `http://${domain}/`],
        ok: publicHealth.ok,
        htmlOk: publicHealth.htmlOk,
        statusCode: publicHealth.statusCode,
        contentType: publicHealth.contentType,
        latencyMs: publicHealth.latencyMs,
        error: publicHealth.error,
        protocol: publicHealth.protocol,
    };
    const insecurePublicUrlWarning = publicHealth.ok && publicHealth.protocol === "http"
        ? "Public subdomain only passed over HTTP. Configure Cloudflare/TLS before advertising it as HTTPS."
        : undefined;
    if (!publicHealth.ok || !publicHealth.htmlOk) {
        const errMsg = publicHealth.error || "Public subdomain did not return valid HTML";
        stream?.stage("health-check", "error", errMsg);
        stream?.error({ error: errMsg, stage: "public-health-check", logs: [publicHealth.detail || ""], localHealth: health, publicHealth });
        await upsertWebsiteState({
            projectId, subdomain: payload.subdomain, domain,
            port: currentPort, processName,
            status: "failed", health: "unhealthy",
            lastDeployAt: new Date().toISOString(),
            lastHealthCheckAt: new Date().toISOString(),
            lastDeployError: `${errMsg}${publicHealth.detail ? `: ${publicHealth.detail}` : ""}`,
        });
        return { ...baseResponse(false, errMsg), running: true, health: { ok: publicHealth.ok, htmlOk: publicHealth.htmlOk, statusCode: publicHealth.statusCode, contentType: publicHealth.contentType, latencyMs: publicHealth.latencyMs, error: errMsg, detail: publicHealth.detail, url: publicUrl, protocol: publicHealth.protocol }, publicHealth };
    }
    stream?.stage("health-check", "success", `Public subdomain returns valid HTML (${publicHealth.protocol?.toUpperCase() || "HTTPS"})`);
    await upsertWebsiteState({
        projectId, subdomain: payload.subdomain, domain,
        port: currentPort, processName,
        status: "running", health: "healthy",
        lastDeployAt: new Date().toISOString(),
        lastHealthCheckAt: new Date().toISOString(),
        lastDeployError: null,
    });
    const result = baseResponse(true);
    result.url = publicUrl;
    result.publicHealth = publicHealth;
    result.warning = insecurePublicUrlWarning;
    result.health = {
        ok: publicHealth.ok,
        htmlOk: publicHealth.htmlOk,
        statusCode: publicHealth.statusCode,
        contentType: publicHealth.contentType,
        latencyMs: publicHealth.latencyMs,
        url: publicUrl,
        protocol: publicHealth.protocol,
    };
    stream?.stage("complete", "success", insecurePublicUrlWarning || "Deployment complete");
    stream?.result({ success: true, domain, url: publicUrl, port: currentPort, processName, running: true, build: { ok: true }, health: publicHealth, localHealth: health, publicHealth, warning: insecurePublicUrlWarning });
    return result;
}
