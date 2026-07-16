'use client'

import { memo, useMemo, useState } from 'react';
import {
    Brain,
    Check,
    ChevronDown,
    CircleAlert,
    Code2,
    Eye,
    FileCode2,
    FileSearch,
    FolderSearch2,
    LoaderCircle,
    ServerCog,
    Terminal,
    Wrench,
    type LucideIcon,
} from 'lucide-react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

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
}

interface ActionsListProps {
    actions: StreamingAction[];
    isLive?: boolean;
    isDark?: boolean;
}

type ActionKind = 'thinking' | 'search' | 'read' | 'edit' | 'command' | 'install' | 'validate' | 'preview' | 'service';

interface ActionGroup {
    kind: ActionKind;
    actions: StreamingAction[];
}

const FILE_ICON_BASE = 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons';
const FILE_ICON_URLS: Record<string, string> = {
    ts: `${FILE_ICON_BASE}/typescript/typescript-original.svg`,
    tsx: `${FILE_ICON_BASE}/typescript/typescript-original.svg`,
    js: `${FILE_ICON_BASE}/javascript/javascript-original.svg`,
    jsx: `${FILE_ICON_BASE}/react/react-original.svg`,
    py: `${FILE_ICON_BASE}/python/python-original.svg`,
    html: `${FILE_ICON_BASE}/html5/html5-original.svg`,
    htm: `${FILE_ICON_BASE}/html5/html5-original.svg`,
    md: `${FILE_ICON_BASE}/markdown/markdown-original.svg`,
    mdx: `${FILE_ICON_BASE}/markdown/markdown-original.svg`,
    json: `${FILE_ICON_BASE}/json/json-original.svg`,
};

const SPECIAL_FILE_ICON_URLS = {
    node: `${FILE_ICON_BASE}/nodejs/nodejs-original.svg`,
    docker: `${FILE_ICON_BASE}/docker/docker-original.svg`,
    git: `${FILE_ICON_BASE}/git/git-original.svg`,
    next: `${FILE_ICON_BASE}/nextjs/nextjs-original.svg`,
};

const FILE_TOOL_NAMES = new Set([
    'createfile', 'write_file', 'writefile', 'editfile', 'edit_file', 'apply_patch',
    'patch', 'readfile', 'read_file', 'readmultiplefiles', 'read_multiple_files',
    'deletefile', 'delete_file', 'renamefile', 'rename_file', 'batchcreatefiles',
    'file_created', 'file_modified', 'file_deleted',
]);

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

    if (name.includes('think') || name === 'planning') return 'thinking';
    if (name.includes('grep') || name.includes('search') || name.includes('listfiles') || name.includes('list_files')) return 'search';
    if (name.includes('read')) return 'read';
    if (FILE_TOOL_NAMES.has(name) || name.includes('write') || name.includes('edit') || name.includes('patch') || name.startsWith('file_')) return 'edit';
    if (name.includes('preview') || name.includes('browser') || name === 'startpreview' || /\b(npm|pnpm|yarn|bun)\s+(run\s+)?(dev|start|serve)\b/.test(command)) return 'preview';
    if (/\b(npm|pnpm|yarn|bun)\s+(install|add)\b|\bpip\s+install\b/.test(command)) return 'install';
    if (name.includes('typecheck') || name.includes('lint') || name.includes('geterrors') || /\b(test|lint|typecheck|tsc)\b/.test(command)) return 'validate';
    if (name.includes('command') || name === 'bash' || name === 'shell' || name === 'terminal' || name === 'command_run') return 'command';
    return 'service';
}

function groupActions(actions: StreamingAction[]): ActionGroup[] {
    const groups: ActionGroup[] = [];
    for (const action of actions) {
        const kind = classifyAction(action);
        const previous = groups[groups.length - 1];
        // File operations and commands form compact, adjacent stacks. Keep unlike
        // operations separate so "read" is never presented as an "edit".
        if (previous && previous.kind === kind && ['read', 'edit', 'command', 'install', 'validate', 'search'].includes(kind)) {
            previous.actions.push(action);
        } else {
            groups.push({ kind, actions: [action] });
        }
    }
    return groups;
}

function getFilePaths(action: StreamingAction): string[] {
    const args = parseArgs(action.args);
    const directPath = args.path || args.file || args.filePath || args.filename;
    if (directPath) return [String(directPath)];
    if (Array.isArray(args.paths)) return args.paths.map(String);
    if (Array.isArray(args.files)) {
        return args.files.map((file: any) => typeof file === 'string' ? file : file?.path).filter(Boolean);
    }
    if (args.oldPath) return [`${args.oldPath} → ${args.newPath || ''}`.trim()];
    if (FILE_TOOL_NAMES.has(action.toolName.toLowerCase()) && action.displayName) return [action.displayName];
    return [];
}

