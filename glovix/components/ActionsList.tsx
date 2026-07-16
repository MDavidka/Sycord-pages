'use client'
import { useState, useMemo, memo, useCallback } from 'react';
import {
    BookOpenCheck,
    Check,
    ChevronDown,
    Cloud,
    FilePen,
    GitBranchPlus,
    SquareTerminal,
    X,
    type LucideIcon,
} from 'lucide-react';

export interface StreamingAction {
    id: string;
    toolName: string;
    displayName: string;
    status: 'pending' | 'running' | 'done' | 'error';
    result?: string;
    args?: any;
}

interface ActionsListProps {
    actions: StreamingAction[];
    isLive?: boolean;
    isDark?: boolean;
}

const VERBS: Record<string, [string, string]> = {
    createFile:        ['Creating', 'Created'],
    create_file:       ['Creating', 'Created'],
    write_file:        ['Patching', 'Patched'],
    editFile:          ['Editing', 'Edited'],
    edit_file:         ['Editing', 'Edited'],
    readFile:          ['Reading', 'Read'],
    read_file:         ['Reading', 'Read'],
    readMultipleFiles: ['Reading', 'Read'],
    read_multiple_files: ['Reading', 'Read'],
    deleteFile:        ['Deleting', 'Deleted'],
    delete_file:       ['Deleting', 'Deleted'],
    renameFile:        ['Renaming', 'Renamed'],
    rename_file:       ['Renaming', 'Renamed'],
    grep:              ['Searching', 'Searched'],
    planning:          ['Planning', 'Planned'],
    searchInFiles:     ['Searching', 'Searched'],
    typeCheck:         ['Checking types', 'Type checked'],
    createWorkspace:   ['Creating Syte workspace', 'Workspace ready'],
    executeCommand:    ['Running command', 'Command finished'],
    execute_command:   ['Running command', 'Command finished'],
    command_run:       ['Running command', 'Command finished'],
    lintCheck:         ['Linting', 'Linted'],
    listFiles:         ['Listing files', 'Listed files'],
    drawDiagram:       ['Drawing diagram', 'Drew diagram'],
    batchCreateFiles:  ['Creating files', 'Created files'],
    batch_create_files: ['Creating files', 'Created files'],
    file_created:      ['Creating', 'Created'],
    file_modified:     ['Editing', 'Edited'],
    file_deleted:      ['Deleting', 'Deleted'],
    getErrors:         ['Checking errors', 'Checked errors'],
    deploy:            ['Deploying to sycord.site', 'Deployed to sycord.site'],
    save:              ['Saving to GitHub', 'Saved to GitHub'],
};

const DEPLOY_TOOLS = new Set(['deploy']);
const TERMINAL_TOOLS = new Set([
    'typeCheck',
    'lintCheck',
    'getErrors',
    'executeCommand',
    'execute_command',
    'command',
    'command_run',
]);
const FILE_TOOLS = new Set([
    'createFile',
    'create_file',
    'write_file',
    'editFile',
    'edit_file',
    'readFile',
    'read_file',
    'readMultipleFiles',
    'read_multiple_files',
    'deleteFile',
    'delete_file',
    'renameFile',
    'rename_file',
    'batchCreateFiles',
    'batch_create_files',
    'file_created',
    'file_modified',
    'file_deleted',
]);

const PROJECT_SEARCH_TOOLS = new Set([
    'grep',
    'searchInFiles',
    'projectSearch',
    'project_search',
    'project search',
]);
const SERVICE_TOOLS = new Set([
    'createWorkspace',
    'deploy',
    'save',
    'setDomain',
    'startPreview',
    'serviceAction',
    'serviceActions',
    'service_action',
    'service_actions',
    'service actions',
]);
const READ_TOOLS = new Set([
    'read',
    'readFile',
    'read_file',
    'readMultipleFiles',
    'read_multiple_files',
    'listFiles',
    'list_files',
]);
const EDIT_TOOLS = new Set([
    'edit',
    'createFile',
    'create_file',
    'write_file',
    'editFile',
    'edit_file',
    'deleteFile',
    'delete_file',
    'renameFile',
    'rename_file',
    'batchCreateFiles',
    'batch_create_files',
    'file_created',
    'file_modified',
    'file_deleted',
]);
const INITIAL_VISIBLE_ACTIONS = 5;

