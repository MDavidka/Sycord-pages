'use client'

import { memo, useLayoutEffect, useMemo, useState } from 'react';
import {
    ChevronDown,
    Download,
    Expand,
    SquareTerminal,
    Terminal,
    Globe,
    Cloud,
    Server,
    MousePointer,
    FileText,
    CheckCircle2,
    Check,
    Ban,
    AlertTriangle,
    Loader2,
} from 'lucide-react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { ToolGroup } from '@/components/agent-elements/tools/tool-group';
import { SearchTool } from '@/components/agent-elements/tools/search-tool';
import { SubagentTool } from '@/components/agent-elements/tools/subagent-tool';
import { PlanTool } from '@/components/agent-elements/tools/plan-tool';
import { SpiralLoader } from '@/components/agent-elements/spiral-loader';
import { Markdown } from '@/components/agent-elements/markdown';
import { McpBrandIcon } from './McpBrandIcons';
import type { GenerationPlan } from '../lib/generation-plan';
import type { ActionMarkData } from '../lib/project-agent';
import { useStore } from '../store';

export interface StreamingAction {
    id: string;
    toolName: string;
    displayName: string;
    status: 'pending' | 'running' | 'done' | 'error';
    result?: string;
    args?: unknown;
    eventId?: number;
    toolCallId?: string;
    startedAt?: number;
    completedAt?: number;
    actionMark?: ActionMarkData;
    screenshots?: Array<{
        id?: string;
        viewport?: string;
        route?: string;
        imageUrl?: string;
        imageBase64?: string;
    }>;
    nestedActions?: StreamingAction[];
    subagentTaskId?: string;
}

interface ActionsListProps {
    actions: StreamingAction[];
    isLive?: boolean;
    isDark?: boolean;
}

type ActionKind =
    | 'thinking'
    | 'search'
    | 'read'
    | 'edit'
    | 'command'
    | 'install'
    | 'validate'
    | 'preview'
    | 'service'
    | 'screenshot'
    | 'plan'
    | 'subagent'
    | 'action_mark';

interface ActionGroup {
    kind: ActionKind;
    actions: StreamingAction[];
}

const FILE_TOOL_NAMES = new Set([
    'createfile', 'write_file', 'writefile', 'editfile', 'edit_file', 'apply_patch',
    'patch', 'readfile', 'read_file', 'readmultiplefiles', 'read_multiple_files',
    'deletefile', 'delete_file', 'renamefile', 'rename_file', 'batchcreatefiles',
    'file_created', 'file_modified', 'file_deleted', 'file_read', 'file_changed',
]);

const GROUPABLE_KINDS: ActionKind[] = ['thinking', 'read', 'edit', 'command', 'install', 'validate', 'search', 'action_mark'];

function GithubIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
        </svg>
    );
}

