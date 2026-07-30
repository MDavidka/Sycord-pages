'use client'
import { useState, useMemo, useRef, useEffect, memo } from 'react';
import { File, Folder, FolderOpen, ChevronRight, ChevronDown, Target, Lock, Scissors, Copy, FileText, FolderPlus, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { writeFile, deleteFile as deleteFileWC, renameFile as renameFileWC } from '../lib/webcontainer';
import { cn } from '@/lib/utils';

interface FileNode {
    name: string;
    path: string;
    type: 'file' | 'folder';
    children: FileNode[];
}

interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    targetPath: string;
    targetType: 'file' | 'folder' | 'root';
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
    css: `${FILE_ICON_BASE}/css3/css3-original.svg`,
    md: `${FILE_ICON_BASE}/markdown/markdown-original.svg`,
    mdx: `${FILE_ICON_BASE}/markdown/markdown-original.svg`,
    json: `${FILE_ICON_BASE}/json/json-original.svg`,
    svg: `${FILE_ICON_BASE}/svg/svg-original.svg`,
};

function FileTypeIcon({ name, isDark }: { name: string; isDark: boolean }) {
    const lower = name.toLowerCase();
    const extension = lower.split('.').pop() || '';
    const url =
        lower === 'package.json'
            ? `${FILE_ICON_BASE}/nodejs/nodejs-original.svg`
            : lower === 'dockerfile' || lower.startsWith('docker-compose')
                ? `${FILE_ICON_BASE}/docker/docker-original.svg`
                : lower.startsWith('next.config')
                    ? `${FILE_ICON_BASE}/nextjs/nextjs-original.svg`
                    : FILE_ICON_URLS[extension];

    if (url) {
        return <img src={url} alt="" aria-hidden="true" className="size-3.5 shrink-0 object-contain opacity-90" />;
    }
    return <File className={cn('size-3.5 shrink-0', isDark ? 'text-muted-foreground' : 'text-gray-400')} />;
}

const buildFileTree = (files: string[]): FileNode[] => {
    const root: FileNode[] = [];
    files.forEach(path => {
        const parts = path.split('/');
        let currentLevel = root;
        parts.forEach((part, index) => {
            const isFile = index === parts.length - 1;
            const existingNode = currentLevel.find(node => node.name === part);
            if (existingNode) {
                if (existingNode.type === 'folder') {
                    currentLevel = existingNode.children;
                }
            } else {
                const newNode: FileNode = { name: part, path: parts.slice(0, index + 1).join('/'), type: isFile ? 'file' : 'folder', children: [] };
                currentLevel.push(newNode);
                if (!isFile) currentLevel = newNode.children;
            }
        });
    });
    const sortNodes = (nodes: FileNode[]) => {
        nodes.sort((a, b) => { if (a.type === b.type) return a.name.localeCompare(b.name); return a.type === 'folder' ? -1 : 1; });
        nodes.forEach(node => { if (node.children.length > 0) sortNodes(node.children); });
    };
    sortNodes(root);
    return root;
};

