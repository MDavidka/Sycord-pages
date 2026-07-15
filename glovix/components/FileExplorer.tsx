'use client'
import { useState, useMemo, useRef, useEffect, memo } from 'react';
import { Folder, FolderOpen, ChevronRight, ChevronDown, Target, Lock, Scissors, Copy, FileText, FolderPlus, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { writeFile, deleteFile as deleteFileWC, renameFile as renameFileWC } from '../lib/webcontainer';
import { FileTypeIcon } from '../lib/file-icons';

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
    onRenameCancel
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
    const [isOpen, setIsOpen] = useState(true);
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

    if (node.type === 'file') {
        return (
            <div
                onClick={() => onSelect(node.path)}
                onContextMenu={(e) => onContextMenu(e, node.path, 'file')}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                    selectedFile === node.path
                        ? isDark ? 'bg-accent text-white' : 'bg-blue-100 text-blue-900'
                        : isDark ? 'text-muted-foreground hover:bg-accent hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
            >
                <FileTypeIcon path={node.path} size={14} className="flex-shrink-0" />
                {renamingPath === node.path ? (
                    <input
                        ref={inputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={handleRenameKeyDown}
                        onBlur={() => onRenameCancel()}
                        className={`flex-1 bg-transparent border rounded px-1 text-sm outline-none ${isDark ? 'border-[#444] text-white' : 'border-gray-300 text-gray-900'}`}
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span className="truncate text-sm">{node.name}</span>
                )}
            </div>
        );
    }

    return (
        <div>
            <div
                onClick={() => setIsOpen(!isOpen)}
                onContextMenu={(e) => onContextMenu(e, node.path, 'folder')}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${isDark ? 'text-muted-foreground hover:bg-accent hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
            >
                {isOpen ? <ChevronDown className="w-3 h-3 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 flex-shrink-0" />}
                {isOpen ? <FolderOpen className="w-4 h-4 text-blue-400 flex-shrink-0" /> : <Folder className="w-4 h-4 text-blue-400 flex-shrink-0" />}
                {renamingPath === node.path ? (
                    <input
                        ref={inputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={handleRenameKeyDown}
                        onBlur={() => onRenameCancel()}
                        className={`flex-1 bg-transparent border rounded px-1 text-sm outline-none ${isDark ? 'border-[#444] text-white' : 'border-gray-300 text-gray-900'}`}
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span className="truncate font-medium text-sm">{node.name}</span>
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

    // Only rebuild tree when file keys change (not content)
    const fileKeys = useMemo(() => Object.keys(files).filter(f => f !== 'glovix-picker.js').sort().join('\n'), [files]);
    const fileTree = useMemo(() => buildFileTree(Object.keys(files).filter(f => f !== 'glovix-picker.js')), [fileKeys]);
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, targetPath: '', targetType: 'root' });
    const [renamingPath, setRenamingPath] = useState<string | null>(null);
    const [newItemType, setNewItemType] = useState<'file' | 'folder' | null>(null);
    const [newItemParent, setNewItemParent] = useState<string>('');
    const [newItemName, setNewItemName] = useState('');
    const [, setClipboard] = useState<{ path: string; action: 'cut' | 'copy' } | null>(null);
    const newItemInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (newItemType && newItemInputRef.current) {
            newItemInputRef.current.focus();
        }
    }, [newItemType]);

    // Close context menu on click outside
    useEffect(() => {
        const handleClick = () => setContextMenu(prev => ({ ...prev, visible: false }));
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    const handleContextMenu = (e: React.MouseEvent, path: string = '', type: 'file' | 'folder' | 'root' = 'root') => {
        e.preventDefault();
        e.stopPropagation();
        
        // Calculate position to keep menu within viewport
        const menuWidth = 200;
        const menuHeight = type === 'root' ? 100 : 380;
        
        let x = e.clientX;
        let y = e.clientY;
        
        // Adjust if menu would go off right edge
        if (x + menuWidth > window.innerWidth) {
            x = window.innerWidth - menuWidth - 10;
        }
        
        // Adjust if menu would go off bottom edge
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
            // For folder, create a placeholder file
            const placeholderPath = `${newPath}/.gitkeep`;
            await writeFile(placeholderPath, '');
            setFiles({ ...files, [placeholderPath]: { file: { contents: '' } } });
        }
        setNewItemType(null);
    };

    const handleDelete = async () => {
        const path = contextMenu.targetPath;
        if (!path) return;

        // Protect .glovix directory from deletion
        if (path === '.glovix' || path.startsWith('.glovix/')) {
            setContextMenu(prev => ({ ...prev, visible: false }));
            return;
        }
        
        const newFiles = { ...files };
        
        if (contextMenu.targetType === 'folder') {
            // Delete all files in folder
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

    return (
        <div 
            className={`h-full p-2 overflow-y-auto text-sm custom-scrollbar ${isDark ? 'text-muted-foreground' : 'text-gray-600'}`}
            onContextMenu={(e) => handleContextMenu(e, '', 'root')}
        >
            <div className={`font-semibold mb-2 px-2 text-xs uppercase tracking-wider ${isDark ? 'text-muted-foreground/60' : 'text-gray-400'}`}>Files</div>
            
            {Object.keys(files).length === 0 && !newItemType && (
                <div className={`italic px-2 ${isDark ? 'text-muted-foreground/60' : 'text-gray-400'}`}>No files</div>
            )}
            
            {/* New item input at root level */}
            {newItemType && !newItemParent && (
                <div className="flex items-center gap-2 px-2 py-1.5" style={{ paddingLeft: '8px' }}>
                    {newItemType === 'file' ? (
                        <FileTypeIcon path={newItemName || 'file.txt'} size={14} className="flex-shrink-0" />
                    ) : (
                        <Folder className="w-4 h-4 text-blue-400 flex-shrink-0" />
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
                        className={`flex-1 bg-transparent border rounded px-1 text-sm outline-none ${isDark ? 'border-[#444] text-white placeholder:text-[#555]' : 'border-gray-300 text-gray-900'}`}
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

            {/* Context Menu */}
            {contextMenu.visible && (
                <div 
                    className={`fixed z-50 min-w-[180px] rounded-lg overflow-hidden shadow-xl ${isDark ? 'bg-card border border-border' : 'bg-white border border-gray-200'}`}
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* New file/folder */}
                    <div className={`py-1 ${isDark ? 'border-b border-border' : 'border-b border-gray-100'}`}>
                        <button onClick={handleNewFile} className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3 ${isDark ? 'text-foreground/80 hover:bg-accent' : 'text-gray-700 hover:bg-gray-50'}`}>
                            <FileText className="w-4 h-4 opacity-0" />
                            New file...
                        </button>
                        <button onClick={handleNewFolder} className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3 ${isDark ? 'text-foreground/80 hover:bg-accent' : 'text-gray-700 hover:bg-gray-50'}`}>
                            <FolderPlus className="w-4 h-4 opacity-0" />
                            New folder...
                        </button>
                    </div>

                    {/* Target/Lock */}
                    {contextMenu.targetType !== 'root' && (
                        <div className={`py-1 ${isDark ? 'border-b border-border' : 'border-b border-gray-100'}`}>
                            <button className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3 ${isDark ? 'text-foreground/80 hover:bg-accent' : 'text-gray-700 hover:bg-gray-50'}`}>
                                <Target className="w-4 h-4" />
                                Target file
                            </button>
                            <button className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3 ${isDark ? 'text-foreground/80 hover:bg-accent' : 'text-gray-700 hover:bg-gray-50'}`}>
                                <Lock className="w-4 h-4" />
                                Lock file
                            </button>
                        </div>
                    )}

                    {/* Cut/Copy */}
                    {contextMenu.targetType !== 'root' && (
                        <div className={`py-1 ${isDark ? 'border-b border-border' : 'border-b border-gray-100'}`}>
                            <button onClick={handleCut} className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3 ${isDark ? 'text-foreground/80 hover:bg-accent' : 'text-gray-700 hover:bg-gray-50'}`}>
                                <Scissors className="w-4 h-4 opacity-0" />
                                Cut
                            </button>
                            <button onClick={handleCopy} className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3 ${isDark ? 'text-foreground/80 hover:bg-accent' : 'text-gray-700 hover:bg-gray-50'}`}>
                                <Copy className="w-4 h-4 opacity-0" />
                                Copy
                            </button>
                        </div>
                    )}

                    {/* Copy path */}
                    {contextMenu.targetType !== 'root' && (
                        <div className={`py-1 ${isDark ? 'border-b border-border' : 'border-b border-gray-100'}`}>
                            <button onClick={handleCopyPath} className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3 ${isDark ? 'text-foreground/80 hover:bg-accent' : 'text-gray-700 hover:bg-gray-50'}`}>
                                <span className="w-4" />
                                Copy path
                            </button>
                            <button onClick={handleCopyRelativePath} className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3 ${isDark ? 'text-foreground/80 hover:bg-accent' : 'text-gray-700 hover:bg-gray-50'}`}>
                                <span className="w-4" />
                                Copy relative path
                            </button>
                        </div>
                    )}

                    {/* Rename/Delete */}
                    {contextMenu.targetType !== 'root' && (
                        <div className="py-1">
                            <button onClick={handleRename} className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3 ${isDark ? 'text-foreground/80 hover:bg-accent' : 'text-gray-700 hover:bg-gray-50'}`}>
                                <span className="w-4" />
                                Rename...
                            </button>
                            {contextMenu.targetPath !== '.glovix' && !contextMenu.targetPath.startsWith('.glovix/') && (
                                <button onClick={handleDelete} className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3 text-red-400 ${isDark ? 'hover:bg-accent' : 'hover:bg-gray-50'}`}>
                                    <Trash2 className="w-4 h-4 opacity-0" />
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