function getToolIcon(toolName: string): LucideIcon {
    if (PROJECT_SEARCH_TOOLS.has(toolName)) return GitBranchPlus;
    if (SERVICE_TOOLS.has(toolName)) return Cloud;
    if (TERMINAL_TOOLS.has(toolName)) return SquareTerminal;
    if (READ_TOOLS.has(toolName)) return BookOpenCheck;
    if (EDIT_TOOLS.has(toolName)) return FilePen;
    return SquareTerminal;
}

function shortFilePath(path: string): string {
    if (!path) return '';
    const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
    return normalized.split('/').pop() || path;
}

function shortFileDetail(path: string): string {
    const [oldPath, newPath] = path.split(' → ');
    return newPath === undefined
        ? shortFilePath(oldPath)
        : `${shortFilePath(oldPath)} → ${shortFilePath(newPath)}`;
}

interface DeduplicatedAction {
    action: StreamingAction;
    count: number;
    groupedActions: StreamingAction[];
}

function deduplicateActions(actions: StreamingAction[]): DeduplicatedAction[] {
    const result: DeduplicatedAction[] = [];
    for (const action of actions) {
        const key = `${action.toolName}::${action.status}`;
        const last = result[result.length - 1];
        if (last && FILE_TOOLS.has(action.toolName) && `${last.action.toolName}::${last.action.status}` === key) {
            last.count++;
            last.groupedActions.push(action);
        } else if (last && !FILE_TOOLS.has(action.toolName) && `${last.action.toolName}::${last.action.displayName}::${last.action.status}` === `${action.toolName}::${action.displayName}::${action.status}`) {
            last.count++;
            last.groupedActions.push(action);
        } else {
            result.push({ action, count: 1, groupedActions: [action] });
        }
    }
    return result;
}

function cleanResultForDisplay(result: string): string {
    return result.replace(/^\[SYSTEM\]\s*/gm, '').trim();
}

function getFileDetails(action: StreamingAction): string[] {
    if (!action.args) return [];
    try {
        const parsed = typeof action.args === 'string' ? JSON.parse(action.args) : action.args;
        switch (action.toolName) {
            case 'createFile':
            case 'create_file':
            case 'write_file':
            case 'editFile':
            case 'edit_file':
            case 'readFile':
            case 'read_file':
            case 'deleteFile':
            case 'delete_file':
                return parsed.path ? [parsed.path] : [];
            case 'readMultipleFiles':
            case 'read_multiple_files':
                return Array.isArray(parsed.paths) ? parsed.paths : [];
            case 'batchCreateFiles':
            case 'batch_create_files':
                return Array.isArray(parsed.files) ? parsed.files.map((f: any) => f.path).filter(Boolean) : [];
            case 'renameFile':
            case 'rename_file':
                return parsed.oldPath ? [`${parsed.oldPath} → ${parsed.newPath}`] : [];
            default:
                return [];
        }
    } catch {
        return [];
    }
}

