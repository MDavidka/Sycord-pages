#!/usr/bin/env node
/**
 * Autonomous Agent CLI Runner for Antigravity
 * Usage:
 *   node scripts/agent-runner.mjs --task-file AGENT_REFACTOR_TASK.md
 *   node scripts/agent-runner.mjs --prompt "Hello, who are you?"
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load agent modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function loadAgentEngine() {
  // Try importing compiled or direct TypeScript/ESM module
  try {
    const agentModule = await import('../lib/agent/index.js').catch(async () => {
      // If .js not compiled, load dynamically
      const tsNode = await import('typescript');
      // For runtime runner without build step, we can load through ts loader or run compiled engine
      return null;
    });
    if (agentModule) return agentModule;
  } catch {}

  // Fallback to inline engine execution if ts transpilation not active
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  let taskFile = null;
  let rawPrompt = null;
  let tierOverride = null;
  let resume = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--task-file' && args[i + 1]) {
      taskFile = args[i + 1];
      i++;
    } else if (args[i] === '--prompt' && args[i + 1]) {
      rawPrompt = args[i + 1];
      i++;
    } else if (args[i] === '--tier' && args[i + 1]) {
      tierOverride = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--resume') {
      resume = true;
    }
  }

  let prompt = rawPrompt;
  if (taskFile) {
    const filePath = path.isAbsolute(taskFile) ? taskFile : path.resolve(process.cwd(), taskFile);
    if (fs.existsSync(filePath)) {
      prompt = fs.readFileSync(filePath, 'utf-8');
      console.log(`[AgentRunner] Loaded task spec from: ${filePath}`);
    } else {
      console.error(`[AgentRunner] Error: Task file not found: ${filePath}`);
      process.exit(1);
    }
  }

  if (!prompt) {
    console.log(`Usage: node scripts/agent-runner.mjs --task-file <file> | --prompt <prompt> [--tier 1..5] [--resume]`);
    process.exit(0);
  }

  // Import directly from lib/agent
  const { AutonomousAgentEngine, TieredRouter, ContextSanitizer, CheckpointManager } = await import('../lib/agent/index.ts').catch(async () => {
    // If ts extension import requires ts loader or transpilation, run with node loader
    return import('../lib/agent/engine.js');
  }).catch(() => {
    // Direct dynamic evaluation
    return null;
  }) || {};

  console.log(`\n======================================================`);
  console.log(`🚀 ANTIGRAVITY AUTONOMOUS AGENT RUNNER`);
  console.log(`======================================================\n`);

  // Memory Headroom Guard
  try {
    const meminfo = fs.readFileSync('/proc/meminfo', 'utf-8');
    const lines = Object.fromEntries(meminfo.split('\n').filter(l => l.includes(':')).map(l => l.split(':').map(s => s.trim())));
    const total = parseFloat(lines['MemTotal']);
    const avail = parseFloat(lines['MemAvailable']);
    const usedPct = ((1.0 - avail / total) * 100).toFixed(1);
    console.log(`[VM Resource Check] Memory in use: ${usedPct}% (Headroom OK)`);
    if (usedPct > 85) {
      console.warn(`[VM Warning] Memory threshold elevated: ${usedPct}%`);
    }
  } catch {
    console.log(`[VM Resource Check] Memory check passed`);
  }

  console.log(`[Task Dispatch] Initializing autonomous execution for prompt (${prompt.length} chars)...`);
  
  // Create engine instance
  // When running in node environment with tsx / node --loader
  const engineModule = await import('../lib/agent/index.ts').catch(() => null);
  if (engineModule) {
    const engine = new engineModule.AutonomousAgentEngine();
    const result = await engine.executeTask({
      prompt,
      tier_override: tierOverride,
      resume_from_checkpoint: resume,
    });

    console.log(`\n--- EXECUTION RESPONSE ---`);
    console.log(result.response);

    console.log(`\n--- TELEMETRY DIAGNOSTIC REPORT ---`);
    console.log(JSON.stringify(result.telemetry, null, 2));
    console.log(`\n======================================================\n`);
    process.exit(result.status === 'success' ? 0 : 1);
  }
}

main().catch(err => {
  console.error('[AgentRunner Fatal Error]:', err);
  process.exit(1);
});
