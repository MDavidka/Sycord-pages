import { executeCommand, writeFile, readFile, renameFile, deleteFile, autoInstallDependencies, smartInstall } from './webcontainer';
import { useStore } from '../store';
import { parseToolArguments } from './utils';

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
            description: 'Search for a text pattern across all project files. Returns matching lines with file paths and line numbers. Use this to find where something is defined or used.',
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
            name: 'runCommand',
            description: 'Run a shell command in the terminal. Use pnpm instead of npm for faster installs.',
            parameters: {
                type: 'object',
                properties: {
                    command: { type: 'string', description: 'The command to run, e.g., pnpm install' },
                },
                required: ['command'],
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
                    path: { type: 'string', description: 'Optional: specific file or directory to lint. Defaults to src/' },
                },
                required: [],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'searchWeb',
            description: 'Search the web for information, documentation, or images. Returns summaries, source links, and related images.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'The search query.' },
                    includeDomains: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Optional: Limit search to specific domains (e.g., ["github.com", "stackoverflow.com"])'
                    },
                },
                required: ['query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'inspectNetwork',
            description: 'Debug network requests by fetching a URL and returning headers/status. Use this to check if local server endpoints are responsive.',
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'The URL to inspect (e.g., http://localhost:5173)' },
                    method: { type: 'string', description: 'HTTP method (GET, POST, etc.)', default: 'GET' },
                },
                required: ['url'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'checkDependencies',
            description: 'Check package.json for outdated or conflicting dependencies using npm outdated.',
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
            name: 'extractPage',
            description: 'Extract the full content of a specific webpage as markdown. Use this to read documentation pages, articles, or any URL.',
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'The URL to extract content from' },
                },
                required: ['url'],
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

        await writeFile(path, content);
        const state = useStore.getState();
        state.setFiles({
            ...state.files,
            [path]: { file: { contents: content } }
        });
        // Clear errors for this file — it was just rewritten
        state.removeErrorsForFile(path);
        return `[SYSTEM] File created: ${path} (${content.split('\n').length} lines)`;
    } catch (e: any) {
        return `Error creating file ${path}: ${e.message}`;
    }
}