function getCommand(action: StreamingAction): string {
    const args = parseArgs(action.args);
    return String(args.command || args.cmd || action.displayName || action.toolName).trim();
}

function getSearchTerm(action: StreamingAction): string {
    const args = parseArgs(action.args);
    return String(args.pattern || args.query || action.displayName || 'Project files').trim();
}

function actionTitle(kind: ActionKind, count: number, active: boolean): string {
    const plural = count === 1 ? '' : 's';
    const labels: Record<ActionKind, [string, string]> = {
        thinking: ['Planning', 'Planned'],
        search: ['Searching project', 'Searched project'],
        read: [`Reading ${count} file${plural}`, `Read ${count} file${plural}`],
        edit: [`Editing ${count} file${plural}`, `Edited ${count} file${plural}`],
        command: [`Running ${count} command${plural}`, `Ran ${count} command${plural}`],
        install: ['Installing dependencies', 'Installed dependencies'],
        validate: ['Validating changes', 'Validated changes'],
        preview: ['Checking preview', 'Checked preview'],
        service: ['Running service action', 'Service action complete'],
    };
    return labels[kind][active ? 0 : 1];
}

function phaseCopy(actions: StreamingAction[], isLive: boolean) {
    if (actions.length === 0) {
        return { title: isLive ? 'Working' : 'Done', summary: 'No visible execution steps.' };
    }
    const activeAction = [...actions].reverse().find(action => action.status === 'running' || action.status === 'pending');
    const focus = classifyAction(activeAction || actions[actions.length - 1]);
    const failed = actions.some(action => action.status === 'error');
    const complete = actions.every(action => action.status === 'done' || action.status === 'error');

    if (failed && complete) return { title: 'Needs attention', summary: 'One or more execution steps could not be completed.' };
    if (focus === 'read' || focus === 'search') return { title: 'Inspecting code', summary: 'Syra is reviewing the project before making changes.' };
    if (focus === 'edit') return { title: isLive ? 'Applying changes' : 'Changes applied', summary: 'Project files are being updated with the requested work.' };
    if (focus === 'command' || focus === 'install' || focus === 'validate') return { title: isLive ? 'Validating' : 'Validation complete', summary: 'Commands and checks confirm the project is ready.' };
    if (focus === 'preview') return { title: 'Checking preview', summary: 'Syra is confirming the result in the live site.' };
    if (complete) return { title: 'Done', summary: `${actions.length} execution step${actions.length === 1 ? '' : 's'} completed.` };
    return { title: 'Understanding task', summary: 'Syra is preparing the next project steps.' };
}

function FileTypeIcon({ path, isDark }: { path: string; isDark: boolean }) {
    const cleanPath = path.split(' → ')[0];
    const fileName = cleanPath.split('/').pop() || cleanPath;
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    const lowerName = fileName.toLowerCase();
    const url = lowerName === 'package.json'
        ? SPECIAL_FILE_ICON_URLS.node
        : lowerName === 'dockerfile' || lowerName.startsWith('docker-compose')
            ? SPECIAL_FILE_ICON_URLS.docker
            : lowerName === '.gitignore' || lowerName === '.gitattributes'
                ? SPECIAL_FILE_ICON_URLS.git
                : lowerName.startsWith('next.config')
                    ? SPECIAL_FILE_ICON_URLS.next
                    : FILE_ICON_URLS[extension];

    if (url) {
        return <img src={url} alt="" aria-hidden="true" className="size-4 shrink-0 object-contain" />;
    }
    return <FileCode2 className={cn('size-4 shrink-0', isDark ? 'text-white/55' : 'text-gray-500')} strokeWidth={1.8} />;
}

function kindIcon(kind: ActionKind): LucideIcon {
    return {
        thinking: Brain,
        search: FolderSearch2,
        read: FileSearch,
        edit: Code2,
        command: Terminal,
        install: Wrench,
        validate: Wrench,
        preview: Eye,
        service: ServerCog,
    }[kind];
}

function cleanResult(result: string): string {
    return result.replace(/^\[SYSTEM\]\s*/gm, '').trim();
}