export function resolveActionMark(action: StreamingAction): ActionMarkData | null {
    if (action.actionMark) return action.actionMark;
    const name = action.toolName.toLowerCase();
    const args = parseArgs(action.args);
    const cmd = String(args.command || args.cmd || action.displayName || '').trim();
    const path = String(args.path || args.file || args.filePath || '').trim();
    const url = String(args.url || args.query || '').trim();

    // 1. Security risk check
    const riskPatterns = ['rm -rf /', 'chmod 777', 'curl | bash', 'wget | bash', 'mkfs', '> /dev/sda'];
    if (riskPatterns.some(p => cmd.includes(p)) || name.includes('risk') || action.result?.toLowerCase().includes('security risk')) {
        return {
            kind: 'security_risk',
            label: 'security risk!',
            detail: cmd || action.result || 'Dangerous command flagged',
            badge: null,
            status: 'warning',
            is_risk: true,
        };
    }

    // 2. Integration / MCP tools
    if (name.includes('gmail') || cmd.includes('gmail') || name.includes('email') || name.includes('mail')) {
        const isDraftOrSend = name.includes('send') || name.includes('draft') || cmd.includes('send') || cmd.includes('draft');
        return {
            kind: 'gmail',
            label: isDraftOrSend ? 'drafting email' : 'checking your emails',
            detail: String(args.query || args.subject || args.to || 'Gmail'),
            badge: 'gmail',
            status: action.status === 'running' ? 'running' : 'completed',
            is_risk: false,
        };
    }
    if (name.includes('git') || cmd.startsWith('git ') || cmd.includes('git clone') || cmd.includes('git commit') || cmd.includes('git push') || name.includes('github')) {
        const isRepoList = name.includes('repo') || cmd.includes('repo') || name.includes('list');
        return {
            kind: 'github',
            label: isRepoList ? 'fetching github repositories' : 'connecting to github',
            detail: cmd.startsWith('git') ? cmd : (args.branch ? `branch: ${args.branch}` : (args.repo ? String(args.repo) : 'GitHub repository sync')),
            badge: 'github',
            status: action.status === 'running' ? 'running' : 'completed',
            is_risk: false,
        };
    }
    if (name.includes('linear')) {
        return {
            kind: 'linear',
            label: 'syncing linear issues',
            detail: String(args.issue || args.query || args.project || 'Linear'),
            badge: 'linear',
            status: action.status === 'running' ? 'running' : 'completed',
            is_risk: false,
        };
    }
    if (name.includes('slack')) {
        return {
            kind: 'slack',
            label: 'reading slack messages',
            detail: String(args.channel || args.query || 'Slack'),
            badge: 'slack',
            status: action.status === 'running' ? 'running' : 'completed',
            is_risk: false,
        };
    }
    if (name.includes('supabase')) {
        return {
            kind: 'supabase',
            label: 'connecting to supabase',
            detail: String(args.table || args.query || 'Supabase DB'),
            badge: 'supabase',
            status: action.status === 'running' ? 'running' : 'completed',
            is_risk: false,
        };
    }
    if (name.includes('drive') || name.includes('google_drive')) {
        return {
            kind: 'google-drive',
            label: 'searching google drive',
            detail: String(args.query || args.name || 'Google Drive'),
            badge: 'google-drive',
            status: action.status === 'running' ? 'running' : 'completed',
            is_risk: false,
        };
    }

    // 3. Starting server
    if (name.includes('start_preview') || /\b(npm|pnpm|yarn|bun)\s+(run\s+)?(dev|start)\b/.test(cmd)) {
        return {
            kind: 'server',
            label: 'starting server',
            detail: cmd || 'local preview server',
            badge: 'starting',
            status: action.status === 'running' ? 'running' : 'completed',
            is_risk: false,
        };
    }

    // 4. Using browser
    if (name.includes('browser') || name.includes('preview')) {
        return {
            kind: 'browser',
            label: 'using browser',
            detail: url || path || 'preview viewport',
            badge: 'browser',
            status: action.status === 'running' ? 'running' : 'completed',
            is_risk: false,
        };
    }

    // 5. Using cloud servers
    if (name.includes('cloud') || name.includes('deploy') || name.includes('mcp')) {
        return {
            kind: 'cloud',
            label: 'using cloud servers',
            detail: String(args.addon || args.service || 'cloud cluster'),
            badge: 'cloud',
            status: action.status === 'running' ? 'running' : 'completed',
            is_risk: false,
        };
    }

    // 6. Scraping web
    if (name.includes('scrape') || name.includes('fetch') || cmd.startsWith('curl ') || cmd.startsWith('wget ')) {
        let domain = 'web.app';
        if (url.startsWith('http')) {
            try {
                domain = new URL(url).hostname.replace('www.', '');
            } catch {}
        }
        return {
            kind: 'scrape',
            label: 'scraping web',
            detail: url || cmd || 'querying web',
            badge: domain,
            status: action.status === 'running' ? 'running' : 'completed',
            is_risk: false,
        };
    }

    // 7. Type checking
    if (name.includes('typecheck') || name.includes('check_types') || /\b(tsc|typecheck|eslint)\b/.test(cmd)) {
        return {
            kind: 'typecheck',
            label: 'type checking',
            detail: path || 'TypeScript & AST verification',
            badge: 'tsc',
            status: action.status === 'running' ? 'running' : 'completed',
            is_risk: false,
        };
    }

    // 8. Opening file
    if (name.includes('read_file') || name === 'file_read') {
        return {
            kind: 'file',
            label: 'opening file',
            detail: path || action.displayName,
            badge: path ? path.split('/').pop() : null,
            status: action.status === 'running' ? 'running' : 'completed',
            is_risk: false,
        };
    }

    // 9. Running command
    if (cmd && (name.includes('command') || name === 'command_run' || name === 'syte_run_command')) {
        return {
            kind: 'command',
            label: 'running command',
            detail: cmd,
            badge: null,
            status: action.status === 'running' ? 'running' : 'completed',
            is_risk: false,
        };
    }

    return null;
}

