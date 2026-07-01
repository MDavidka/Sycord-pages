'use client'
import { useState, useMemo, memo, useCallback } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    editFile:          ['Editing', 'Edited'],
    readFile:          ['Reading', 'Read'],
    readMultipleFiles: ['Reading', 'Read'],
    deleteFile:        ['Deleting', 'Deleted'],
    renameFile:        ['Renaming', 'Renamed'],
    searchInFiles:     ['Searching', 'Searched'],
    typeCheck:         ['Checking types', 'Type checked'],
    createWorkspace:   ['Creating Syte workspace', 'Workspace ready'],
    executeCommand:    ['Running command', 'Command finished'],
    lintCheck:         ['Linting', 'Linted'],
    listFiles:         ['Listing files', 'Listed files'],
    drawDiagram:       ['Drawing diagram', 'Drew diagram'],
    batchCreateFiles:  ['Creating files', 'Created files'],
    getErrors:         ['Checking errors', 'Checked errors'],
    deploy:            ['Deploying to sycord.site', 'Deployed to sycord.site'],
    save:              ['Saving to GitHub', 'Saved to GitHub'],
};

const DEPLOY_TOOLS = new Set(['deploy']);
const TERMINAL_TOOLS = new Set(['typeCheck', 'lintCheck', 'getErrors', 'executeCommand']);
const FILE_TOOLS = new Set(['createFile', 'editFile', 'readFile', 'readMultipleFiles', 'deleteFile', 'renameFile', 'batchCreateFiles']);

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
            case 'editFile':
            case 'readFile':
            case 'deleteFile':
                return parsed.path ? [parsed.path] : [];
            case 'readMultipleFiles':
                return Array.isArray(parsed.paths) ? parsed.paths : [];
            case 'batchCreateFiles':
                return Array.isArray(parsed.files) ? parsed.files.map((f: any) => f.path).filter(Boolean) : [];
            case 'renameFile':
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
                {action.status === 'done' ? (
                    <span className="text-emerald-500 flex-shrink-0">
                        <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                    </span>
                ) : action.status === 'error' ? (
                    <span className="text-red-400 flex-shrink-0">
                        <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                    </span>
                ) : DEPLOY_TOOLS.has(action.toolName) && active ? (
                    <span className="relative flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/50" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                    </span>
                ) : (
                    <span className="w-3.5 flex-shrink-0" />
                )}

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

                {isExpandable && (
                    <span className={`ml-auto flex-shrink-0 transition-transform duration-150 ${showOutput ? '' : '-rotate-90'} ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
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
                                <div key={i} className={`flex items-center gap-2 py-0.5 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                                    <span className="opacity-40 text-[10px]">{'›'}</span>
                                    <span className="font-mono truncate">{file}</span>
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

    const deduplicated = useMemo(() => deduplicateActions(actions), [actions]);

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
                <div className={`px-3.5 pb-2.5 pt-0.5 space-y-0.5 border-t ${isDark ? 'border-border' : 'border-gray-200'}`}>
                    {deduplicated.map(({ action, count, groupedActions }) => (
                        <ActionRow key={action.id} action={action} count={count} isDark={isDark} groupedActions={groupedActions} />
                    ))}
                </div>
            )}
        </div>
    );
});