function ActionStatus({ action, isDark }: { action: StreamingAction; isDark: boolean }) {
    if (action.status === 'running' || action.status === 'pending') {
        return <LoaderCircle className={cn('size-4 shrink-0 animate-spin', isDark ? 'text-blue-300' : 'text-blue-600')} aria-label="Running" />;
    }
    if (action.status === 'error') {
        return <CircleAlert className={cn('size-4 shrink-0', isDark ? 'text-red-300' : 'text-red-600')} aria-label="Needs attention" />;
    }
    return <Check className={cn('size-4 shrink-0', isDark ? 'text-emerald-300' : 'text-emerald-600')} aria-label="Completed" />;
}

const ToolStack = memo(function ToolStack({ group, isDark }: { group: ActionGroup; isDark: boolean }) {
    const [open, setOpen] = useState(group.actions.some(action => action.status === 'error'));
    const active = group.actions.some(action => action.status === 'running' || action.status === 'pending');
    const failed = group.actions.some(action => action.status === 'error');
    const expandable = group.actions.some(action => action.result || getFilePaths(action).length > 0 || action.args);
    const Icon = kindIcon(group.kind);
    const isFileGroup = group.kind === 'read' || group.kind === 'edit';
    const previewItems = isFileGroup
        ? group.actions.flatMap(action => getFilePaths(action).map((path, index) => ({
            key: `${action.id}-${index}`,
            text: path,
            isFile: true,
        })))
        : group.actions.map(action => ({
            key: action.id,
            text: group.kind === 'command' || group.kind === 'install' || group.kind === 'validate'
                ? getCommand(action)
                : group.kind === 'search'
                    ? getSearchTerm(action)
                    : action.displayName || action.toolName,
            isFile: false,
        }));
    const effectiveItems = previewItems.length > 0
        ? previewItems
        : group.actions.map(action => ({ key: action.id, text: action.displayName || action.toolName, isFile: false }));
    const visibleItems = effectiveItems.slice(0, 3);
    const hiddenCount = Math.max(0, effectiveItems.length - visibleItems.length);
    const itemCount = effectiveItems.length;

    return (
        <Collapsible open={open} onOpenChange={setOpen} disabled={!expandable}>
            <CollapsibleTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'group/tool w-full rounded-lg px-2 py-2 text-left transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50',
                        expandable && (isDark ? 'hover:bg-white/[0.055]' : 'hover:bg-black/[0.045]'),
                        active && 'bg-gradient-to-r from-blue-500/10 to-transparent',
                    )}
                >
                    <span className="flex min-h-7 items-center gap-2.5">
                        <ChevronDown
                            className={cn('size-4 shrink-0 transition-transform', isDark ? 'text-white/40' : 'text-gray-400', !open && '-rotate-90', !expandable && 'opacity-0')}
                            strokeWidth={1.8}
                        />
                        <Icon className={cn('size-4 shrink-0', group.kind === 'edit' || group.kind === 'preview' ? 'text-blue-400' : group.kind === 'validate' || group.kind === 'install' ? 'text-violet-400' : isDark ? 'text-white/65' : 'text-gray-500')} strokeWidth={1.8} />
                        <span className={cn('min-w-0 flex-1 text-sm font-semibold', isDark ? 'text-white/85' : 'text-gray-800')}>
                            {actionTitle(group.kind, itemCount, active)}
                        </span>
                        <span className={cn('hidden text-xs sm:inline', failed ? 'text-red-400' : active ? 'text-blue-400' : isDark ? 'text-white/40' : 'text-gray-400')}>
                            {failed ? 'Needs attention' : active ? 'Running' : 'Completed'}
                        </span>
                        <ActionStatus action={failed ? group.actions.find(action => action.status === 'error')! : active ? group.actions.find(action => action.status === 'running' || action.status === 'pending')! : group.actions[group.actions.length - 1]} isDark={isDark} />
                    </span>

                    <span className="mt-1.5 block space-y-1 pl-[4.15rem] pr-1">
                        {visibleItems.map(item => (
                            <span key={item.key} className="flex min-w-0 items-center gap-2 text-[13px] leading-5">
                                {item.isFile ? <FileTypeIcon path={item.text} isDark={isDark} /> : <span className="size-4 shrink-0" />}
                                <span className={cn(
                                    'truncate font-[family-name:var(--font-agent-mono)]',
                                    item.isFile
                                        ? isDark ? 'text-[#f2c45a]' : 'text-[#a16207]'
                                        : isDark ? 'text-white/50' : 'text-gray-500',
                                )} title={item.text}>
                                    {item.text}
                                </span>
                            </span>
                        ))}
                        {hiddenCount > 0 && (
                            <span className={cn('block pl-6 text-xs', isDark ? 'text-white/35' : 'text-gray-400')}>… {hiddenCount} more</span>
                        )}
                    </span>
                </button>
            </CollapsibleTrigger>

            <CollapsibleContent className={cn('ml-10 border-l pl-4', isDark ? 'border-white/10' : 'border-black/10')}>
                <div className="space-y-3 py-2">
                    {group.actions.map(action => {
                        const files = getFilePaths(action);
                        const result = action.result ? cleanResult(action.result) : '';
                        const detailLabel = files.join(', ') || (group.kind === 'command' || group.kind === 'install' || group.kind === 'validate' ? getCommand(action) : action.displayName || action.toolName);
                        return (
                            <div key={action.id} className="min-w-0">
                                <div className={cn('flex items-start gap-2 text-xs', isDark ? 'text-white/45' : 'text-gray-500')}>
                                    <ActionStatus action={action} isDark={isDark} />
                                    <span className={cn('min-w-0 whitespace-pre-wrap break-all font-[family-name:var(--font-agent-mono)] leading-5', files.length > 0 && (isDark ? 'text-[#f2c45a]/80' : 'text-[#a16207]'))}>{detailLabel}</span>
                                </div>
                                {result && (
                                    <pre className={cn(
                                        'mt-2 max-h-[360px] overflow-auto whitespace-pre-wrap break-words rounded-lg border p-3 font-[family-name:var(--font-agent-mono)] text-xs leading-5',
                                        isDark ? 'border-white/10 bg-black/20 text-[#b3b6c2]' : 'border-black/10 bg-black/[0.035] text-gray-600',
                                    )}>
                                        {result.slice(0, 6000)}
                                        {result.length > 6000 ? '\n… output truncated' : ''}
                                    </pre>
                                )}
                            </div>
                        );
                    })}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
});