export const SingleActionIndicator = memo(function SingleActionIndicator({
    action,
    isDark = true,
}: {
    action: StreamingAction;
    isDark?: boolean;
}) {
    const mark = action.actionMark || resolveActionMark(action);
    const kind = mark?.kind || classifyAction(action);
    const label = mark?.label || action.displayName || action.toolName;
    const isRunning = action.status === 'running' || !action.status || action.status === 'pending';
    const isRisk = Boolean(mark?.is_risk || mark?.kind === 'security_risk');

    return (
        <div className="flex items-center gap-2.5 text-[14px] text-zinc-400 select-none py-1 animate-fade-in">
            {/* Gray Icon for all tools, or integration brand icon */}
            <div className="shrink-0 flex items-center justify-center text-zinc-400">
                {isRisk ? (
                    <Ban className="size-4 text-red-400 shrink-0" />
                ) : kind === 'gmail' || kind === 'google-drive' || kind === 'linear' || kind === 'slack' || kind === 'supabase' || kind === 'github' ? (
                    <McpBrandIcon id={kind} className="size-4" />
                ) : kind === 'server' ? (
                    <Server className="size-4 text-zinc-400 shrink-0" />
                ) : kind === 'browser' ? (
                    <MousePointer className="size-4 text-zinc-400 shrink-0" />
                ) : kind === 'cloud' ? (
                    <Cloud className="size-4 text-zinc-400 shrink-0" />
                ) : kind === 'scrape' || kind === 'search' ? (
                    <Globe className="size-4 text-zinc-400 shrink-0" />
                ) : kind === 'typecheck' || kind === 'validate' ? (
                    <CheckCircle2 className="size-4 text-zinc-400 shrink-0" />
                ) : kind === 'file' || kind === 'read' || kind === 'edit' ? (
                    <FileText className="size-4 text-zinc-400 shrink-0" />
                ) : (
                    <SquareTerminal className="size-4 text-zinc-400 shrink-0" />
                )}
            </div>

            {/* Gray label text */}
            <span className={cn('font-normal tracking-tight', isRisk ? 'text-red-400' : 'text-zinc-400')}>
                {label}
            </span>

            {/* Subtle indicator */}
            {isRunning && (
                <span className="inline-block size-1.5 rounded-full bg-zinc-400 animate-pulse ml-0.5" />
            )}
        </div>
    );
});

export const ActionMarkRow = memo(function ActionMarkRow({
    action,
    isDark = true,
}: {
    action: StreamingAction;
    isDark?: boolean;
}) {
    const mark = action.actionMark || resolveActionMark(action);
    if (!mark) return null;

    const isRunning = action.status === 'running' || mark.status === 'running';
    const isError = action.status === 'error' || mark.status === 'error';
    const isRisk = Boolean(mark.is_risk || mark.kind === 'security_risk');

    return (
        <div
            className={cn(
                'group flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-[13px] transition-all border select-none',
                isRisk
                    ? 'border-red-500/30 bg-red-500/10 text-red-400 font-medium'
                    : isDark
                        ? 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05] text-zinc-300'
                        : 'border-black/[0.08] bg-black/[0.02] hover:bg-black/[0.04] text-zinc-700',
            )}
        >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {/* Visual Icon matching the exact kind in monochrome gray */}
                <div className="shrink-0 flex items-center justify-center text-zinc-400">
                    {isRisk ? (
                        <Ban className="size-4 text-red-500 shrink-0" />
                    ) : mark.kind === 'gmail' || mark.kind === 'google-drive' || mark.kind === 'linear' || mark.kind === 'slack' || mark.kind === 'supabase' || mark.kind === 'github' ? (
                        <McpBrandIcon id={mark.kind} className="size-4" />
                    ) : mark.kind === 'server' ? (
                        <Server className="size-4 text-zinc-400 shrink-0" />
                    ) : mark.kind === 'browser' ? (
                        <MousePointer className="size-4 text-zinc-400 shrink-0" />
                    ) : mark.kind === 'cloud' ? (
                        <Cloud className="size-4 text-zinc-400 shrink-0" />
                    ) : mark.kind === 'scrape' ? (
                        <Globe className="size-4 text-zinc-400 shrink-0" />
                    ) : mark.kind === 'typecheck' ? (
                        <CheckCircle2 className="size-4 text-zinc-400 shrink-0" />
                    ) : mark.kind === 'file' ? (
                        <FileText className="size-4 text-zinc-400 shrink-0" />
                    ) : (
                        <SquareTerminal className="size-4 text-zinc-400 shrink-0" />
                    )}
                </div>

                {/* Mark Label */}
                <span className={cn(
                    'shrink-0 font-medium tracking-tight',
                    isRisk ? 'text-red-400 font-semibold' : (isDark ? 'text-zinc-300' : 'text-zinc-700')
                )}>
                    {mark.label}
                </span>

                {/* Optional Detail string */}
                {mark.detail && (
                    <span className={cn(
                        'truncate text-[12px] font-mono',
                        isRisk ? 'text-red-400/90' : (isDark ? 'text-zinc-500' : 'text-zinc-500')
                    )}>
                        {mark.detail}
                    </span>
                )}
            </div>

            {/* Right side: Badge and Status indicator */}
            <div className="flex items-center gap-2 shrink-0">
                {mark.badge && (
                    mark.badge === 'starting' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                            <span className="size-1.5 rounded-full bg-zinc-400 animate-pulse" />
                            starting
                        </span>
                    ) : (
                        <span className={cn(
                            'px-2 py-0.5 rounded-md text-[11px] font-mono border',
                            isDark ? 'bg-zinc-800/80 text-zinc-400 border-zinc-700/60' : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                        )}>
                            {mark.badge}
                        </span>
                    )
                )}

                {isRisk ? (
                    <span className="flex items-center justify-center size-4 rounded-full bg-red-500/25 text-red-400 text-[10px] font-bold">!</span>
                ) : isRunning ? (
                    <Loader2 className="size-3.5 animate-spin text-zinc-400" />
                ) : isError ? (
                    <span className="size-1.5 rounded-full bg-red-400" />
                ) : (
                    <Check className="size-3.5 text-zinc-400" />
                )}
            </div>
        </div>
    );
});