const ActionRow = memo(function ActionRow({ action, count, isDark, groupedActions }: { action: StreamingAction; count: number; isDark: boolean; groupedActions: StreamingAction[] }) {
    const [showOutput, setShowOutput] = useState(false);
    const active = action.status === 'running' || action.status === 'pending';
    const pair = VERBS[action.toolName];
    const verb = active ? (pair?.[0] ?? action.toolName) : (pair?.[1] ?? action.toolName);
    const ToolIcon = getToolIcon(action.toolName);

    const displaySuffix = FILE_TOOLS.has(action.toolName) && count > 1
        ? `${count} files`
        : action.displayName || '';
    const text = `${verb}${displaySuffix ? ` ${displaySuffix}` : ''}`;

    const hasTerminalOutput = TERMINAL_TOOLS.has(action.toolName) && action.result && !active;

    const allFileDetails: string[] = [];
    if (!active && FILE_TOOLS.has(action.toolName)) {
        for (const a of groupedActions) {
            allFileDetails.push(...getFileDetails(a));
        }
    }
    const hasFileDetails = allFileDetails.length > 0;
    const isExpandable = hasTerminalOutput || hasFileDetails;

    const toggle = useCallback(() => {
        if (isExpandable) setShowOutput(v => !v);
    }, [isExpandable]);

    return (
        <div>
            <div
                className={`flex items-center gap-2 py-[3px] ${isExpandable ? 'cursor-pointer' : ''}`}
                onClick={toggle}
            >
                <span
                    className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center ${
                        action.status === 'error'
                            ? 'text-red-400'
                            : DEPLOY_TOOLS.has(action.toolName) && active
                                ? 'text-amber-400'
                                : active
                                    ? isDark ? 'text-zinc-500' : 'text-gray-400'
                                    : isDark ? 'text-zinc-500' : 'text-gray-400'
                    }`}
                >
                    <ToolIcon
                        className={`h-3.5 w-3.5 ${active ? 'animate-pulse' : ''}`}
                        strokeWidth={2}
                    />
                </span>

                <span
                    className={`text-[13px] truncate ${
                        active
                            ? DEPLOY_TOOLS.has(action.toolName)
                                ? `text-amber-400/90 ${isDark ? '' : ''}`
                                : `text-shimmer ${isDark ? 'text-shimmer-dark' : 'text-shimmer-light'}`
                            : action.status === 'error'
                                ? 'text-red-400/80'
                                : isDark ? 'text-zinc-400' : 'text-gray-500'
                    }`}
                >
                    {text}
                </span>

                {count > 1 && !FILE_TOOLS.has(action.toolName) && (
                    <span className={`text-[11px] flex-shrink-0 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                        x{count}
                    </span>
                )}

                {action.status === 'error' && (
                    <span
                        className="ml-auto flex-shrink-0 text-red-400"
                        aria-label="Action failed"
                        title="Action failed"
                    >
                        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </span>
                )}

                {isExpandable && (
                    <span className={`${action.status === 'error' ? '' : 'ml-auto'} flex-shrink-0 transition-transform duration-150 ${showOutput ? '' : '-rotate-90'} ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                        <ChevronDown className="w-3 h-3" />
                    </span>
                )}
            </div>

            {DEPLOY_TOOLS.has(action.toolName) && active && (
                <div className={`mx-1 mb-1 h-1 overflow-hidden rounded-full ${isDark ? 'bg-amber-950/60' : 'bg-amber-100'}`}>
                    <div className="h-full w-1/3 animate-[deployBar_1.4s_ease-in-out_infinite] rounded-full bg-amber-400" />
                </div>
            )}

            {showOutput && isExpandable && (
                <div>
                    {hasFileDetails && (
                        <div className={`mt-1 mb-2 mx-1 rounded-lg text-[12px] ${isDark ? 'bg-background border border-border' : 'bg-gray-50 border border-gray-200'} py-1.5 px-3`}>
                            {allFileDetails.map((file, i) => (
                                <div key={i} className={`py-0.5 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                                    <span className="block truncate font-mono">{shortFileDetail(file)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {hasTerminalOutput && action.result && (
                        <div className={`mt-1 mb-2 mx-1 rounded-lg text-[12px] font-mono leading-relaxed max-h-[200px] overflow-y-auto scrollbar-hide ${isDark ? 'bg-background text-muted-foreground border border-border' : 'bg-gray-900 text-gray-300 border border-gray-700'} p-3`}>
                            <pre className="whitespace-pre-wrap break-words">{cleanResultForDisplay(action.result).slice(0, 2000)}</pre>
                        </div>
                    )}
                    {DEPLOY_TOOLS.has(action.toolName) && active && action.result && !hasTerminalOutput && (
                        <div className={`mt-1 mb-2 mx-1 rounded-lg text-[12px] ${isDark ? 'text-amber-300/80 bg-amber-950/30 border border-amber-900/40' : 'text-amber-800 bg-amber-50 border border-amber-200'} p-2`}>
                            {cleanResultForDisplay(action.result).slice(0, 500)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

export const ActionsList = memo(function ActionsList({ actions, isLive = false, isDark = true }: ActionsListProps) {
    const [collapsed, setCollapsed] = useState(false);
    const [showAllActions, setShowAllActions] = useState(false);

    const deduplicated = useMemo(() => deduplicateActions(actions), [actions]);
    const hiddenActionCount = Math.max(0, deduplicated.length - INITIAL_VISIBLE_ACTIONS);
    const visibleActions = showAllActions || hiddenActionCount === 0
        ? deduplicated
        : deduplicated.slice(hiddenActionCount);

    if (actions.length === 0) return null;

    const doneN = actions.filter(a => a.status === 'done').length;
    const errN = actions.filter(a => a.status === 'error').length;
    const runningN = actions.filter(a => a.status === 'running' || a.status === 'pending').length;
    const allActionsFinished = (doneN + errN) === actions.length;
    const allGood = doneN === actions.length && !isLive;
    const show = !collapsed;

    return (
        <div className={`my-2 rounded-xl border overflow-hidden ${isDark ? 'bg-card border-border' : 'bg-gray-50 border-gray-200'}`}>
            <button
                onClick={() => setCollapsed(c => !c)}
                className={`w-full flex items-center gap-2 px-3.5 py-2.5 text-[13px] ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-black/[0.02]'} cursor-pointer ${isDark ? 'text-zinc-400' : 'text-gray-500'} transition-colors`}
            >
                <span className={`transition-transform duration-150 ${collapsed ? '-rotate-90' : ''}`}>
                    <ChevronDown className="w-3.5 h-3.5" />
                </span>

                <span className="font-medium">
                    {runningN > 0
                        ? `Running ${runningN} action${runningN !== 1 ? 's' : ''}...`
                        : allGood
                            ? `${actions.length} action${actions.length !== 1 ? 's' : ''}`
                            : errN > 0
                                ? `${doneN} done, ${errN} failed`
                                : `${actions.length} action${actions.length !== 1 ? 's' : ''}`
                    }
                </span>

                {runningN > 0 && (
                    <span className="relative flex h-2 w-2 ml-auto">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400/40 animate-ping" />
                        <span className={`relative inline-flex h-2 w-2 rounded-full ${isDark ? 'bg-blue-400' : 'bg-blue-500'}`} />
                    </span>
                )}

                {allActionsFinished && errN === 0 && runningN === 0 && (
                    <span className="text-emerald-500 ml-auto">
                        <Check className="w-4 h-4" strokeWidth={2.5} />
                    </span>
                )}

                {errN > 0 && allActionsFinished && (
                    <span className="text-red-400 ml-auto">
                        <X className="w-4 h-4" strokeWidth={2.5} />
                    </span>
                )}
            </button>

            {show && (
                <div className="px-3.5 pb-2.5 pt-0.5 space-y-0.5">
                    {!showAllActions && hiddenActionCount > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowAllActions(true)}
                            className={`flex w-full items-center gap-2 py-1 text-[12px] transition-colors ${
                                isDark
                                    ? 'text-zinc-500 hover:text-zinc-300'
                                    : 'text-gray-400 hover:text-gray-600'
                            }`}
                            aria-label={`See ${hiddenActionCount} more action${hiddenActionCount === 1 ? '' : 's'}`}
                        >
                            <ChevronDown className="h-3.5 w-3.5" />
                            <span>See {hiddenActionCount} more</span>
                        </button>
                    )}
                    {visibleActions.map(({ action, count, groupedActions }) => (
                        <ActionRow key={action.id} action={action} count={count} isDark={isDark} groupedActions={groupedActions} />
                    ))}
                </div>
            )}
        </div>
    );
});