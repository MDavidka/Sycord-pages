'use client'
import Editor, { loader, Monaco } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useStore } from '../store';
import { useRef, useCallback, memo } from 'react';
import { FileTypeIcon, getFileNameAccent } from '../lib/file-icons';

loader.config({ monaco });

const getLanguage = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
        ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
        json: 'json', html: 'html', css: 'css', scss: 'scss', md: 'markdown',
        py: 'python', yaml: 'yaml', yml: 'yaml',
    };
    return langMap[ext || ''] || 'plaintext';
};

export const CodeEditor = memo(function CodeEditor() {
    const selectedFile = useStore(s => s.selectedFile);
    const theme = useStore(s => s.theme);
    const isDark = theme === 'dark';
    const monacoRef = useRef<Monaco | null>(null);

    // Read content directly from store without subscribing to all files changes
    const content = useStore(s => s.selectedFile ? s.files[s.selectedFile]?.file.contents : '');

    const handleEditorWillMount = useCallback((monaco: Monaco) => {
        monacoRef.current = monaco;
        monaco.editor.defineTheme('glovix-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#18191B',
                'editor.lineHighlightBackground': '#1a1a1a',
                'editorLineNumber.foreground': '#444444',
                'editorLineNumber.activeForeground': '#888888',
                'editor.selectionBackground': '#264f78',
                'editorWidget.background': '#1a1a1a',
                'editorWidget.border': '#2a2a2a',
                'input.background': '#1a1a1a',
                'dropdown.background': '#1a1a1a',
            }
        });
    }, []);

    const handleChange = useCallback((value: string | undefined) => {
        const file = useStore.getState().selectedFile;
        if (file && value !== undefined) {
            // Mutate in-place to avoid creating a new files object on every keystroke
            const state = useStore.getState();
            const existing = state.files[file];
            if (existing) {
                existing.file.contents = value;
                // Notify store with same reference — only triggers subscribers that check deeply
                useStore.setState({ files: state.files });
            } else {
                state.files[file] = { file: { contents: value } };
                useStore.setState({ files: state.files });
            }
            state.removeErrorsForFile(file);
        }
    }, []);

    if (!selectedFile) {
        return (
            <div className={`h-full flex items-center justify-center ${isDark ? 'bg-[#18191B] text-[#525252]' : 'bg-white text-gray-400'}`}>
                <p>Select a file to edit</p>
            </div>
        );
    }

    const baseName = selectedFile.split('/').pop() || selectedFile;
    const accent = getFileNameAccent(baseName);

    return (
        <div className={`h-full w-full relative flex flex-col ${isDark ? 'bg-[#18191B]' : 'bg-white'}`}>
            {/* Simplified Syra file header — Devicon + accented filename */}
            <div className={`flex h-10 shrink-0 items-center gap-2 border-b px-3 ${isDark ? 'border-white/10 bg-[#18191B]' : 'border-gray-200 bg-white'}`}>
                <FileTypeIcon path={selectedFile} size={16} />
                <span className="truncate font-mono text-[13px] font-medium" style={{ color: accent }}>
                    {baseName}
                </span>
                <span className="ml-auto truncate font-mono text-[11px] text-white/35 max-w-[50%]" title={selectedFile}>
                    {selectedFile.includes('/') ? selectedFile : ''}
                </span>
            </div>
            <div className="min-h-0 flex-1">
                <Editor
                    height="100%"
                    language={getLanguage(selectedFile)}
                    value={content}
                    theme={isDark ? 'glovix-dark' : 'light'}
                    beforeMount={handleEditorWillMount}
                    onChange={handleChange}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineHeight: 20,
                        padding: { top: 16 },
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 2,
                        wordWrap: 'on',
                        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                    }}
                />
            </div>
        </div>
    );
});