export const ActionsList = memo(function ActionsList({ actions, isLive = false, isDark = true }: ActionsListProps) {
    const [phaseOpen, setPhaseOpen] = useState(isLive || actions.some(action => action.status === 'error'));
    const groups = useMemo(() => groupActions(actions), [actions]);
    const phase = useMemo(() => phaseCopy(actions, isLive), [actions, isLive]);
    const running = actions.some(action => action.status === 'running' || action.status === 'pending');
    const failed = actions.some(action => action.status === 'error');

    if (actions.length === 0) return null;

    return (
        <Collapsible open={isLive ? true : phaseOpen} onOpenChange={setPhaseOpen}>
            <section className={cn('agent-feed my-4 font-[family-name:var(--font-agent-sans)]', isDark ? 'text-white' : 'text-gray-900')}>
                <CollapsibleTrigger asChild>
                    <button type="button" className={cn('group/phase flex w-full items-start gap-3 rounded-lg px-1 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50', isDark ? 'hover:bg-white/[0.035]' : 'hover:bg-black/[0.035]')}>
                        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center">
                            {running ? (
                                <LoaderCircle className={cn('size-[18px] animate-spin', isDark ? 'text-blue-300' : 'text-blue-600')} />
                            ) : failed ? (
                                <CircleAlert className={cn('size-[18px]', isDark ? 'text-red-300' : 'text-red-600')} />
                            ) : (
                                <Check className={cn('size-[18px]', isDark ? 'text-emerald-300' : 'text-emerald-600')} />
                            )}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className={cn('block text-base font-semibold leading-[1.35] tracking-[-0.015em]', isDark ? 'text-white/[0.94]' : 'text-gray-900')}>{phase.title}</span>
                            <span className={cn('mt-1 block max-w-[65ch] text-sm leading-6', isDark ? 'text-white/[0.66]' : 'text-gray-600')}>{phase.summary}</span>
                        </span>
                        {!isLive && (
                            <ChevronDown className={cn('mt-1 size-4 shrink-0 transition-transform', isDark ? 'text-white/40' : 'text-gray-400', !phaseOpen && '-rotate-90')} />
                        )}
                    </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                    <div
                        data-active={running ? 'true' : 'false'}
                        className={cn(
                            'ml-3.5 mt-2 space-y-1 border-l pl-3 sm:ml-[15px] sm:pl-5',
                            running ? 'border-blue-400/55' : isDark ? 'border-white/10' : 'border-black/10',
                        )}
                    >
                        {groups.map((group, index) => (
                            <ToolStack key={`${group.kind}-${group.actions[0].id}-${index}`} group={group} isDark={isDark} />
                        ))}
                    </div>
                </CollapsibleContent>
            </section>
        </Collapsible>
    );
});
