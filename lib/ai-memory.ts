// ──────────────────────────────────────────────────────
// AI Memory & File-Context System
// ──────────────────────────────────────────────────────
// Provides rich cross-file context so the AI can generate
// connected, type-safe, properly-importing code.
// ──────────────────────────────────────────────────────

// ─────────── Configuration Constants ───────────
// Tune these values to control memory/context behavior

/** Threshold for switching from full content to hybrid (full + summary) mode */
export const FULL_CONTENT_THRESHOLD = 10;

/** Threshold for enabling smart context selection (RAG-like behavior) */
export const SMART_CONTEXT_THRESHOLD = 12;

/** Number of most recent files to always include with full content */
export const RECENT_FILES_COUNT = 3;

/** Core files that are always included with full content in smart context mode */
export const CORE_FILES = ['src/types.ts', 'src/style.css', 'package.json'] as const;

// ─────────── Types & Interfaces ───────────

export interface GeneratedFile {
  name: string;
  code: string;
  /** Optional purpose tag to help the model understand intent. */
  usedFor?: string;
  /** Milliseconds since epoch when this file was last generated. */
  timestamp?: number;
}

export interface ContextOptions {
  /** Whether to use smart context selection based on current task */
  useSmartContext?: boolean;
  /** Current task/filename being generated (used for relevance scoring) */
  currentTask?: string;
}

// ─────────── Project Structure Constants ───────────

/** Canonical dependency-ordered structure the planner should follow. */
export const FILE_STRUCTURE = `
project/
├── index.html
├── src/
│   ├── main.tsx          (entry point - imports all components and routes pages)
│   ├── types.ts          (shared TypeScript interfaces & types)
│   ├── utils.ts          (shared helper functions)
│   ├── style.css         (design-system tokens & global styles)
│   └── components/
│       ├── header.tsx
│       ├── footer.tsx
│       ├── home-page.tsx
│       ├── about-page.tsx
│       ├── contact-page.tsx
│       └── ... (additional route-level page components)
├── public/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .gitignore
└── README.md
`;

/**
 * PREFERRED FILE GENERATION ORDER
 * The planner must generate files in this order so each file
 * can reference the exports of all previously generated files.
 */
export const GENERATION_ORDER = [
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
  'src/types.ts',
  'src/style.css',
  'src/utils.ts',
  // components in simple → complex order, including route-level pages
  'src/components/',
  'src/main.tsx',
  'index.html',
  '.gitignore',
  'README.md',
];

// ─────────── Instruction Parsing ───────────

/**
 * Parses the instruction string to extract completed tasks.
 * Used as fallback context when file content is not available.
 *
 * @deprecated Use `getFileContext` or `getSmartContext` instead for richer context.
 * This function is kept for backward compatibility with older prompt templates.
 */
export function getShortTermMemory(instruction: string): string {
  const completedTasks: { filename: string; description: string }[] = [];
  const taskRegex = /\[Done\]\s*([^\s:]+)\s*:\s*(?:\[usedfor\](.*?)\[usedfor\])?/g;
  let match;
  while ((match = taskRegex.exec(instruction)) !== null) {
    completedTasks.push({
      filename: match[1].trim(),
      description: match[2]?.trim() || 'No description provided',
    });
  }
  if (completedTasks.length === 0) return 'No files generated yet.';
  return `
ALREADY GENERATED FILES:
${completedTasks.map((t) => `- ${t.filename}: ${t.description}`).join('\n')}
`;
}

// ──────── Export Summary Extraction ────────

/**
 * Extracts a compact summary of public API surface from source code.
 * Returns exported interfaces, types, consts, functions and class signatures.
 */