const FileTreeNode = memo(({
    node,
    level,
    selectedFile,
    onSelect,
    isDark,
    onContextMenu,
    renamingPath,
    onRenameSubmit,
    onRenameCancel,
}: {
    node: FileNode;
    level: number;
    selectedFile: string | null;
    onSelect: (path: string) => void;
    isDark: boolean;
    onContextMenu: (e: React.MouseEvent, path: string, type: 'file' | 'folder') => void;
    renamingPath: string | null;
    onRenameSubmit: (oldPath: string, newName: string) => void;
    onRenameCancel: () => void;
}) => {
    const [isOpen, setIsOpen] = useState(level < 2);
    const [renameValue, setRenameValue] = useState(node.name);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (renamingPath === node.path && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [renamingPath, node.path]);

    const handleRenameKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            onRenameSubmit(node.path, renameValue);
        } else if (e.key === 'Escape') {
            onRenameCancel();
        }
    };

    const rowClass = cn(
        'group flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[12px] leading-none cursor-pointer transition-colors',
        selectedFile === node.path
            ? isDark
                ? 'bg-an-tool-background text-an-tool-color'
                : 'bg-blue-50 text-blue-900'
            : isDark
                ? 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground'
                : 'text-gray-600 hover:bg-black/[0.04] hover:text-gray-900',
    );

    if (node.type === 'file') {
        return (
            <div
                onClick={() => onSelect(node.path)}
                onContextMenu={(e) => onContextMenu(e, node.path, 'file')}
                className={rowClass}
                style={{ paddingLeft: `${level * 10 + 6}px` }}
                title={node.path}
            >
                <FileTypeIcon name={node.name} isDark={isDark} />
                {renamingPath === node.path ? (
                    <input
                        ref={inputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={handleRenameKeyDown}
                        onBlur={() => onRenameCancel()}
                        className={cn(
                            'h-5 min-w-0 flex-1 rounded border bg-transparent px-1 text-[12px] outline-none',
                            isDark ? 'border-[#444] text-white' : 'border-gray-300 text-gray-900',
                        )}
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span className="truncate font-[450]">{node.name}</span>
                )}
            </div>
        );
    }

    return (
        <div>
            <div
                onClick={() => setIsOpen(!isOpen)}
                onContextMenu={(e) => onContextMenu(e, node.path, 'folder')}
                className={rowClass}
                style={{ paddingLeft: `${level * 10 + 6}px` }}
                title={node.path}
            >
                {isOpen
                    ? <ChevronDown className="size-3 shrink-0 opacity-70" />
                    : <ChevronRight className="size-3 shrink-0 opacity-70" />}
                {isOpen
                    ? <FolderOpen className="size-3.5 shrink-0 text-sky-400" />
                    : <Folder className="size-3.5 shrink-0 text-sky-400" />}
                {renamingPath === node.path ? (
                    <input
                        ref={inputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={handleRenameKeyDown}
                        onBlur={() => onRenameCancel()}
                        className={cn(
                            'h-5 min-w-0 flex-1 rounded border bg-transparent px-1 text-[12px] outline-none',
                            isDark ? 'border-[#444] text-white' : 'border-gray-300 text-gray-900',
                        )}
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span className="truncate font-medium">{node.name}</span>
                )}
            </div>
            {isOpen && node.children.map(child => (
                <FileTreeNode
                    key={child.path}
                    node={child}
                    level={level + 1}
                    selectedFile={selectedFile}
                    onSelect={onSelect}
                    isDark={isDark}
                    onContextMenu={onContextMenu}
                    renamingPath={renamingPath}
                    onRenameSubmit={onRenameSubmit}
                    onRenameCancel={onRenameCancel}
                />
            ))}
        </div>
    );
});

