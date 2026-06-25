'use client'
import { useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useStore } from '../store';
import { startShell, writeToShell, resizeShell } from '../lib/webcontainer';

export function Terminal() {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const shellStartedRef = useRef(false);
    const isDisposedRef = useRef(false);
    const lastOutputIndex = useRef(0);

    const terminalOutput = useStore(s => s.terminalOutput);
    const theme = useStore(s => s.theme);
    const isDark = theme === 'dark';

    // Buffer for sending shell output to error parser (debounced)
    const shellBufferRef = useRef('');
    const shellParseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const flushShellErrors = useCallback(() => {
        const buf = shellBufferRef.current;
        if (!buf) return;
        shellBufferRef.current = '';
        try {
            useStore.getState().parseOutputForErrors(buf);
        } catch { /* ignore */ }
    }, []);

    const darkTheme = {
        background: '#18191B',
        foreground: '#d4d4d4',
        cursor: '#528bff',
        cursorAccent: '#18191B',
        selectionBackground: '#264f78',
        selectionForeground: '#ffffff',
        black: '#18191B',
        brightBlack: '#5a5a5a',
        red: '#f44747',
        brightRed: '#f97583',
        green: '#4ec9b0',
        brightGreen: '#56d364',
        yellow: '#e5c07b',
        brightYellow: '#e2c08d',
        blue: '#528bff',
        brightBlue: '#79c0ff',
        magenta: '#c678dd',
        brightMagenta: '#d2a8ff',
        cyan: '#56b6c2',
        brightCyan: '#76e4f7',
        white: '#d4d4d4',
        brightWhite: '#ffffff',
    };

    const lightTheme = {
        background: '#ffffff',
        foreground: '#24292e',
        cursor: '#0366d6',
        cursorAccent: '#ffffff',
        selectionBackground: '#0366d633',
        selectionForeground: '#24292e',
        black: '#24292e',
        brightBlack: '#6a737d',
        red: '#d73a49',
        brightRed: '#cb2431',
        green: '#22863a',
        brightGreen: '#28a745',
        yellow: '#b08800',
        brightYellow: '#dbab09',
        blue: '#0366d6',
        brightBlue: '#2188ff',
        magenta: '#6f42c1',
        brightMagenta: '#8a63d2',
        cyan: '#1b7c83',
        brightCyan: '#3192aa',
        white: '#d1d5da',
        brightWhite: '#fafbfc',
    };

    // Fit terminal to container
    const fitTerminal = useCallback(() => {
        if (isDisposedRef.current) return;
        try {
            if (terminalRef.current && xtermRef.current && fitAddonRef.current) {
                const el = xtermRef.current.element;
                if (!el || !el.offsetParent) return;
                const rect = terminalRef.current.getBoundingClientRect();
                if (rect.width > 20 && rect.height > 20) {
                    fitAddonRef.current.fit();
                    resizeShell(xtermRef.current.cols, xtermRef.current.rows);
                }
            }
        } catch {
            // Ignore fit errors
        }
    }, []);

    // ── Initialize terminal — runs once ──────────────────────
    useEffect(() => {
        if (!terminalRef.current) return;

        isDisposedRef.current = false;

        const term = new XTerminal({
            theme: isDark ? darkTheme : lightTheme,
            fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, Monaco, "Courier New", monospace',
            fontSize: 13,
            lineHeight: 1.0,
            letterSpacing: 0,
            cursorBlink: true,
            cursorStyle: 'bar',
            cursorWidth: 2,
            convertEol: true,
            allowProposedApi: true,
            scrollback: 5000,
            smoothScrollDuration: 0,
            minimumContrastRatio: 4.5,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        fitAddonRef.current = fitAddon;

        term.open(terminalRef.current);
        xtermRef.current = term;

        // Restore terminal history from store
        const currentOutput = useStore.getState().terminalOutput;
        if (currentOutput.length > 0) {
            currentOutput.forEach(output => {
                if (!isDisposedRef.current) term.write(output);
            });
            lastOutputIndex.current = currentOutput.length;
        }

        // Fit after layout settles
        const fitTimeout = setTimeout(fitTerminal, 150);

        // Start interactive shell (once)
        if (!shellStartedRef.current) {
            shellStartedRef.current = true;

            startShell((data) => {
                if (!xtermRef.current || isDisposedRef.current) return;

                // Write ALL shell output directly to xterm — no filtering.
                // Interactive shell needs raw pass-through for prompts,
                // cursor movement, colors, etc.
                xtermRef.current.write(data);

                // Also buffer for error parsing (debounced)
                shellBufferRef.current += data;
                if (shellParseTimerRef.current) clearTimeout(shellParseTimerRef.current);
                shellParseTimerRef.current = setTimeout(flushShellErrors, 500);
            }).catch((err) => {
                console.error('[Terminal] Shell failed:', err);
                if (xtermRef.current && !isDisposedRef.current) {
                    xtermRef.current.write(`\r\n\x1b[31mShell failed to start: ${err.message}\x1b[0m\r\n`);
                }
            });
        }

        // User input → shell
        const dataHandler = term.onData((data) => {
            if (!isDisposedRef.current) writeToShell(data);
        });

        // Auto-fit on container resize
        let resizeTimeout: ReturnType<typeof setTimeout>;
        const resizeObserver = new ResizeObserver(() => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(fitTerminal, 50);
        });
        if (terminalRef.current) resizeObserver.observe(terminalRef.current);

        const handleWindowResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(fitTerminal, 100);
        };
        window.addEventListener('resize', handleWindowResize);

        return () => {
            isDisposedRef.current = true;
            clearTimeout(fitTimeout);
            clearTimeout(resizeTimeout);
            if (shellParseTimerRef.current) clearTimeout(shellParseTimerRef.current);
            dataHandler.dispose();
            resizeObserver.disconnect();
            window.removeEventListener('resize', handleWindowResize);
            setTimeout(() => { try { term.dispose(); } catch {} }, 50);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Write AI command output to terminal (from store) ──
    useEffect(() => {
        if (xtermRef.current && !isDisposedRef.current) {
            for (let i = lastOutputIndex.current; i < terminalOutput.length; i++) {
                xtermRef.current.write(terminalOutput[i]);
            }
            lastOutputIndex.current = terminalOutput.length;
        }
    }, [terminalOutput]);

    // Update theme
    useEffect(() => {
        if (xtermRef.current && !isDisposedRef.current) {
            xtermRef.current.options.theme = isDark ? darkTheme : lightTheme;
        }
    }, [isDark]); // eslint-disable-line react-hooks/exhaustive-deps

    // Re-fit when terminal tab becomes visible
    useEffect(() => {
        const timer = setTimeout(fitTerminal, 200);
        return () => clearTimeout(timer);
    }, [fitTerminal]);

    return (
        <div
            className="h-full w-full overflow-hidden"
            style={{ backgroundColor: isDark ? '#18191B' : '#ffffff' }}
        >
            <div
                ref={terminalRef}
                onClick={() => xtermRef.current?.focus()}
                className="h-full w-full cursor-text"
            />
        </div>
    );
}