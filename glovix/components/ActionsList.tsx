'use client'

import { memo, useLayoutEffect, useMemo, useState } from 'react';
import {
    ChevronDown,
    Download,
    Expand,
    SquareTerminal,
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
import { ThinkingTool } from '@/components/agent-elements/tools/thinking-tool';
import { SpiralLoader } from '@/components/agent-elements/spiral-loader';
import type { GenerationPlan } from '../lib/generation-plan';
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
    | 'subagent';

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

const GROUPABLE_KINDS: ActionKind[] = ['thinking', 'read', 'edit', 'command', 'install', 'validate', 'search'];

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
    const name = action.toolName.toLowerCase();
    const args = parseArgs(action.args);
    const command = String(args.command || action.displayName || '').toLowerCase();

    if (name.includes('screenshot') || (action.screenshots && action.screenshots.length > 0)) return 'screenshot';
    if (name === 'subagent' || name.includes('subagent') || action.subagentTaskId || action.nestedActions?.length) return 'subagent';
    if (name === 'planning' || name === 'update_plan' || name === 'plan' || name.includes('planwrite')) return 'plan';
    if (name.includes('think')) return 'thinking';
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
    if (group.kind === 'screenshot') {
        return (
            <div className="space-y-1.5">
                {group.actions.map(action => (
                    <ScreenshotCard key={action.id} action={action} isDark={isDark} />
                ))}
            </div>
        );
    }

    if (group.kind === 'plan') {
        const plan = planSummaryFromActions(group.actions, generationPlan);
        const pending = group.actions.some(a => a.status === 'running' || a.status === 'pending');
        return (
            <PlanTool
                chatStatus={chatStatus}
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
            <ThinkingTool
                part={{
                    id: group.actions[0]?.id || 'thinking',
                    toolCallId: group.actions[0]?.toolCallId || group.actions[0]?.id || 'thinking',
                    state: active ? 'input-streaming' : 'output-available',
                    input: { thought: text },
                }}
                defaultOpen={false}
            />
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
                            {groups.map((group, index) => (
                                <ToolStack
                                    key={`${group.kind}-${group.actions[0].id}-${index}`}
                                    group={group}
                                    isDark={isDark}
                                    chatStatus={chatStatus}
                                    generationPlan={generationPlan}
                                />
                            ))}
                        </div>
                    </CollapsibleContent>
                </section>
            </Collapsible>
        );
    }

    return (
        <section className={cn('agent-feed my-2 font-[family-name:var(--font-agent-sans)]', isDark ? 'text-white' : 'text-gray-900')}>
            <div className={cn('flex items-center gap-2 px-1 py-1 text-sm', isDark ? 'text-white/55' : 'text-gray-500')}>
                {running ? <SpiralLoader size={14} /> : <span className="size-3.5" aria-hidden="true" />}
                <span className={cn('font-medium', isDark ? 'text-white/75' : 'text-gray-700')}>{phase.title}</span>
            </div>

            <div
                data-active={running ? 'true' : 'false'}
                className="mt-1 space-y-1.5 pl-0.5 sm:pl-1"
            >
                {groups.map((group, index) => (
                    <ToolStack
                        key={`${group.kind}-${group.actions[0].id}-${index}`}
                        group={group}
                        isDark={isDark}
                        chatStatus={chatStatus}
                        generationPlan={generationPlan}
                    />
                ))}
            </div>
        </section>
    );
});
