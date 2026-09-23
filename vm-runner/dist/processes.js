import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { config } from "./config.js";
export async function runCommand(command, args, options = {}) {
    const child = spawn(command, args, {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    const forward = (stream, chunk) => {
        const text = chunk.toString("utf8");
        const lines = text.split(/\r?\n/).filter(Boolean);
        for (const line of lines) {
            if (stream === "stdout")
                stdout.push(line);
            else
                stderr.push(line);
            options.onLine?.(line, stream);
        }
    };
    child.stdout?.on("data", (chunk) => forward("stdout", chunk));
    child.stderr?.on("data", (chunk) => forward("stderr", chunk));
    const [code] = (await once(child, "close"));
    return { code, stdout, stderr };
}
async function loadEnvFile(envFile) {
    const env = {};
    try {
        const content = await readFile(envFile, "utf8");
        const lines = content.split("\n").filter(Boolean);
        for (const line of lines) {
            const eq = line.indexOf("=");
            if (eq <= 0)
                continue;
            const key = line.slice(0, eq).trim();
            let value = line.slice(eq + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            env[key] = value;
        }
    }
    catch {
        // env file may not exist yet; that's fine
    }
    return env;
}
export async function pm2Describe(processName) {
    try {
        const { stdout } = await execFileAsync(config.pm2Binary, ["jlist"]);
        const json = JSON.parse(stdout || "[]");
        return json.find((entry) => entry.name === processName) || null;
    }
    catch (error) {
        return null;
    }
}
export async function startOrRestartProcess(projectId, processName, port, cwd, envFile) {
    const envFileVars = await loadEnvFile(envFile);
    const existing = await pm2Describe(processName);
    const env = {
        PORT: String(port),
        HOSTNAME: "0.0.0.0",
        ENV_FILE: envFile,
        ...envFileVars,
        NODE_ENV: envFileVars.NODE_ENV === "development" || envFileVars.NODE_ENV === "test" ? envFileVars.NODE_ENV : "production",
    };
    if (existing) {
        return runCommand(config.pm2Binary, ["restart", processName, "--update-env"], { cwd, env });
    }
    return runCommand(config.pm2Binary, ["start", "npm", "--name", processName, "--cwd", cwd, "--", "run", "start"], { cwd, env });
}
export async function stopProcess(processName) {
    return runCommand(config.pm2Binary, ["stop", processName]);
}
export async function deleteProcess(processName) {
    return runCommand(config.pm2Binary, ["delete", processName]);
}