export async function handleEditFile(
    args: { path: string; oldContent: string; newContent: string }
): Promise<string> {
    const { path, oldContent, newContent } = args;

    try {
        const currentContent = await readFile(path);

        // Exact match first
        if (currentContent.includes(oldContent)) {
            const matches = currentContent.split(oldContent).length - 1;
            if (matches > 1) {
                return `Error editing ${path}: Found ${matches} matches for oldContent. Include more surrounding lines to make it unique.\n\nHint: Add 2-3 extra lines before and after the section you want to change.`;
            }

            const newFileContent = currentContent.replace(oldContent, newContent);
            await writeFile(path, newFileContent);
            const state = useStore.getState();
            state.setFiles({
                ...state.files,
                [path]: { file: { contents: newFileContent } }
            });
            state.removeErrorsForFile(path);
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
                await writeFile(path, newFileContent);
                const state = useStore.getState();
                state.setFiles({
                    ...state.files,
                    [path]: { file: { contents: newFileContent } }
                });
                state.removeErrorsForFile(path);
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
        const content = await readFile(path);
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

    for (const path of paths) {
        try {
            const content = await readFile(path);
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
        await deleteFile(path);
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
        await renameFile(oldPath, newPath);
        const state = useStore.getState();
        const newFiles = { ...state.files };
        if (newFiles[oldPath]) {
            newFiles[newPath] = newFiles[oldPath];
            delete newFiles[oldPath];
            state.setFiles(newFiles);
        }
        return `[SYSTEM] Renamed: ${oldPath} → ${newPath}`;
    } catch (e: any) {
        return `Error renaming ${oldPath}: ${e.message}`;
    }
}

export function handleListFiles(): string {
    try {
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


export async function handleRunCommand(
    args: { command: string },
    ctx: ToolContext
): Promise<string> {
    const { command } = args;

    if (!command || typeof command !== 'string' || command.trim().length === 0) {
        return 'Error: Empty or invalid command.';
    }

    // Sanitize dangerous commands
    const dangerous = ['rm -rf /', 'rm -rf ~', 'mkfs', 'dd if=', ':(){', 'fork bomb'];
    if (dangerous.some(d => command.includes(d))) {
        return `Error: Dangerous command blocked: "${command}"`;
    }

    // Block background process operators — WebContainer shell doesn't support them
    if (command.includes(' & ') || command.includes(' && ') || command.endsWith(' &')) {
        return `[SYSTEM] ❌ BLOCKED: Cannot use "&" or "&&" operators. WebContainer does not support background processes or command chaining.\n\nRun each command separately using runCommand. For example:\n- First: runCommand("pnpm install")\n- Then: runCommand("pnpm run dev")`;
    }

    // Block backend server commands — they don't work in WebContainer
    const backendPatterns = [
        /^node\s+(server|app|index|backend|api)\.(js|ts|mjs)/i,
        /^nodemon\s/i,
        /^ts-node\s/i,
        /^pm2\s/i,
        /^python\s/i,
        /^ruby\s/i,
        /^java\s/i,
        /^go\s+run/i,
        /^docker\s/i,
        /^docker-compose\s/i,
    ];
    if (backendPatterns.some(p => p.test(command.trim()))) {
        return `[SYSTEM] ❌ BLOCKED: "${command}" cannot run in WebContainer.\n\nWebContainer is a browser-based runtime — it does NOT support backend servers, databases, or non-Node.js languages.\n\nAll apps must be client-side only (SPA). Use:\n- "pnpm run dev" to start Vite dev server\n- localStorage/IndexedDB for data persistence\n- External APIs via fetch() for real data`;
    }

    try {
        const parts = command.match(/(?:[^\s"]+|"[^"]*")+/g) || [command];
        const cmd = parts[0].replace(/"/g, '');
        const cmdArgs = parts.slice(1).map(a => a.replace(/"/g, ''));

        // Special handling for long-running commands like 'npm/pnpm run dev'
        const isDevServer = (cmd === 'npm' || cmd === 'pnpm') && (
            (cmdArgs.includes('run') && cmdArgs.includes('dev')) ||
            cmdArgs.join(' ').includes('run dev') ||
            cmdArgs.join(' ').includes('start')
        );

        // Warn about backend packages that won't work in WebContainer
        if ((cmd === 'npm' || cmd === 'pnpm') && cmdArgs.includes('install')) {
            // Pure server-side packages that cannot work in WebContainer
            const backendPkgs = ['express', 'fastify', 'koa', 'hapi', 'nest', '@nestjs/core', 'pg', 'mysql', 'mysql2', 'mongoose', 'mongodb', 'prisma', '@prisma/client', 'sequelize', 'typeorm', 'redis', 'ioredis', 'socket.io', 'ws', 'sharp', 'bcrypt', 'morgan', 'body-parser', 'cookie-parser', 'express-session'];
            // BaaS client SDKs that DO work (HTTP-based, no server needed):
            // @supabase/supabase-js, firebase, @neondatabase/serverless,
            // @firebase/*, bcryptjs, jsonwebtoken, passport, cors, helmet
            const installingPkgs = cmdArgs.filter(a => !a.startsWith('-'));
            const foundBackend = installingPkgs.filter(pkg => backendPkgs.some(bp => pkg.includes(bp)));
            if (foundBackend.length > 0) {
                return `[SYSTEM] ⚠️ WARNING: You are trying to install backend packages: ${foundBackend.join(', ')}\n\nThese will NOT work in WebContainer because there is no real server, no database, and no network sockets.\n\nWebContainer only supports client-side (browser) code. Use BaaS instead:\n- Supabase (@supabase/supabase-js) — auth, database, storage\n- Firebase (firebase) — auth, Firestore, storage\n- Neon (@neondatabase/serverless) — Postgres over HTTP\n- Appwrite (appwrite) — auth, database, storage\n\nIf you still need these packages for client-side use, re-run the command.`;
            }
        }

        // Echo the command to terminal so user sees what's running
        ctx.addTerminalOutput(`\r\n\x1b[38;5;243m$ ${command}\x1b[0m\r\n`);

        // Create cleaned output writer for terminal
        const writeToTerminal = createCleanTerminalWriter(ctx.addTerminalOutput);

        if (isDevServer) {
            // Auto-detect missing deps and smart install before starting dev server
            try {
                const currentFiles = useStore.getState().files;
                if (Object.keys(currentFiles).length > 0) {
                    await autoInstallDependencies(currentFiles, ctx.addTerminalOutput);
                }
                await smartInstall(ctx.addTerminalOutput);
            } catch (e) {
                console.error('[Tools] Auto-install before dev server failed:', e);
            }

            // Fire and forget — dev server runs in background, don't await
            let devOutputBuffer = '';
            executeCommand(cmd, cmdArgs, (output) => {
                writeToTerminal(output);
                devOutputBuffer += output;
                const parsed = parseErrorsFromOutput(output, 'pnpm run dev');
                if (parsed.length > 0) {
                    useStore.getState().addParsedErrors(parsed);
                }
            }, -1);
            return `[SYSTEM] Command "${command}" started in background. ✅ DEV SERVER IS NOW RUNNING! Your task is complete - do not run any more commands.`;
        }

        // Determine timeout based on command type
        let timeout = 120000; // 2 min default
        if ((cmd === 'npm' || cmd === 'pnpm') && cmdArgs.includes('install')) {
            timeout = 180000; // 3 min for install
        } else if (cmd === 'npx' && cmdArgs.includes('tsc')) {
            timeout = 60000; // 1 min for type check
        }

        let outputBuffer = '';
        const exitCode = await executeCommand(cmd, cmdArgs, (output) => {
            outputBuffer += output;
            writeToTerminal(output);
        }, timeout);

        // Clean and truncate output for AI (save tokens)
        const MAX_OUTPUT_LENGTH = 3000;
        let finalOutput = cleanTerminalOutput(outputBuffer);
        if (finalOutput.length > MAX_OUTPUT_LENGTH) {
            finalOutput = finalOutput.slice(0, 500) + '\n...[truncated]...\n' + finalOutput.slice(-2500);
        }

        // Timeout detection
        if (exitCode === 124) {
            return `[SYSTEM] ⏰ Command "${command}" TIMED OUT after ${timeout / 1000}s.\nPartial output:\n${finalOutput}\n\n⚠️ The command took too long. Try a simpler approach or break it into smaller steps.`;
        }

        // Parse npm/pnpm errors for clearer feedback
        if (exitCode !== 0 && (cmd === 'npm' || cmd === 'pnpm')) {
            const errors = parseNpmErrors(outputBuffer);
            if (errors) {
                return `[SYSTEM] ❌ Command "${command}" FAILED (exit code ${exitCode}).\n\n🔴 Parsed errors:\n${errors}\n\nFull output:\n${finalOutput}`;
            }
        }

        // Parse TypeScript/build errors
        if (exitCode !== 0) {
            const tsErrors = parseBuildErrors(outputBuffer);
            if (tsErrors) {
                return `[SYSTEM] ❌ Command "${command}" FAILED (exit code ${exitCode}).\n\n🔴 Errors found:\n${tsErrors}\n\nFull output:\n${finalOutput}`;
            }
        }

        const status = exitCode === 0 ? '✅' : '❌';

        // Parse and store errors for the Error Panel
        if (exitCode !== 0) {
            const parsed = parseErrorsFromOutput(outputBuffer, command);
            if (parsed.length > 0) {
                useStore.getState().addParsedErrors(parsed);
            }
        }

        return `[SYSTEM] ${status} Command "${command}" finished (exit code ${exitCode}).\nOutput:\n${finalOutput}`;
    } catch (e: any) {
        return `Error running command "${command}": ${e.message}`;
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
            return '[SYSTEM] ⏰ TypeScript check timed out. The project may be too large or tsc is not installed. Try running `pnpm run dev` instead — Vite will show errors in the browser.';
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
        return `Error running TypeScript check: ${e.message}. Try running \`pnpm run dev\` instead.`;
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

export async function handleSearchWeb(args: { query: string; includeDomains?: string[] }): Promise<string> {
    const { query, includeDomains } = args;
    try {
        const requestBody: any = {
            api_key: process.env.NEXT_PUBLIC_TAVILY_API_KEY,
            query,
            include_answer: "basic",
            search_depth: "advanced",
            max_results: 5,
            include_images: true,
            include_image_descriptions: true,
        };

        if (includeDomains && includeDomains.length > 0) {
            requestBody.include_domains = includeDomains;
        }

        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            throw new Error(`Tavily API Error: ${response.statusText}`);
        }

        const data = await response.json();

        let result = '';

        if (data.answer) {
            result += `${data.answer}\n\n`;
        }

        if (data.results && data.results.length > 0) {
            result += `**Sources:** ${data.results.map((r: any) => r.title).join(', ')}\n\n`;
        }

        if (data.images && data.images.length > 0) {
            result += `**Images:**\n\n`;
            data.images.slice(0, 6).forEach((img: any, idx: number) => {
                result += `![${img.description || `Image ${idx + 1}`}](${img.url})\n\n`;
            });
        }

        return result;
    } catch (e: any) {
        return `Error: ${e.message}`;
    }
}

export async function handleExtractPage(args: { url: string }): Promise<string> {
    const { url } = args;
    try {
        const response = await fetch('https://api.tavily.com/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: process.env.NEXT_PUBLIC_TAVILY_API_KEY,
                urls: [url],
            }),
        });

        if (!response.ok) {
            throw new Error(`Tavily Extract API Error: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.results && data.results.length > 0) {
            const result = data.results[0];
            let formatted = `[SYSTEM] Extracted content from ${url}\n\n`;
            formatted += `## ${result.title || 'Page Content'}\n\n`;
            formatted += result.raw_content || result.content || 'No content extracted';
            return formatted;
        }

        return `[SYSTEM] No content could be extracted from ${url}`;
    } catch (e: any) {
        return `Error extracting page: ${e.message}`;
    }
}

export async function handleInspectNetwork(args: { url: string; method?: string }, ctx: ToolContext): Promise<string> {
    const { url } = args;
    try {
        return await handleRunCommand({
            command: `node -e "const h=require('${url.startsWith('https') ? 'https' : 'http'}'); h.get('${url}', r => { console.log('Status: '+r.statusCode); console.log(r.headers); r.resume() }).on('error', e=>console.log(e.message))"`
        }, ctx);
    } catch (e: any) {
        return `Error inspecting network: ${e.message}`;
    }
}

export async function handleCheckDependencies(ctx: ToolContext): Promise<string> {
    try {
        const outdated = await handleRunCommand({ command: 'npm outdated' }, ctx);
        const pkg = await handleReadFile({ path: 'package.json' });
        return `${pkg}\n\n[NPM OUTDATED REPORT]:\n${outdated}`;
    } catch (e: any) {
        return `Error checking dependencies: ${e.message}`;
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
    const newFilesMap: Record<string, { file: { contents: string } }> = {};

    for (const file of files) {
        if (!file.path || file.content === undefined) {
            results.push(`  ❌ Invalid file entry (missing path or content)`);
            continue;
        }

        try {
            await writeFile(file.path, file.content);
            newFilesMap[file.path] = { file: { contents: file.content } };
            successCount++;
            results.push(`  ✅ ${file.path}`);
        } catch (e: any) {
            results.push(`  ❌ ${file.path}: ${e.message}`);
        }
    }

    // Single store update for all files (instead of N updates)
    if (successCount > 0) {
        const state = useStore.getState();
        state.setFiles({ ...state.files, ...newFilesMap });
    }

    // Select the first file
    if (files.length > 0 && files[0].path) {
        ctx.setSelectedFile(files[0].path);
    }

    return `[SYSTEM] Batch create: ${successCount}/${files.length} files created.\n${results.join('\n')}`;
}

export async function handleGetErrors(ctx: ToolContext): Promise<string> {
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
    if (name === 'listFiles') return handleListFiles();
    if (name === 'checkDependencies') return handleCheckDependencies(ctx);
    if (name === 'getErrors') return handleGetErrors(ctx);

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
                case 'runCommand':
                    result = await handleRunCommand(args, ctx);
                    break;
                case 'searchWeb':
                    result = await handleSearchWeb(args);
                    break;
                case 'searchInFiles':
                    result = await handleSearchInFiles(args);
                    break;
                case 'inspectNetwork':
                    result = await handleInspectNetwork(args, ctx);
                    break;
                case 'drawDiagram':
                    result = await handleDrawDiagram(args);
                    break;
                case 'extractPage':
                    result = await handleExtractPage(args);
                    break;
                case 'lintCheck':
                    result = await handleLintCheck(args, ctx);
                    break;
                case 'batchCreateFiles':
                    result = await handleBatchCreateFiles(args, ctx);
                    break;
                default:
                    result = `Unknown tool: "${name}". Available: createFile, editFile, readFile, readMultipleFiles, deleteFile, renameFile, listFiles, searchInFiles, runCommand, typeCheck, lintCheck, searchWeb, extractPage, inspectNetwork, checkDependencies, drawDiagram, batchCreateFiles, getErrors`;
            }
        } catch (e: any) {
            result = `[SYSTEM] ❌ Tool "${name}" crashed: ${e.message}. Try again or use a different approach.`;
        }

        results.push(result);
    }

    return results.join('\n');
}
