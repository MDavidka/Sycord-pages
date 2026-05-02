import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { getProjectPaths } from './paths';

const execAsync = util.promisify(exec);

export interface DeployPayload {
  files: Array<{ path: string; content: string }>;
  subdomain: string;
  deployment_mode: string;
  env_vars?: Record<string, string>;
}

export const validateFiles = (files: Array<{ path: string; content: string }>): string[] => {
  const errors: string[] = [];
  for (const file of files) {
    if (file.path.startsWith('/') || file.path.includes('..')) {
      errors.push(`Invalid path detected: ${file.path}`);
    }
    if (file.path === '.env' || file.path.startsWith('.env.')) {
      errors.push(`.env files are not allowed in source: ${file.path}`);
    }
    // Simple secret file heuristic
    if (file.path.includes('secret') && file.path.endsWith('.json')) {
      // Might be allowed, but we generally want to avoid it. Let's just block .env for now.
    }
  }
  return errors;
};

export const writeSourceFiles = async (currentDir: string, files: Array<{ path: string; content: string }>) => {
  await fs.rm(currentDir, { recursive: true, force: true });
  await fs.mkdir(currentDir, { recursive: true });

  for (const file of files) {
    const fullPath = path.join(currentDir, file.path);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, file.content, 'utf8');
  }
};

export const writeEnvFile = async (envFilePath: string, envVars?: Record<string, string>) => {
  await fs.mkdir(path.dirname(envFilePath), { recursive: true });

  if (!envVars || Object.keys(envVars).length === 0) {
    await fs.writeFile(envFilePath, '', 'utf8');
    return;
  }

  const envContent = Object.entries(envVars)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  await fs.writeFile(envFilePath, envContent, 'utf8');
};

export const buildProject = async (currentDir: string, buildLogPath: string) => {
  try {
    // Inject build command overrides if needed
    const pkgJsonPath = path.join(currentDir, 'package.json');
    try {
      const pkgRaw = await fs.readFile(pkgJsonPath, 'utf8');
      const pkg = JSON.parse(pkgRaw);
      let modified = false;

      // Strip strict checks from AI generated Next.js
      if (pkg.scripts && pkg.scripts.build) {
        if (!pkg.scripts.build.includes('--no-lint')) {
          // Simplistic replace for common things, actual Next.js build handles ignoring via next.config.js typically
        }
      }
      // Ensure no-fund, no-audit, legacy-peer-deps via npmrc or command line
    } catch (e) {
       // Ignore if package.json doesn't exist or is invalid
    }

    const command = 'npm install --no-fund --no-audit --legacy-peer-deps && npm run build';
    const { stdout, stderr } = await execAsync(command, { cwd: currentDir });

    // We append the logs, but first redact env values if they somehow get printed
    let safeStdout = stdout;
    let safeStderr = stderr;

    // Attempt to load env to know what to redact
    let envVars: Record<string, string> = {};
    try {
      const envPath = path.join(path.dirname(currentDir), '..', '..', 'env', path.basename(path.dirname(currentDir)) + '.env');
      const envRaw = await fs.readFile(envPath, 'utf8');
      envRaw.split('\n').forEach(line => {
        const [k, v] = line.split('=');
        if (k && v && v.trim().length > 3) {
           envVars[k] = v.trim();
        }
      });
    } catch(e) {}

    for (const val of Object.values(envVars)) {
        safeStdout = safeStdout.split(val).join('***REDACTED***');
        safeStderr = safeStderr.split(val).join('***REDACTED***');
    }

    await fs.mkdir(path.dirname(buildLogPath), { recursive: true });
    await fs.writeFile(buildLogPath, `[BUILD START]
${safeStdout}
[BUILD STDERR]
${safeStderr}
[BUILD END]
`);

    return { ok: true, command, logs: stdout.split('\n').concat(stderr.split('\n')), error: undefined };
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    const logs = error.stdout ? error.stdout.split('\n') : [];
    if (error.stderr) logs.push(...error.stderr.split('\n'));

    await fs.mkdir(path.dirname(buildLogPath), { recursive: true });
    await fs.writeFile(buildLogPath, `[BUILD ERROR]\n${errorMsg}\n[STDOUT]\n${error.stdout}\n[STDERR]\n${error.stderr}\n`);

    return { ok: false, command: 'npm install && npm run build', logs, error: errorMsg };
  }
};