function parseArgs(args: unknown): Record<string, any> {
    if (!args) return {};
    if (typeof args === 'object') return args as Record<string, any>;
    if (typeof args !== 'string') return {};
    try {
        const parsed = JSON.parse(args);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function classifyAction(action: StreamingAction): ActionKind {
    if (action.actionMark) return 'action_mark';
    const name = action.toolName.toLowerCase();
    if (name.includes('screenshot') || (action.screenshots && action.screenshots.length > 0)) return 'screenshot';
    if (name === 'subagent' || name.includes('subagent') || action.subagentTaskId || action.nestedActions?.length) return 'subagent';
    if (name === 'planning' || name === 'update_plan' || name === 'plan' || name.includes('planwrite')) return 'plan';
    if (name.includes('think')) return 'thinking';

    const resolved = resolveActionMark(action);
    if (resolved && (resolved.kind === 'security_risk' || resolved.kind === 'github' || resolved.kind === 'server' || resolved.kind === 'browser' || resolved.kind === 'cloud' || resolved.kind === 'scrape' || resolved.kind === 'typecheck')) {
        action.actionMark = resolved;
        return 'action_mark';
    }

    const args = parseArgs(action.args);
    const command = String(args.command || action.displayName || '').toLowerCase();

    if (name.includes('grep') || name.includes('search') || name === 'file_search' || name.includes('listfiles') || name.includes('list_files')) return 'search';
    if (name.includes('read') || name === 'file_read') return 'read';
    if (FILE_TOOL_NAMES.has(name) || name.includes('write') || name.includes('edit') || name.includes('patch') || name.startsWith('file_')) return 'edit';
    if (name.includes('preview') || name.includes('browser') || name === 'startpreview' || /\b(npm|pnpm|yarn|bun)\s+(run\s+)?(dev|start|serve)\b/.test(command)) return 'preview';
    if (/\b(npm|pnpm|yarn|bun)\s+(install|add)\b|\bpip\s+install\b/.test(command)) return 'install';
    if (name.includes('typecheck') || name.includes('lint') || name.includes('geterrors') || /\b(test|lint|typecheck|tsc)\b/.test(command)) return 'validate';
    if (name.includes('command') || name === 'bash' || name === 'shell' || name === 'terminal' || name === 'command_run' || name === 'command_output' || name === 'run_command') return 'command';
    return 'service';
}

function groupActions(actions: StreamingAction[]): ActionGroup[] {
    const groups: ActionGroup[] = [];
    for (const action of actions) {
        const kind = classifyAction(action);
        const previous = groups[groups.length - 1];
        if (previous && previous.kind === kind && GROUPABLE_KINDS.includes(kind)) {
            previous.actions.push(action);
        } else {
            groups.push({ kind, actions: [action] });
        }
    }
    return groups;
}

function getFilePaths(action: StreamingAction): string[] {
    const args = parseArgs(action.args);
    const directPath = args.path || args.file || args.filePath || args.file_path || args.filename;
    if (directPath) return [String(directPath)];
    if (Array.isArray(args.paths)) return args.paths.map(String);
    if (Array.isArray(args.files)) {
        return args.files.map((file: any) => typeof file === 'string' ? file : file?.path).filter(Boolean);
    }
    if (args.oldPath) return [`${args.oldPath} → ${args.newPath || ''}`.trim()];
    if (FILE_TOOL_NAMES.has(action.toolName.toLowerCase()) && action.displayName) return [action.displayName];
    return [];
}

function displayFileName(path: string): string {
    return path
        .split(' → ')
        .map(part => part.split('/').filter(Boolean).pop() || part)
        .join(' → ');
}

function getCommand(action: StreamingAction): string {
    const args = parseArgs(action.args);
    return String(args.command || args.cmd || action.displayName || action.toolName || '');
}

function getSearchTerm(action: StreamingAction): string {
    const args = parseArgs(action.args);
    return String(args.query || args.pattern || args.grep || args.search || action.displayName || '');
}

function getThinkingText(action: StreamingAction): string {
    if (action.result) return String(action.result);
    const args = parseArgs(action.args);
    return String(args.notes || args.thought || args.text || action.displayName || '');
}

function partState(action: StreamingAction): string {
    if (action.status === 'error') return 'output-error';
    if (action.status === 'done') return 'output-available';
    if (action.status === 'running') return 'input-streaming';
    return 'input-available';
}

function actionToNestedPart(action: StreamingAction) {
    const kind = classifyAction(action);
    const args = parseArgs(action.args);
    const paths = getFilePaths(action);
    const filePath = paths[0] || '';
    const base = {
        id: action.id,
        toolCallId: action.toolCallId || action.id,
        state: partState(action),
        startedAt: action.startedAt,
        output: action.result
            ? { result: action.result, success: action.status !== 'error' }
            : action.status === 'done'
                ? { success: true }
                : undefined,
    };

    if (kind === 'read') {
        return { ...base, type: 'tool-Read', input: { file_path: filePath, ...args } };
    }
    if (kind === 'edit') {
        const isCreate = /create|write|file_created/i.test(action.toolName);
        return {
            ...base,
            type: isCreate ? 'tool-Write' : 'tool-Edit',
            input: {
                file_path: filePath,
                old_string: args.old_text || args.old_string || '',
                new_string: args.new_text || args.new_string || args.content || '',
                ...args,
            },
        };
    }
    if (kind === 'search') {
        return {
            ...base,
            type: /web/i.test(action.toolName) ? 'tool-WebSearch' : 'tool-Grep',
            input: { pattern: getSearchTerm(action), query: getSearchTerm(action), path: args.path, ...args },
            output: {
                results: normalizeSearchResults(action),
                numFiles: normalizeSearchResults(action).length,
            },
        };
    }
    if (kind === 'command' || kind === 'install' || kind === 'validate' || kind === 'preview') {
        return {
            ...base,
            type: 'tool-Bash',
            input: { command: getCommand(action), ...args },
            output: action.result ? { result: action.result } : base.output,
        };
    }
    if (kind === 'thinking') {
        return { ...base, type: 'tool-Thinking', input: { thought: getThinkingText(action) } };
    }
    if (kind === 'subagent') {
        return {
            ...base,
            type: 'tool-Agent',
            input: {
                description: action.displayName || 'Subagent',
                subagent_type: action.subagentTaskId || args.profile || 'syra-subagent',
                ...args,
            },
        };
    }
    return {
        ...base,
        type: 'tool-Skill',
        input: { skill: action.displayName || action.toolName, ...args },
    };
}

function normalizeSearchResults(action: StreamingAction) {
    const args = parseArgs(action.args);
    const raw = args.results || args.matches || args.files;
    if (Array.isArray(raw)) {
        return raw.map((item: any, index: number) => {
            if (typeof item === 'string') {
                return { source: 'web' as const, title: item, date: '' };
            }
            return {
                source: 'web' as const,
                title: String(item?.title || item?.path || item?.file || item?.url || `Result ${index + 1}`),
                date: String(item?.date || item?.path || ''),
            };
        });
    }
    const paths = getFilePaths(action);
    if (paths.length > 0) {
        return paths.map(path => ({ source: 'web' as const, title: displayFileName(path), date: path }));
    }
    if (action.result) {
        return action.result
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .slice(0, 12)
            .map(line => ({ source: 'web' as const, title: line, date: '' }));
    }
    return [];
}

function formatWorkedFor(actions: StreamingAction[]): string {
    const starts = actions.map(a => a.startedAt).filter((n): n is number => typeof n === 'number');
    const ends = actions.map(a => a.completedAt || a.startedAt).filter((n): n is number => typeof n === 'number');
    if (starts.length === 0 || ends.length === 0) return 'worked for a moment';
    const ms = Math.max(0, Math.max(...ends) - Math.min(...starts));
    if (ms < 60_000) {
        const secs = Math.max(1, Math.round(ms / 1000));
        return `worked for ${secs}s`;
    }
    const mins = Math.max(1, Math.round(ms / 60_000));
    return `worked for ${mins} min`;
}

function phaseCopy(actions: StreamingAction[], isLive: boolean) {
    if (actions.length === 0) {
        return { title: isLive ? 'Working' : 'Done', summary: 'No visible execution steps.' };
    }
    const activeAction = [...actions].reverse().find(action => action.status === 'running' || action.status === 'pending');
    const focus = classifyAction(activeAction || actions[actions.length - 1]);
    const complete = actions.every(action => action.status === 'done' || action.status === 'error');

    if (focus === 'subagent') return { title: isLive ? 'Running subagent' : 'Subagent complete', summary: 'Delegated work is in progress.' };
    if (focus === 'plan') return { title: isLive ? 'Planning' : 'Plan ready', summary: 'Build plan updated.' };
    if (focus === 'read' || focus === 'search') return { title: 'Inspecting code', summary: 'Syra is reviewing the project before making changes.' };
    if (focus === 'edit') return { title: isLive ? 'Applying changes' : 'Changes applied', summary: 'Project files are being updated with the requested work.' };
    if (focus === 'command' || focus === 'install' || focus === 'validate') return { title: isLive ? 'Validating' : 'Validation complete', summary: 'Commands and checks confirm the project is ready.' };
    if (focus === 'preview') return { title: 'Checking preview', summary: 'Syra is confirming the result in the live site.' };
    if (complete) return { title: 'Done', summary: `${actions.length} execution step${actions.length === 1 ? '' : 's'} completed.` };
    return { title: 'Understanding task', summary: 'Syra is preparing the next project steps.' };
}

function planSummaryFromActions(actions: StreamingAction[], generationPlan: GenerationPlan | null): { title: string; summary: string; id?: string } {
    if (generationPlan) {
        const steps = generationPlan.steps
            .map((step, index) => `${index + 1}. ${step.title}${step.description ? ` — ${step.description}` : ''}`)
            .join('\n');
        const notes = generationPlan.notes?.trim() || '';
        return {
            id: generationPlan.id,
            title: generationPlan.title,
            summary: [notes, steps].filter(Boolean).join('\n\n'),
        };
    }
    const action = actions[0];
    const args = parseArgs(action?.args);
    const title = String(args.title || action?.displayName || 'Plan');
    const summary = String(
        args.summary ||
        args.notes ||
        action?.result ||
        (Array.isArray(args.steps)
            ? args.steps.map((step: any, i: number) => `${i + 1}. ${typeof step === 'string' ? step : step?.title || step?.name || 'Step'}`).join('\n')
            : ''),
    );
    return { id: String(args.plan_id || args.id || action?.id || 'plan'), title, summary };
}

const ScreenshotCard = memo(function ScreenshotCard({
    action,
    isDark,
}: {
    action: StreamingAction;
    isDark: boolean;
}) {
    const [expanded, setExpanded] = useState(false);
    const shot = action.screenshots?.[0];
    const src = shot?.imageBase64 || shot?.imageUrl;

    return (
        <div className="px-1 py-1.5">
            <div
                className={cn(
                    'relative overflow-hidden rounded-an-tool-border-radius border',
                    isDark ? 'border-an-tool-border-color bg-an-tool-background' : 'border-black/10 bg-white',
                )}
            >
                <div className="p-2.5">
                    <div
                        className={cn(
                            'relative flex min-h-[120px] items-center justify-center overflow-hidden rounded-md border',
                            isDark ? 'border-white/10 bg-black/40' : 'border-black/8 bg-gray-50',
                        )}
                    >
                        {src ? (
                            <img
                                src={src}
                                alt={shot?.route || 'Screenshot'}
                                className={cn('max-h-[220px] w-full object-contain', expanded && 'max-h-[70vh]')}
                            />
                        ) : (
                            <span className={cn('text-sm', isDark ? 'text-white/35' : 'text-gray-400')}>Screenshot</span>
                        )}
                    </div>
                </div>
                <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5">
                    <span className={cn(
                        'inline-flex items-center gap-1.5 text-[11px]',
                        isDark ? 'text-an-tool-color-muted' : 'text-gray-600',
                    )}>
                        <SquareTerminal className="size-3" strokeWidth={1.8} />
                        made a screenshot
                    </span>
                    <div className="flex items-center gap-1">
                        {src && (
                            <a
                                href={src}
                                download={shot?.route ? `screenshot-${shot.route.replace(/[^\w.-]+/g, '_')}.png` : 'screenshot.png'}
                                target="_blank"
                                rel="noreferrer"
                                aria-label="Download screenshot"
                                className={cn(
                                    'flex size-7 items-center justify-center rounded-md border transition-colors',
                                    isDark ? 'border-white/10 text-white/55 hover:bg-white/[0.06]' : 'border-black/10 text-gray-500 hover:bg-black/[0.04]',
                                )}
                            >
                                <Download className="size-3.5" strokeWidth={1.8} />
                            </a>
                        )}
                        <button
                            type="button"
                            onClick={() => setExpanded(v => !v)}
                            aria-label="Expand screenshot"
                            className={cn(
                                'flex size-7 items-center justify-center rounded-md border transition-colors',
                                isDark ? 'border-white/10 text-white/55 hover:bg-white/[0.06]' : 'border-black/10 text-gray-500 hover:bg-black/[0.04]',
                            )}
                        >
                            <Expand className="size-3.5" strokeWidth={1.8} />
                        </button>
                    </div>
                </div>
            </div>
            {expanded && src && (
                <button
                    type="button"
                    className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-6"
                    onClick={() => setExpanded(false)}
                >
                    <img src={src} alt="" className="max-h-full max-w-full object-contain" />
                </button>
            )}
        </div>
    );
});

const ToolStack = memo(function ToolStack({
    group,
    isDark,
    chatStatus,
    generationPlan,
}: {
    group: ActionGroup;
    isDark: boolean;
    chatStatus: string;
    generationPlan: GenerationPlan | null;
}) {
    const [expandedAll, setExpandedAll] = useState(false);

    if (group.kind === 'action_mark') {
        const visibleActions = expandedAll ? group.actions : group.actions.slice(0, 3);
        const hiddenCount = Math.max(0, group.actions.length - 3);

        return (
            <div className="space-y-1.5 my-1">
                {visibleActions.map(action => (
                    <ActionMarkRow key={action.id} action={action} isDark={isDark} />
                ))}
                {hiddenCount > 0 && (
                    <button
                        type="button"
                        onClick={() => setExpandedAll(v => !v)}
                        className={cn(
                            'text-xs font-medium px-2 py-1 rounded-md transition-colors',
                            isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]' : 'text-zinc-500 hover:text-zinc-800 hover:bg-black/[0.04]'
                        )}
                    >
                        {expandedAll ? 'Show less' : `+${hiddenCount} more`}
                    </button>
                )}
            </div>
        );
    }

    if (group.kind === 'screenshot') {
        const visibleActions = expandedAll ? group.actions : group.actions.slice(0, 3);
        const hiddenCount = Math.max(0, group.actions.length - 3);

        return (
            <div className="space-y-1.5">
                {visibleActions.map(action => (
                    <ScreenshotCard key={action.id} action={action} isDark={isDark} />
                ))}
                {hiddenCount > 0 && (
                    <button
                        type="button"
                        onClick={() => setExpandedAll(v => !v)}
                        className={cn(
                            'text-xs font-medium px-2 py-1 rounded-md transition-colors',
                            isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]' : 'text-zinc-500 hover:text-zinc-800 hover:bg-black/[0.04]'
                        )}
                    >
                        {expandedAll ? 'Show less' : `+${hiddenCount} more`}
                    </button>
                )}
            </div>
        );
    }

    if (group.kind === 'plan') {
        const plan = planSummaryFromActions(group.actions, generationPlan);
        const pending = group.actions.some(a => a.status === 'running' || a.status === 'pending');
        return (
            <PlanTool
                chatStatus={chatStatus}
                isDark={isDark}
                part={{
                    type: 'tool-PlanWrite',
                    toolCallId: group.actions[0]?.toolCallId || group.actions[0]?.id,
                    state: pending ? 'input-streaming' : 'output-available',
                    input: {
                        // No manual approval flow yet — auto-approve in the UI.
                        approved: true,
                        plan: {
                            id: plan.id,
                            title: plan.title,
                            summary: plan.summary || 'Plan ready.',
                        },
                    },
                }}
            />
        );
    }

    if (group.kind === 'subagent') {
        return (
            <div className="space-y-2">
                {group.actions.map(action => (
                    <SubagentTool
                        key={action.id}
                        chatStatus={chatStatus}
                        part={actionToNestedPart(action)}
                        nestedTools={(action.nestedActions || []).map(actionToNestedPart)}
                    />
                ))}
            </div>
        );
    }

    if (group.kind === 'search') {
        const primary = group.actions[0];
        const results = group.actions.flatMap(normalizeSearchResults);
        return (
            <SearchTool
                part={{
                    ...actionToNestedPart(primary),
                    output: { results, numFiles: results.length },
                }}
                results={results}
                defaultOpen={results.length > 0 && results.length <= 6}
            />
        );
    }

    if (group.kind === 'thinking') {
        const active = group.actions.some(a => a.status === 'running' || a.status === 'pending');
        const text = group.actions.map(getThinkingText).filter(Boolean).join('\n\n');
        return (
            <div className="px-1 py-1">
                <div className="flex items-center gap-2 text-sm text-an-tool-color-muted">
                    {active ? <SpiralLoader size={14} /> : null}
                    <span className="font-medium text-an-tool-color">{active ? 'Thinking' : 'Thought'}</span>
                </div>
                {text ? (
                    <div className="mt-1.5 max-h-[120px] overflow-hidden text-sm text-an-tool-color-muted">
                        <Markdown content={text} className="text-sm" />
                    </div>
                ) : null}
            </div>
        );
    }

    const active = group.actions.some(action => action.status === 'running' || action.status === 'pending');
    const nestedTools = group.actions.map(actionToNestedPart);
    const labels: Record<string, [string, string]> = {
        read: ['Reading files', 'Read files'],
        edit: ['Editing files', 'Edited files'],
        command: ['Running commands', 'Ran commands'],
        install: ['Installing dependencies', 'Installed dependencies'],
        validate: ['Validating changes', 'Validated changes'],
        preview: ['Checking preview', 'Checked preview'],
        service: ['Running service action', 'Service action complete'],
    };
    const [shimmer, complete] = labels[group.kind] || ['Working', 'Done'];

    return (
        <ToolGroup
            part={{
                id: group.actions[0]?.id,
                toolCallId: group.actions[0]?.toolCallId || group.actions[0]?.id,
                state: active ? 'input-streaming' : 'output-available',
                startedAt: group.actions[0]?.startedAt,
                input: {
                    description: group.actions
                        .flatMap(getFilePaths)
                        .slice(0, 3)
                        .map(displayFileName)
                        .join(', '),
                },
                output: active
                    ? undefined
                    : {
                        success: true,
                        totalDurationMs: Math.max(
                            0,
                            (Math.max(...group.actions.map(a => a.completedAt || a.startedAt || 0)) -
                                Math.min(...group.actions.map(a => a.startedAt || Date.now()))),
                        ),
                    },
            }}
            nestedTools={nestedTools}
            chatStatus={chatStatus}
            completeLabel={complete}
            shimmerLabel={shimmer}
            interruptedLabel="Interrupted"
            maxVisibleTools={group.kind === 'read' || group.kind === 'edit' ? 4 : 5}
            defaultOpen={active}
            showElapsed
        />
    );
});