export function extractExportSummary(code: string): string {
  const lines = code.split('\n');
  const exports: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // export interface / export type / export enum
    if (/^export\s+(interface|type|enum)\s+/.test(trimmed)) {
      exports.push(trimmed.replace(/\{.*$/, '{ ... }'));
    }
    // export const / export let / export var
    else if (/^export\s+(const|let|var)\s+/.test(trimmed)) {
      const sig = trimmed.replace(/=.*$/, '').replace(/;$/, '').trim();
      exports.push(sig);
    }
    // export function / export async function
    else if (/^export\s+(async\s+)?function\s+/.test(trimmed)) {
      const sig = trimmed.replace(/\{.*$/, '').trim();
      exports.push(sig);
    }
    // export class
    else if (/^export\s+(abstract\s+)?class\s+/.test(trimmed)) {
      exports.push(trimmed.replace(/\{.*$/, '{ ... }'));
    }
    // export default
    else if (/^export\s+default\s+/.test(trimmed)) {
      exports.push(trimmed.replace(/\{.*$/, '').replace(/;$/, '').trim());
    }
    // CSS custom properties (--var: value)
    else if (/^\s*--[\w-]+\s*:/.test(trimmed)) {
      exports.push(trimmed);
    }
  }

  return exports.length > 0
    ? exports.join('\n')
    : '// No public exports detected';
}

// ──────── File Block Formatters ────────

/**
 * Formats a file with its full content for context.
 */
function formatFullFileBlock(file: GeneratedFile, includeLangHint = false): string {
  const langHint = includeLangHint ? file.name.split('.').pop() || '' : '';
  const purpose = file.usedFor ? ` | Purpose: ${file.usedFor}` : '';
  const updated = file.timestamp ? ` | Updated: ${new Date(file.timestamp).toISOString()}` : '';
  return `
--- FILE: ${file.name} (FULL${purpose}${updated}) ---
\`\`\`${langHint}
${file.code}
\`\`\`
`;
}

/**
 * Formats a file with only its export summary for context.
 */
function formatSummaryFileBlock(file: GeneratedFile): string {
  const meta: string[] = [];
  if (file.usedFor) meta.push(`Purpose: ${file.usedFor}`);
  if (file.timestamp) meta.push(`Updated: ${new Date(file.timestamp).toISOString()}`);
  return `
--- FILE: ${file.name} (EXPORTS ONLY) ---
${meta.length ? meta.join(' | ') + '\n' : ''}
${extractExportSummary(file.code)}
`;
}

/**
 * Standard context footer with import/reuse instructions.
 */
const CONTEXT_FOOTER = `
IMPORTANT:
- You MUST import from these files using the exact export names shown above.
- You MUST NOT redefine types, interfaces, or constants that are already exported.
- You MUST use the same CSS class names and design tokens already established.
`;

// ──────── Design System Extraction ────────

/**
 * Finds CSS custom properties and key Tailwind/utility patterns
 * from a style.css file to pass as design-system context.
 */
export function extractDesignSystem(files: GeneratedFile[]): string {
  const styleFile = files.find(
    (f) => f.name.endsWith('style.css') || f.name.endsWith('globals.css')
  );
  if (!styleFile) return '';

  const vars: string[] = [];
  const lines = styleFile.code.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^--[\w-]+\s*:/.test(trimmed)) {
      vars.push(trimmed);
    }
    // @font-face declarations
    if (/font-family\s*:/.test(trimmed)) {
      vars.push(trimmed);
    }
  }

  if (vars.length === 0) return '';

  return `
DESIGN SYSTEM (from style.css):
\`\`\`css
${vars.join('\n')}
\`\`\`
You MUST reuse these exact tokens for colors, fonts, and spacing.
Do NOT invent new values -- reference these CSS custom properties.
`;
}

// ──────── Full File Context Builder ────────

/**
 * Builds a rich context block from all previously generated files.
 *
 * Strategy:
 * - < FULL_CONTENT_THRESHOLD files  --> full source code of EVERY file
 * - >= FULL_CONTENT_THRESHOLD files --> full code of recent files + export summary of the rest
 *
 * This gives the AI model enough context to generate properly
 * importing, type-safe, design-consistent code.
 */
export function getFileContext(files: GeneratedFile[]): string {
  if (!files || files.length === 0) {
    return 'No files generated yet. You are generating the first file.';
  }

  const ordered = [...files].sort((a, b) => {
    const aTime = a.timestamp ?? 0;
    const bTime = b.timestamp ?? 0;
    if (aTime === bTime) return a.name.localeCompare(b.name);
    return aTime - bTime;
  });

  const useFullForAll = ordered.length < FULL_CONTENT_THRESHOLD;

  if (useFullForAll) {
    const blocks = ordered.map((f) => formatFullFileBlock(f, true));
    return `
PREVIOUSLY GENERATED FILES (${ordered.length} files -- FULL CONTENT):
${blocks.join('\n')}
${CONTEXT_FOOTER}`;
  }

  // Hybrid: full content for recent files, summary for the rest
  const recentFiles = ordered.slice(-RECENT_FILES_COUNT);
  const olderFiles = ordered.slice(0, -RECENT_FILES_COUNT);

  const summaryBlocks = olderFiles.map((f) => formatSummaryFileBlock(f));
  const fullBlocks = recentFiles.map((f) => formatFullFileBlock(f, true));

  return `
PREVIOUSLY GENERATED FILES (${files.length} total):

== EXPORT SUMMARIES (${olderFiles.length} older files) ==
${summaryBlocks.join('\n')}

== FULL CONTENT (${recentFiles.length} most recent) ==
${fullBlocks.join('\n')}
${CONTEXT_FOOTER}`;
}

// ──────── Smart Context (RAG-like) ────────

/**
 * Determines if a file should be included with full content based on the current task.
 * This provides task-aware relevance scoring for context selection.
 */
function isRelevantForTask(fileName: string, currentTask: string): boolean {
  const taskLower = currentTask.toLowerCase();
  const nameLower = fileName.toLowerCase();

  // When building components, include utils
  if (taskLower.includes('components/') && nameLower.endsWith('utils.ts')) {
    return true;
  }

  // When building main.ts, all components are relevant
  if (taskLower.includes('main.ts') && nameLower.includes('components/')) {
    return true;
  }

  return false;
}

/**
 * Intelligent context builder that selects the most relevant files based on the current task.
 * This acts as a semantic memory to ensure the AI has the right context.
 *
 * Strategy:
 * - < SMART_CONTEXT_THRESHOLD files --> delegate to getFileContext (full/hybrid)
 * - >= SMART_CONTEXT_THRESHOLD files --> smart selection:
 *   1. Core files (types, styles, package.json) always included fully
 *   2. Task-relevant files included fully
 *   3. Most recent files included fully (recency bias)
 *   4. Everything else gets export summaries only
 */
export function getSmartContext(files: GeneratedFile[], currentTask: string): string {
  if (!files || files.length === 0) {
    return 'No files generated yet. You are generating the first file.';
  }

  const ordered = [...files].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

  // For smaller projects, use standard file context
  if (ordered.length < SMART_CONTEXT_THRESHOLD) {
    return getFileContext(ordered);
  }

  const fullContentFiles: GeneratedFile[] = [];
  const summaryFiles: GeneratedFile[] = [];

  // Helper to add file to full content list (avoiding duplicates)
  const addToFull = (file: GeneratedFile): void => {
    if (!fullContentFiles.some((f) => f.name === file.name)) {
      fullContentFiles.push(file);
    }
  };

  // Categorize files
  for (const file of ordered) {
    const isCoreFile = CORE_FILES.some((core) => file.name.endsWith(core));
    const isTaskRelevant = isRelevantForTask(file.name, currentTask);

    if (isCoreFile || isTaskRelevant) {
      addToFull(file);
    } else {
      summaryFiles.push(file);
    }
  }

  // Apply recency bias: ensure most recent files are always in full content
  const recentFiles = ordered.slice(0, RECENT_FILES_COUNT);
  for (const recentFile of recentFiles) {
    const summaryIndex = summaryFiles.findIndex((f) => f.name === recentFile.name);
    if (summaryIndex !== -1) {
      summaryFiles.splice(summaryIndex, 1);
      addToFull(recentFile);
    } else if (!fullContentFiles.some((f) => f.name === recentFile.name)) {
      addToFull(recentFile);
    }
  }

  // Build formatted output
  const fullBlocks = fullContentFiles.map((f) => formatFullFileBlock(f, true));
  const summaryBlocks = summaryFiles.map((f) => formatSummaryFileBlock(f));

  return `
PREVIOUSLY GENERATED FILES (${files.length} total):

== KEY CONTEXT FILES & RECENT (${fullContentFiles.length} files) ==
${fullBlocks.join('\n')}

== OTHER FILES (Summaries - ${summaryFiles.length} files) ==
${summaryBlocks.join('\n')}

IMPORTANT:
- Use the exports shown in summaries.
- Reuse types and styles from key context files.
- You have the full content of the most relevant files above.
`;
}