export function FileExplorer() {
    const files = useStore(s => s.files);
    const setFiles = useStore(s => s.setFiles);
    const selectedFile = useStore(s => s.selectedFile);
    const setSelectedFile = useStore(s => s.setSelectedFile);
    const theme = useStore(s => s.theme);
    const isDark = theme === 'dark';

    const fileKeys = useMemo(() => Object.keys(files).filter(f => f !== 'glovix-picker.js').sort().join('\n'), [files]);
    const fileTree = useMemo(() => buildFileTree(Object.keys(files).filter(f => f !== 'glovix-picker.js')), [fileKeys]);
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, targetPath: '', targetType: 'root' });
    const [renamingPath, setRenamingPath] = useState<string | null>(null);
    const [newItemType, setNewItemType] = useState<'file' | 'folder' | null>(null);
    const [newItemParent, setNewItemParent] = useState<string>('');
    const [newItemName, setNewItemName] = useState('');
    const [, setClipboard] = useState<{ path: string; action: 'cut' | 'copy' } | null>(null);
    const newItemInputRef = useRef<HTMLInputElement>(null);
    const fileCount = useMemo(() => Object.keys(files).filter(f => f !== 'glovix-picker.js').length, [fileKeys]);

    useEffect(() => {
        if (newItemType && newItemInputRef.current) {
            newItemInputRef.current.focus();
        }
    }, [newItemType]);

    useEffect(() => {
        const handleClick = () => setContextMenu(prev => ({ ...prev, visible: false }));
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    const handleContextMenu = (e: React.MouseEvent, path: string = '', type: 'file' | 'folder' | 'root' = 'root') => {
        e.preventDefault();
        e.stopPropagation();

        const menuWidth = 180;
        const menuHeight = type === 'root' ? 88 : 320;

        let x = e.clientX;
        let y = e.clientY;

        if (x + menuWidth > window.innerWidth) {
            x = window.innerWidth - menuWidth - 10;
        }
        if (y + menuHeight > window.innerHeight) {
            y = window.innerHeight - menuHeight - 10;
        }

        setContextMenu({ visible: true, x, y, targetPath: path, targetType: type });
    };

    const handleNewFile = () => {
        const parent = contextMenu.targetType === 'folder' ? contextMenu.targetPath :
                       contextMenu.targetType === 'file' ? contextMenu.targetPath.split('/').slice(0, -1).join('/') : '';
        setNewItemParent(parent);
        setNewItemType('file');
        setNewItemName('');
        setContextMenu(prev => ({ ...prev, visible: false }));
    };

    const handleNewFolder = () => {
        const parent = contextMenu.targetType === 'folder' ? contextMenu.targetPath :
                       contextMenu.targetType === 'file' ? contextMenu.targetPath.split('/').slice(0, -1).join('/') : '';
        setNewItemParent(parent);
        setNewItemType('folder');
        setNewItemName('');
        setContextMenu(prev => ({ ...prev, visible: false }));
    };

    const handleNewItemSubmit = async () => {
        if (!newItemName.trim()) {
            setNewItemType(null);
            return;
        }
        const newPath = newItemParent ? `${newItemParent}/${newItemName}` : newItemName;

        if (newItemType === 'file') {
            await writeFile(newPath, '');
            setFiles({ ...files, [newPath]: { file: { contents: '' } } });
            setSelectedFile(newPath);
        } else {
            const placeholderPath = `${newPath}/.gitkeep`;
            await writeFile(placeholderPath, '');
            setFiles({ ...files, [placeholderPath]: { file: { contents: '' } } });
        }
        setNewItemType(null);
    };

    const handleDelete = async () => {
        const path = contextMenu.targetPath;
        if (!path) return;

        if (path === '.glovix' || path.startsWith('.glovix/')) {
            setContextMenu(prev => ({ ...prev, visible: false }));
            return;
        }

        const newFiles = { ...files };

        if (contextMenu.targetType === 'folder') {
            Object.keys(newFiles).forEach(filePath => {
                if (filePath.startsWith(path + '/') || filePath === path) {
                    delete newFiles[filePath];
                }
            });
        } else {
            delete newFiles[path];
            try {
                await deleteFileWC(path);
            } catch (e) {
                console.error('Failed to delete file:', e);
            }
        }

        setFiles(newFiles);
        if (selectedFile === path || selectedFile?.startsWith(path + '/')) {
            setSelectedFile(null);
        }
        setContextMenu(prev => ({ ...prev, visible: false }));
    };

    const handleRename = () => {
        setRenamingPath(contextMenu.targetPath);
        setContextMenu(prev => ({ ...prev, visible: false }));
    };

    const handleRenameSubmit = async (oldPath: string, newName: string) => {
        if (!newName.trim() || newName === oldPath.split('/').pop()) {
            setRenamingPath(null);
            return;
        }

        const parentPath = oldPath.split('/').slice(0, -1).join('/');
        const newPath = parentPath ? `${parentPath}/${newName}` : newName;

        const newFiles = { ...files };
        const content = newFiles[oldPath]?.file.contents || '';
        delete newFiles[oldPath];
        newFiles[newPath] = { file: { contents: content } };

        try {
            await renameFileWC(oldPath, newPath);
        } catch (e) {
            console.error('Failed to rename file:', e);
        }

        setFiles(newFiles);
        if (selectedFile === oldPath) {
            setSelectedFile(newPath);
        }
        setRenamingPath(null);
    };

    const handleCut = () => {
        setClipboard({ path: contextMenu.targetPath, action: 'cut' });
        setContextMenu(prev => ({ ...prev, visible: false }));
    };

    const handleCopy = () => {
        setClipboard({ path: contextMenu.targetPath, action: 'copy' });
        setContextMenu(prev => ({ ...prev, visible: false }));
    };

    const handleCopyPath = () => {
        navigator.clipboard.writeText(contextMenu.targetPath);
        setContextMenu(prev => ({ ...prev, visible: false }));
    };

    const handleCopyRelativePath = () => {
        navigator.clipboard.writeText('./' + contextMenu.targetPath);
        setContextMenu(prev => ({ ...prev, visible: false }));
    };

    const menuItemClass = cn(
        'flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left text-[12px]',
        isDark ? 'text-foreground/80 hover:bg-accent' : 'text-gray-700 hover:bg-gray-50',
    );

    return (
        <div
            className={cn(
                'custom-scrollbar h-full overflow-y-auto px-1.5 py-1.5 font-[family-name:var(--font-agent-sans)]',
                isDark ? 'text-muted-foreground' : 'text-gray-600',
            )}
            onContextMenu={(e) => handleContextMenu(e, '', 'root')}
        >
            <div className={cn(
                'mb-1.5 flex items-center justify-between px-1.5 text-[10px] font-semibold uppercase tracking-[0.08em]',
                isDark ? 'text-muted-foreground/60' : 'text-gray-400',
            )}>
                <span>Files</span>
                <span className="normal-case tracking-normal tabular-nums opacity-80">{fileCount}</span>
            </div>

            {Object.keys(files).length === 0 && !newItemType && (
                <div className={cn('px-1.5 text-[12px] italic', isDark ? 'text-muted-foreground/60' : 'text-gray-400')}>No files</div>
            )}

            {newItemType && !newItemParent && (
                <div className="mb-0.5 flex h-7 items-center gap-1.5 px-1.5">
                    {newItemType === 'file' ? (
                        <File className={cn('size-3.5 shrink-0', isDark ? 'text-muted-foreground' : 'text-gray-400')} />
                    ) : (
                        <Folder className="size-3.5 shrink-0 text-sky-400" />
                    )}
                    <input
                        ref={newItemInputRef}
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleNewItemSubmit();
                            if (e.key === 'Escape') setNewItemType(null);
                        }}
                        onBlur={() => setNewItemType(null)}
                        placeholder={newItemType === 'file' ? 'filename.ext' : 'folder name'}
                        className={cn(
                            'h-5 min-w-0 flex-1 rounded border bg-transparent px-1 text-[12px] outline-none',
                            isDark ? 'border-[#444] text-white placeholder:text-[#555]' : 'border-gray-300 text-gray-900',
                        )}
                    />
                </div>
            )}

            {fileTree.map(node => (
                <FileTreeNode
                    key={node.path}
                    node={node}
                    level={0}
                    selectedFile={selectedFile}
                    onSelect={setSelectedFile}
                    isDark={isDark}
                    onContextMenu={handleContextMenu}
                    renamingPath={renamingPath}
                    onRenameSubmit={handleRenameSubmit}
                    onRenameCancel={() => setRenamingPath(null)}
                />
            ))}

            {contextMenu.visible && (
                <div
                    className={cn(
                        'fixed z-50 min-w-[168px] overflow-hidden rounded-an-tool-border-radius border shadow-xl',
                        isDark ? 'border-an-tool-border-color bg-an-tool-background' : 'border-gray-200 bg-white',
                    )}
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className={cn('py-0.5', isDark ? 'border-b border-border' : 'border-b border-gray-100')}>
                        <button onClick={handleNewFile} className={menuItemClass}>
                            <FileText className="size-3.5 opacity-70" />
                            New file…
                        </button>
                        <button onClick={handleNewFolder} className={menuItemClass}>
                            <FolderPlus className="size-3.5 opacity-70" />
                            New folder…
                        </button>
                    </div>

                    {contextMenu.targetType !== 'root' && (
                        <div className={cn('py-0.5', isDark ? 'border-b border-border' : 'border-b border-gray-100')}>
                            <button className={menuItemClass}>
                                <Target className="size-3.5" />
                                Target file
                            </button>
                            <button className={menuItemClass}>
                                <Lock className="size-3.5" />
                                Lock file
                            </button>
                        </div>
                    )}

                    {contextMenu.targetType !== 'root' && (
                        <div className={cn('py-0.5', isDark ? 'border-b border-border' : 'border-b border-gray-100')}>
                            <button onClick={handleCut} className={menuItemClass}>
                                <Scissors className="size-3.5 opacity-70" />
                                Cut
                            </button>
                            <button onClick={handleCopy} className={menuItemClass}>
                                <Copy className="size-3.5 opacity-70" />
                                Copy
                            </button>
                        </div>
                    )}

                    {contextMenu.targetType !== 'root' && (
                        <div className={cn('py-0.5', isDark ? 'border-b border-border' : 'border-b border-gray-100')}>
                            <button onClick={handleCopyPath} className={menuItemClass}>
                                <span className="w-3.5" />
                                Copy path
                            </button>
                            <button onClick={handleCopyRelativePath} className={menuItemClass}>
                                <span className="w-3.5" />
                                Copy relative path
                            </button>
                        </div>
                    )}

                    {contextMenu.targetType !== 'root' && (
                        <div className="py-0.5">
                            <button onClick={handleRename} className={menuItemClass}>
                                <span className="w-3.5" />
                                Rename…
                            </button>
                            {contextMenu.targetPath !== '.glovix' && !contextMenu.targetPath.startsWith('.glovix/') && (
                                <button onClick={handleDelete} className={cn(menuItemClass, 'text-red-400')}>
                                    <Trash2 className="size-3.5 opacity-70" />
                                    Delete
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