export const ActionsList = memo(function ActionsList({ actions, isLive = false, isDark = true }: ActionsListProps) {
    const [phaseOpen, setPhaseOpen] = useState(isLive);
    const [showAllGroups, setShowAllGroups] = useState(false);
    const generationPlan = useStore(s => s.generationPlan);
    const groups = useMemo(() => groupActions(actions), [actions]);
    const phase = useMemo(() => phaseCopy(actions, isLive), [actions, isLive]);
    const workedFor = useMemo(() => formatWorkedFor(actions), [actions]);
    const running = actions.some(action => action.status === 'running' || action.status === 'pending');
    const chatStatus = isLive && running ? 'streaming' : 'ready';

    useLayoutEffect(() => {
        if (isLive) {
            setPhaseOpen(true);
        } else {
            setPhaseOpen(false);
        }
    }, [isLive]);

    if (actions.length === 0) return null;

    const visibleGroups = showAllGroups ? groups : groups.slice(0, 3);
    const hiddenGroupCount = Math.max(0, groups.length - 3);

    if (!isLive) {
        return (
            <Collapsible open={phaseOpen} onOpenChange={setPhaseOpen}>
                <section className={cn('agent-feed my-3 font-[family-name:var(--font-agent-sans)]', isDark ? 'text-white' : 'text-gray-900')}>
                    <CollapsibleTrigger asChild>
                        <button
                            type="button"
                            className={cn(
                                'group/phase flex w-full items-center gap-2 rounded-md px-1 py-1 text-left',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50',
                                isDark ? 'hover:bg-white/[0.035]' : 'hover:bg-black/[0.035]',
                            )}
                        >
                            <span className={cn('text-sm', isDark ? 'text-white/55' : 'text-gray-500')}>{workedFor}</span>
                            <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', isDark ? 'text-white/35' : 'text-gray-400', !phaseOpen && '-rotate-90')} />
                        </button>
                    </CollapsibleTrigger>
                    <div className={cn('mt-1.5 h-px w-full', isDark ? 'bg-white/10' : 'bg-black/10')} />
                    <CollapsibleContent>
                        <div className="mt-1.5 space-y-1.5 pl-0.5 sm:pl-1">
                            {visibleGroups.map((group, index) => (
                                <ToolStack
                                    key={`${group.kind}-${group.actions[0].id}-${index}`}
                                    group={group}
                                    isDark={isDark}
                                    chatStatus={chatStatus}
                                    generationPlan={generationPlan}
                                />
                            ))}
                            {hiddenGroupCount > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setShowAllGroups(v => !v)}
                                    className={cn(
                                        'text-xs font-medium px-2 py-1 rounded-md transition-colors mt-1 inline-block',
                                        isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]' : 'text-zinc-500 hover:text-zinc-800 hover:bg-black/[0.04]'
                                    )}
                                >
                                    {showAllGroups ? 'Show less' : `+${hiddenGroupCount} more`}
                                </button>
                            )}
                        </div>
                    </CollapsibleContent>
                </section>
            </Collapsible>
        );
    }

    if (isLive) {
        // Only 1 tool displayed during execution (the latest/active tool)
        const activeAction = actions.slice().reverse().find(a => a.status === 'running' || a.status === 'pending') || actions[actions.length - 1];
        if (!activeAction) return null;
        return (
            <div className="py-0.5">
                <SingleActionIndicator action={activeAction} isDark={isDark} />
            </div>
        );
    }

    return null;
});
