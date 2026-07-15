'use client'

import { memo, useMemo } from 'react';
import {
    BrainCircuit,
    Check,
    FilePenLine,
    FolderOpen,
    ServerCog,
    SquareTerminal,
    X,
} from 'lucide-react';

export type ActionKind = 'thinking' | 'read' | 'edit' | 'command' | 'service';

export interface StreamingAction {
    id: string;
    toolName: string;
    displayName: string;
    status: 'pending' | 'running' | 'done' | 'error';
    result?: string;
    args?: unknown;
    kind?: ActionKind;
    toolCallId?: string;
    session?: number;
    eventId?: number;
}

interface ActionsListProps {
    actions: StreamingAction[];
    isLive?: boolean;
    isDark?: boolean;
}

const READ_TOOLS = new Set([
    'readFile', 'readMultipleFiles', 'listFiles', 'grep', 'searchInFiles',
]);
const EDIT_TOOLS = new Set([
    'createFile', 'write_file', 'editFile', 'deleteFile', 'renameFile',
    'batchCreateFiles', 'file_created', 'file_modified', 'file_deleted',
]);
const COMMAND_TOOLS = new Set([
    'executeCommand', 'command_run', 'typeCheck', 'lintCheck', 'getErrors',
]);
const SERVICE_TOOLS = new Set([
    'deploy', 'save', 'createWorkspace', 'startPreview', 'setDomain',
]);

const COMMAND_READ_RE = /(?:^|[;&|]\s*|\s)(?:cat|head|tail|less|more|grep|rg|find|ls|pwd|stat|wc)(?:\s|$)|\bgit\s+(?:status|diff|log|show)(?:\s|$)/i;
const COMMAND_EDIT_RE = /(?:^|[;&|]\s*|\s)(?:sed\s+-i|perl\s+-pi|rm|mv|cp|mkdir|touch|truncate|tee)(?:\s|$)|(?:^|[^<>])(?:>>?)\s*[^\s;&|]+/i;
const COMMAND_SERVICE_RE = /\b(?:docker|podman|systemctl|service|pm2|preview|deploy|issue_deploy)\b|\bnpm\s+(?:run\s+)?(?:dev|start|preview)\b/i;

function parseArgs(action: StreamingAction): Record<string, any> {
    if (!action.args) return {};
    if (typeof action.args === 'object') return action.args as Record<string, any>;
    try {
        return JSON.parse(String(action.args));
    } catch {
        return {};
    }
}

function getCommand(action: StreamingAction): string {
    const parsed = parseArgs(action);
    const command = parsed.command ?? parsed.cmd ?? parsed.script;
    if (typeof command === 'string' && command.trim()) return command.trim();
    if (COMMAND_TOOLS.has(action.toolName) && action.displayName) return action.displayName.trim();
    return '';
}

