import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

type ManagedAgent = {
  projectId: string;
  port: number;
  baseUrl: string;
  process: ChildProcess;
  startedAt: number;
};

const agents = new Map<string, ManagedAgent>();

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Failed to allocate port'));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

function buildServeArgs(port: number, sessionId: string): string[] {
  const args = [
    'serve',
    '--port',
    String(port),
    '--timeout',
    process.env.CONTINUE_AGENT_TIMEOUT || '3600',
    '--id',
    sessionId,
    '--allow',
    'Write',
    '--allow',
    'Edit',
    '--allow',
    'Bash',
    '--allow',
    'Read',
  ];

  const config = process.env.CONTINUE_CONFIG || path.join(process.cwd(), 'glovix', 'continue.config.yaml');
  args.push('--config', config);
  return args;
}

async function waitForHealthy(baseUrl: string, attempts = 40): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${baseUrl}/state`, { cache: 'no-store' });
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Continue agent failed to become healthy');
}

export async function ensureLocalContinueAgent(projectId: string, cwd?: string): Promise<string> {
  const existing = agents.get(projectId);
  if (existing?.process.exitCode == null) {
    return existing.baseUrl;
  }

  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    CONTINUE_API_KEY: process.env.CONTINUE_API_KEY || '',
  };

  const child = spawn('npx', ['-y', '@continuedev/cli@latest', ...buildServeArgs(port, projectId)], {
    cwd: cwd || process.cwd(),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  child.stdout?.on('data', (chunk) => {
    console.log(`[ContinueAgent:${projectId}]`, String(chunk).trim());
  });
  child.stderr?.on('data', (chunk) => {
    console.warn(`[ContinueAgent:${projectId}]`, String(chunk).trim());
  });
  child.on('exit', (code) => {
    console.log(`[ContinueAgent:${projectId}] exited with code ${code}`);
    agents.delete(projectId);
  });

  agents.set(projectId, {
    projectId,
    port,
    baseUrl,
    process: child,
    startedAt: Date.now(),
  });

  await waitForHealthy(baseUrl);
  return baseUrl;
}

export function getConfiguredAgentUrl(): string | null {
  const url = process.env.CONTINUE_AGENT_URL?.trim();
  return url || null;
}