function commandFileDetails(rawCommand: string, kind: ActionKind): string[] {
    if (!rawCommand || (kind !== 'read' && kind !== 'edit')) return [];
    const shellMatch = rawCommand.match(/(?:^|\s)(?:\/bin\/)?(?:ba|z|)sh\s+-lc\s+(['"])([\s\S]*)\1\s*$/i);
    const unwrapped = (shellMatch?.[2] || rawCommand).replace(/`[^`]*`/g, ' ');
    let command = '';
    let substitutionDepth = 0;
    for (let index = 0; index < unwrapped.length; index++) {
        if (unwrapped[index] === '$' && unwrapped[index + 1] === '(') {
            substitutionDepth++;
            index++;
            continue;
        }
        if (substitutionDepth > 0) {
            if (unwrapped[index] === '(') substitutionDepth++;
            else if (unwrapped[index] === ')') substitutionDepth--;
            continue;
        }
        command += unwrapped[index];
    }
    const paths = new Set<string>();
    const addPath = (rawValue: string | undefined) => {
        const value = rawValue?.replace(/^['"]|['"]$/g, '').replace(/[;&|]+$/g, '');
        if (!value || value === '.' || value === './' || value.startsWith('-')) return;
        if (/[*?{}\[\]$()`]/.test(value) || value.startsWith('/bin/')) return;
        paths.add(value);
    };

    for (const segment of command.split(/&&|\|\||;|\|/)) {
        for (const match of segment.matchAll(/(?:^|[^<>])(?:>>?)\s*["']?([^\s"';&|]+)/g)) {
            addPath(match[1]);
        }

        const tokens = (segment.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [])
            .map(token => token.replace(/^['"]|['"]$/g, ''));
        while (tokens[0] === 'sudo' || tokens[0] === 'command' || /^[A-Z_][A-Z0-9_]*=/.test(tokens[0] || '')) {
            tokens.shift();
        }
        const executable = (tokens.shift() || '').split('/').pop()?.toLowerCase();
        const operands = tokens.filter(token => token && !token.startsWith('-') && token !== '>' && token !== '>>');

        if (['cat', 'less', 'more', 'stat'].includes(executable || '')) {
            operands.forEach(addPath);
        } else if (['head', 'tail', 'wc'].includes(executable || '')) {
            operands.filter(token => !/^\d+$/.test(token)).forEach(addPath);
        } else if (executable === 'ls') {
            operands.forEach(addPath);
        } else if (executable === 'grep' || executable === 'rg') {
            operands.slice(1).forEach(addPath);
        } else if (executable === 'find') {
            addPath(operands[0]);
        } else if (executable === 'git') {
            const separator = tokens.indexOf('--');
            if (separator >= 0) tokens.slice(separator + 1).forEach(addPath);
        } else if (['rm', 'mv', 'cp', 'mkdir', 'touch', 'truncate', 'tee'].includes(executable || '')) {
            operands.forEach(addPath);
        } else if (executable === 'sed' || executable === 'perl') {
            // The first operand is the substitution/program expression; the rest are files.
            operands.slice(1).forEach(addPath);
        }
    }

    return [...paths].slice(0, 3);
}

export function inferActionKind(action: StreamingAction): ActionKind {
    if (action.kind) return action.kind;
    if (READ_TOOLS.has(action.toolName)) return 'read';
    if (EDIT_TOOLS.has(action.toolName)) return 'edit';
    if (SERVICE_TOOLS.has(action.toolName)) return 'service';

    if (COMMAND_TOOLS.has(action.toolName)) {
        const command = getCommand(action);
        // Syte may mark all shell work as command_run. Display the operation the
        // command actually performed instead of blindly trusting that marker.
        if (COMMAND_SERVICE_RE.test(command)) return 'service';
        if (COMMAND_EDIT_RE.test(command)) return 'edit';
        if (COMMAND_READ_RE.test(command)) return 'read';
        return 'command';
    }

    if (/read|search|list/i.test(action.toolName)) return 'read';
    if (/write|edit|create|delete|rename|patch/i.test(action.toolName)) return 'edit';
    if (/deploy|preview|service|workspace|domain/i.test(action.toolName)) return 'service';
    return 'command';
}

function getFileDetails(action: StreamingAction): string[] {
    const parsed = parseArgs(action);
    const value = parsed.path ?? parsed.file_path ?? parsed.file;

    if (typeof value === 'string' && value) return [value];
    if (Array.isArray(parsed.paths)) return parsed.paths.filter((path: unknown): path is string => typeof path === 'string');
    if (Array.isArray(parsed.files)) {
        return parsed.files
            .map((file: unknown) => typeof file === 'string' ? file : (file as { path?: unknown })?.path)
            .filter((path: unknown): path is string => typeof path === 'string');
    }
    if (typeof parsed.oldPath === 'string') {
        return [`${parsed.oldPath}${typeof parsed.newPath === 'string' ? ` → ${parsed.newPath}` : ''}`];
    }
    const kind = inferActionKind(action);
    if (COMMAND_TOOLS.has(action.toolName)) {
        return commandFileDetails(getCommand(action), kind);
    }
    if ((kind === 'read' || kind === 'edit') && action.displayName) {
        return [action.displayName];
    }
    return [];
}

function shortFileName(path: string): string {
    const [from, to] = path.split(' → ');
    const short = (value: string) => value.replace(/\\/g, '/').split('/').filter(Boolean).pop() || value;
    return to ? `${short(from)} → ${short(to)}` : short(from);
}

function actionLabel(kind: ActionKind, active: boolean, _count: number): string {
    switch (kind) {
        case 'thinking': return active ? 'thinking' : 'thought';
        case 'read': return active ? 'Reading file' : 'Read file';
        case 'edit': return active ? 'Editing file' : 'Edited file';
        case 'service': return active ? 'running service action' : 'service action';
        default: return active ? 'running command' : 'run command';
    }
}

const KIND_ICONS = {
    thinking: BrainCircuit,
    read: FolderOpen,
    edit: FilePenLine,
    command: SquareTerminal,
    service: ServerCog,
} satisfies Record<ActionKind, typeof BrainCircuit>;

function FileFormatBadge({ file }: { file: string }) {
    const clean = file.split(' → ').pop() || file;
    const extension = clean.split('.').pop()?.toLowerCase() || '';
    const label: Record<string, string> = {
        ts: 'TS', tsx: 'TS', js: 'JS', jsx: 'JS', py: 'PY', css: 'CS',
        scss: 'SC', html: 'HT', json: '{}', md: 'MD', sql: 'SQ', sh: 'SH',
    };
    return (
        <span
            aria-hidden="true"
            className="flex h-3.5 min-w-3.5 flex-none items-center justify-center rounded-[2px] bg-amber-400 px-0.5 text-[7px] font-black leading-none text-[#18191b]"
        >
            {label[extension] || 'F'}
        </span>
    );
}

interface ActionGroup {
    kind: ActionKind;
    actions: StreamingAction[];
}

function stackActions(actions: StreamingAction[]): ActionGroup[] {
    const groups: ActionGroup[] = [];
    for (const action of actions) {
        const kind = inferActionKind(action);
        const previous = groups[groups.length - 1];
        if (previous?.kind === kind) previous.actions.push(action);
        else groups.push({ kind, actions: [action] });
    }
    return groups;
}

const ActionGroupRow = memo(function ActionGroupRow({ group, isDark }: { group: ActionGroup; isDark: boolean }) {
    const { kind, actions } = group;
    const Icon = KIND_ICONS[kind];
    const visible = actions.slice(0, 3);
    const hiddenActionCount = Math.max(0, actions.length - visible.length);
    const active = actions.some(action => action.status === 'running' || action.status === 'pending');
    const hasError = actions.some(action => action.status === 'error');
    const isFileGroup = kind === 'read' || kind === 'edit';

    const allFileNames = actions.flatMap(getFileDetails).map(shortFileName);
    const fileNames = allFileNames.slice(0, 3);
    const commandNames = visible.map(action => getCommand(action) || action.displayName || action.toolName);
    const labelCount = isFileGroup ? Math.max(allFileNames.length, actions.length) : actions.length;
    const hiddenCount = isFileGroup
        ? Math.max(0, allFileNames.length - fileNames.length)
        : hiddenActionCount;

    return (
        <div className="py-1.5">
            <div className="flex min-w-0 items-center gap-2.5">
                <Icon
                    aria-hidden="true"
                    className={`h-[18px] w-[18px] flex-none ${
                        hasError
                            ? 'text-red-400'
                            : isDark ? 'text-zinc-400' : 'text-gray-500'
                    } ${active ? 'animate-pulse' : ''}`}
                    strokeWidth={1.8}
                />
                <span className={`flex-none text-[14px] font-semibold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>
                    {actionLabel(kind, active, labelCount)}
                </span>

                {isFileGroup && fileNames.length > 0 && (
                    <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                        {fileNames.map((file, index) => (
                            <span key={`${file}-${index}`} className="flex min-w-0 items-center gap-1 text-[13px] text-amber-400">
                                <FileFormatBadge file={file} />
                                <span className="truncate font-medium">{file}</span>
                            </span>
                        ))}
                        {(hiddenCount > 0 || actions.flatMap(getFileDetails).length > 3) && (
                            <span className={`flex-none text-[15px] ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>…</span>
                        )}
                    </div>
                )}

                {hasError && <X className="ml-auto h-3.5 w-3.5 flex-none text-red-400" aria-label="Action failed" />}
                {!active && !hasError && kind === 'service' && (
                    <Check className="ml-auto h-3.5 w-3.5 flex-none text-emerald-500" aria-label="Action complete" />
                )}
            </div>

            {!isFileGroup && (
                <div className={`ml-[7px] mt-2 border-l-2 pl-[21px] ${isDark ? 'border-zinc-500' : 'border-gray-300'}`}>
                    {commandNames.map((command, index) => (
                        <div key={`${command}-${index}`} className={`flex min-w-0 items-center gap-2 py-1 text-[11px] ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                            {kind === 'service'
                                ? <ServerCog className="h-3 w-3 flex-none" strokeWidth={1.8} />
                                : <SquareTerminal className="h-3 w-3 flex-none" strokeWidth={1.8} />
                            }
                            <span className="truncate">{command}</span>
                        </div>
                    ))}
                    {hiddenCount > 0 && (
                        <div className={`py-0.5 text-[14px] leading-none ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} title={`${hiddenCount} more action${hiddenCount === 1 ? '' : 's'}`}>…</div>
                    )}
                </div>
            )}
        </div>
    );
});

export const ActionsList = memo(function ActionsList({ actions, isDark = true }: ActionsListProps) {
    const groups = useMemo(() => stackActions(actions), [actions]);
    if (groups.length === 0) return null;

    return (
        <div className="my-2 space-y-1" aria-label="Agent activity">
            {groups.map((group, index) => (
                <ActionGroupRow key={`${group.kind}-${group.actions[0]?.id || index}`} group={group} isDark={isDark} />
            ))}
        </div>
    );
});
