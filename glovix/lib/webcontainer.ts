import { WebContainer, FileSystemTree, DirectoryNode, PreviewMessageType } from '@webcontainer/api';

import { useStore } from '../store';
import { getPageCoepMode } from './coep';

declare global {
    interface Window {
        _webContainerInstance: WebContainer;
        _bootPromise: Promise<WebContainer>;
    }
}

let webContainerInstance: WebContainer | null = null;
let cachedPreviewUrl: string | null = null;
let previewListenerRegistered = false;

/** Last URL emitted by WebContainer's server-ready event (survives store resets). */
export function getCachedPreviewUrl(): string | null {
    return cachedPreviewUrl;
}

function registerPreviewListener(instance: WebContainer) {
    if (previewListenerRegistered) return;
    previewListenerRegistered = true;
    instance.on('server-ready', (port, url) => {
        console.log('[WebContainer] Server ready on port', port, '→', url);
        cachedPreviewUrl = url;
        useStore.getState().setPreviewUrl(url);
    });
    instance.on('preview-message', (message) => {
        if (message.type === PreviewMessageType.ConsoleError) {
            console.warn('[WebContainer preview] console.error:', ...message.args);
        } else if (message.type === PreviewMessageType.UncaughtException) {
            console.warn('[WebContainer preview] Uncaught exception:', message.message);
        } else if (message.type === PreviewMessageType.UnhandledRejection) {
            console.warn('[WebContainer preview] Unhandled rejection:', message.message);
        }
    });
}

export async function getWebContainer() {
    if (webContainerInstance) {
        registerPreviewListener(webContainerInstance);
        return webContainerInstance;
    }
    if (window._webContainerInstance) {
        webContainerInstance = window._webContainerInstance;
        registerPreviewListener(webContainerInstance);
        return webContainerInstance;
    }

    if (!window._bootPromise) {
        window._bootPromise = WebContainer.boot({
            coep: getPageCoepMode(),
            // Keep preview errors inside WebContainer; forwarding causes generic
            // cross-origin "Script error." spam in parent/Eruda consoles.
            forwardPreviewErrors: false,
        })
            .then(async (instance) => {
                window._webContainerInstance = instance;
                webContainerInstance = instance;
                registerPreviewListener(instance);
                // Ensure .glovix system directory exists from the start
                try { await instance.fs.mkdir('.glovix', { recursive: true }); } catch { /* ok */ }
                return instance;
            })
            .catch((error: any) => {
                console.error('[WebContainer] Boot failed:', error);
                // Provide helpful error message for COOP/COEP issues
                if (error?.message?.includes('SharedArrayBuffer') || error?.message?.includes('cross-origin')) {
                    console.error('[WebContainer] SharedArrayBuffer/COEP Error: Ensure server has proper COEP headers');
                    cachedPreviewUrl = null;
                    useStore.getState().setPreviewUrl('');
                }
                throw error;
            });
    }

    return window._bootPromise;
}

export async function mountFiles(files: Record<string, { file: { contents: string } }>) {
    const instance = await getWebContainer();

    try {
        const tree: FileSystemTree = {};

        for (const [path, file] of Object.entries(files)) {
            const parts = path.split('/');
            let current = tree;

            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                if (!current[part]) {
                    current[part] = { directory: {} };
                }

                const node = current[part];
                if (!('directory' in node)) {
                    console.warn(`Path collision: ${path}. ${part} is treated as a file but expected as directory.`);
                    current[part] = { directory: {} };
                }

                current = (current[part] as DirectoryNode).directory;
            }

            const fileName = parts[parts.length - 1];
            current[fileName] = { file: { contents: file.file.contents } };
        }

        console.log('Mounting file tree:', tree);
        await instance.mount(tree);

        // Ensure .glovix directory always exists
        try {
            await instance.fs.mkdir('.glovix', { recursive: true });
        } catch { /* already exists */ }
    } catch (error: any) {
        console.error('[mountFiles] Error:', error);
        if (error?.message?.includes('SharedArrayBuffer') || error?.message?.includes('cross-origin')) {
            console.error('[mountFiles] COEP Issue: Page needs Cross-Origin-Embedder-Policy headers');
        }
        throw error;
    }

    // Inject element picker script into index.html if it exists
    try {
        const indexPath = 'index.html';
        const html = await instance.fs.readFile(indexPath, 'utf-8');
        if (typeof html === 'string') {
            // Write picker as a separate file so AI edits to index.html won't break it
            const pickerJs = `(function(){
  let active=false, overlay=null, lastEl=null;
  function getSelector(el){
    if(el.id) return el.tagName.toLowerCase()+'#'+el.id;
    let s=el.tagName.toLowerCase();
    if(el.className&&typeof el.className==='string'){
      const cls=el.className.trim().split(/\\s+/).slice(0,2).join('.');
      if(cls) s+='.'+cls;
    }
    return s;
  }
  function getOuterPreview(el){
    const clone=el.cloneNode(false);
    let h=clone.outerHTML;
    if(h.length>200) h=h.slice(0,200)+'...';
    return h;
  }
  function showOverlay(el){
    if(!overlay){
      overlay=document.createElement('div');
      overlay.style.cssText='position:fixed;pointer-events:none;border:2px solid #3b82f6;background:rgba(59,130,246,0.08);z-index:99999;transition:all 0.1s ease;border-radius:4px;';
      document.body.appendChild(overlay);
    }
    const r=el.getBoundingClientRect();
    overlay.style.left=r.left+'px';overlay.style.top=r.top+'px';
    overlay.style.width=r.width+'px';overlay.style.height=r.height+'px';
    overlay.style.display='block';
  }
  function hideOverlay(){if(overlay)overlay.style.display='none';}
  function onMove(e){
    if(!active)return;
    const el=document.elementFromPoint(e.clientX,e.clientY);
    if(el&&el!==document.body&&el!==document.documentElement&&!el.closest('[data-glovix-picker]')){
      lastEl=el;showOverlay(el);
    }
  }
  function onClick(e){
    if(!active||!lastEl)return;
    e.preventDefault();e.stopPropagation();
    const tag=getOuterPreview(lastEl);
    const text=(lastEl.textContent||'').trim().slice(0,100);
    const selector=getSelector(lastEl);
    window.parent.postMessage({type:'glovix-element-selected',tag:tag,text:text,selector:selector},'*');
    active=false;hideOverlay();document.body.style.cursor='';
  }
  window.addEventListener('message',function(e){
    if(e.data&&e.data.type==='glovix-picker'){
      active=e.data.active;
      if(active){document.body.style.cursor='crosshair';}
      else{document.body.style.cursor='';hideOverlay();}
    }
  });
  document.addEventListener('mousemove',onMove,true);
  document.addEventListener('click',onClick,true);
})();`;
            await instance.fs.writeFile('glovix-picker.js', pickerJs);

            // Add a small script tag to index.html if not already present
            if (!html.includes('glovix-picker')) {
                const scriptTag = `<script src="/glovix-picker.js" data-glovix-picker></script>`;
                const injected = html.replace('</body>', scriptTag + '\n</body>');
                await instance.fs.writeFile(indexPath, injected);
            }
        }
    } catch { /* index.html may not exist yet */ }
}

export async function writeFile(path: string, content: string) {
    const instance = await getWebContainer();

    // Ensure parent directory exists
    const parts = path.split('/');
    if (parts.length > 1) {
        const dir = parts.slice(0, -1).join('/');
        await instance.fs.mkdir(dir, { recursive: true });
    }

    await instance.fs.writeFile(path, content);
}

export async function readFile(path: string): Promise<string> {
    const instance = await getWebContainer();

    const timeoutMs = 10000;
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout reading file: ${path}`)), timeoutMs);
    });

    try {
        const content = await Promise.race([
            instance.fs.readFile(path, 'utf-8'),
            timeoutPromise
        ]);
        return content;
    } catch (error: any) {
        if (error.message?.includes('ENOENT') || error.message?.includes('no such file')) {
            throw new Error(`File not found: ${path}`);
        }
        throw error;
    }
}

export async function renameFile(oldPath: string, newPath: string) {
    const instance = await getWebContainer();
    const content = await instance.fs.readFile(oldPath);
    await writeFile(newPath, typeof content === 'string' ? content : new TextDecoder().decode(content));
    await instance.fs.rm(oldPath);
}

export async function deleteFile(path: string) {
    // Protect .glovix directory from deletion
    if (path === '.glovix' || path.startsWith('.glovix/')) {
        throw new Error('Cannot delete .glovix — this is a protected system directory');
    }
    const instance = await getWebContainer();
    await instance.fs.rm(path, { recursive: true });
}


// Execute a command with timeout protection
// Returns exit code. Default timeout: 120s (2 min)
// Pass timeoutMs <= 0 to disable timeout (for long-running processes like dev servers)
export async function executeCommand(
    command: string,
    args: string[],
    onOutput: (data: string) => void,
    timeoutMs: number = 120000
): Promise<number> {
    const instance = await getWebContainer();
    const process = await instance.spawn(command, args);

    let finished = false;

    process.output.pipeTo(new WritableStream({
        write(data) {
            onOutput(data);
        }
    }));

    // Race between process exit and timeout
    const exitPromise = process.exit.then(code => {
        finished = true;
        return code;
    });

    // If timeout is disabled (<=0), just wait for exit
    if (timeoutMs <= 0) {
        try {
            return await exitPromise;
        } catch (e: any) {
            onOutput(`\n[SYSTEM] Command error: ${e.message}\n`);
            return 1;
        }
    }

    const timeoutPromise = new Promise<number>((resolve) => {
        setTimeout(() => {
            if (!finished) {
                onOutput(`\n[SYSTEM] Command timed out after ${timeoutMs / 1000}s. Killing process...\n`);
                try { process.kill(); } catch { /* ignore */ }
                resolve(124); // Standard timeout exit code
            }
        }, timeoutMs);
    });

    try {
        const exitCode = await Promise.race([exitPromise, timeoutPromise]);
        return exitCode;
    } catch (e: any) {
        onOutput(`\n[SYSTEM] Command error: ${e.message}\n`);
        return 1;
    }
}

let shellProcess: Awaited<ReturnType<WebContainer['spawn']>> | null = null;
let shellWriter: WritableStreamDefaultWriter<string> | null = null;

export async function startShell(onOutput: (data: string) => void) {
    const instance = await getWebContainer();

    shellProcess = await instance.spawn('jsh', {
        terminal: { cols: 80, rows: 20 }
    });

    shellProcess.output.pipeTo(new WritableStream({
        write(data) {
            onOutput(data);
        }
    }));

    shellWriter = shellProcess.input.getWriter();

    return shellProcess;
}

export async function writeToShell(data: string) {
    if (shellWriter) {
        await shellWriter.write(data);
    }
}

export async function resizeShell(cols: number, rows: number) {
    if (shellProcess) {
        shellProcess.resize({ cols, rows });
    }
}

// ============================================================
// AUTO-INSTALL: scan imports and install missing dependencies
// ============================================================

// Simple hash for dependency comparison
function depsHash(pkgJson: any): string {
    const deps = {
        ...(pkgJson.dependencies || {}),
        ...(pkgJson.devDependencies || {}),
    };
    return JSON.stringify(deps);
}

// Check if node_modules exists in WebContainer
async function nodeModulesExist(): Promise<boolean> {
    try {
        const instance = await getWebContainer();
        await instance.fs.readdir('node_modules');
        return true;
    } catch {
        return false;
    }
}

// Cache key for install state
const INSTALL_CACHE_KEY = 'glovix_deps_hash';
const LOCKFILE_DB_NAME = 'glovix_lockfile_cache';
const LOCKFILE_STORE = 'lockfiles';

// ── IndexedDB helpers for lockfile caching ──────────────────
function openLockfileDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(LOCKFILE_DB_NAME, 1);
        req.onupgradeneeded = () => {
            req.result.createObjectStore(LOCKFILE_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function saveLockfile(content: string): Promise<void> {
    try {
        const db = await openLockfileDB();
        const tx = db.transaction(LOCKFILE_STORE, 'readwrite');
        tx.objectStore(LOCKFILE_STORE).put(content, 'pnpm-lock.yaml');
        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        db.close();
    } catch (e) {
        console.warn('[LockfileCache] Failed to save:', e);
    }
}

async function loadLockfile(): Promise<string | null> {
    try {
        const db = await openLockfileDB();
        const tx = db.transaction(LOCKFILE_STORE, 'readonly');
        const req = tx.objectStore(LOCKFILE_STORE).get('pnpm-lock.yaml');
        const result = await new Promise<string | null>((resolve, reject) => {
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
        db.close();
        return result;
    } catch {
        return null;
    }
}

/**
 * Run pnpm install only if needed.
 * - Restores cached lockfile from IndexedDB for faster resolution
 * - Skips install entirely if deps unchanged & node_modules exists
 * - Caches lockfile after successful install
 */
export async function smartInstall(
    onOutput?: (data: string) => void
): Promise<boolean> {
    const log = onOutput || (() => {});

    try {
        const instance = await getWebContainer();
        let pkgJsonStr: string;
        try {
            pkgJsonStr = await instance.fs.readFile('package.json', 'utf-8');
        } catch {
            return false;
        }

        let pkgJson: any;
        try {
            pkgJson = JSON.parse(pkgJsonStr);
        } catch {
            return false;
        }

        const currentHash = depsHash(pkgJson);
        const cachedHash = localStorage.getItem(INSTALL_CACHE_KEY);
        const hasNodeModules = await nodeModulesExist();

        if (cachedHash === currentHash && hasNodeModules) {
            console.log('[SmartInstall] Dependencies unchanged & node_modules exists — skipping');
            log(`\x1b[32m⚡ Dependencies cached — skipping install\x1b[0m\n`);
            return true;
        }

        // Restore cached lockfile if available (speeds up resolution)
        const cachedLockfile = await loadLockfile();
        if (cachedLockfile) {
            try {
                await instance.fs.writeFile('pnpm-lock.yaml', cachedLockfile);
                console.log('[SmartInstall] Restored cached pnpm-lock.yaml');
            } catch {
                // Ignore — install will work without it, just slower
            }
        }

        // Run install
        log(`\x1b[38;5;243m$ pnpm install\x1b[0m\n`);
        const exitCode = await executeCommand('pnpm', ['install'], (output) => {
            log(output);
        }, 180000);

        if (exitCode === 0) {
            // Cache deps hash
            localStorage.setItem(INSTALL_CACHE_KEY, currentHash);

            // Cache the generated lockfile for next time
            try {
                const lockContent = await instance.fs.readFile('pnpm-lock.yaml', 'utf-8');
                await saveLockfile(lockContent);
                console.log('[SmartInstall] Cached pnpm-lock.yaml to IndexedDB');
            } catch {
                // pnpm might not generate lockfile in WebContainer — try package-lock.json
                try {
                    const lockContent = await instance.fs.readFile('package-lock.json', 'utf-8');
                    await saveLockfile(lockContent);
                } catch { /* ignore */ }
            }

            return true;
        }

        return false;
    } catch (e) {
        console.error('[SmartInstall] Error:', e);
        return false;
    }
}

// Known built-in / local modules that should NOT be installed
const BUILTIN_MODULES = new Set([
    'react', 'react-dom', 'react/jsx-runtime',
    // Node built-ins (shouldn't be used in browser but just in case)
    'fs', 'path', 'os', 'url', 'util', 'events', 'stream', 'http', 'https',
    'crypto', 'buffer', 'querystring', 'child_process', 'net', 'tls', 'dns',
]);

// Extract package name from import specifier
// "framer-motion" → "framer-motion"
// "@radix-ui/react-dialog" → "@radix-ui/react-dialog"
// "react-router-dom" → "react-router-dom"
// "./components/App" → null (relative)
// "../utils" → null (relative)
function extractPackageName(specifier: string): string | null {
    if (specifier.startsWith('.') || specifier.startsWith('/')) return null;

    // Scoped package: @scope/name
    if (specifier.startsWith('@')) {
        const parts = specifier.split('/');
        if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
        return null;
    }

    // Regular package: name or name/subpath
    return specifier.split('/')[0];
}

// Scan file contents for import/require statements
function scanImports(contents: string): Set<string> {
    const packages = new Set<string>();

    // ES imports: import ... from "package"
    const esImportRe = /(?:import\s+(?:[\s\S]*?\s+from\s+)?|import\s*\()['"]([^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = esImportRe.exec(contents)) !== null) {
        const pkg = extractPackageName(m[1]);
        if (pkg) packages.add(pkg);
    }

    // require("package")
    const requireRe = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((m = requireRe.exec(contents)) !== null) {
        const pkg = extractPackageName(m[1]);
        if (pkg) packages.add(pkg);
    }

    return packages;
}

/**
 * Scan all project files for imports, compare with package.json,
 * and auto-install any missing dependencies.
 * 
 * @param files - The project files map from store
 * @param onOutput - Optional callback for terminal output
 * @returns List of newly installed packages (empty if none needed)
 */
export async function autoInstallDependencies(
    files: Record<string, { file: { contents: string } }>,
    onOutput?: (data: string) => void
): Promise<string[]> {
    const log = onOutput || (() => {});

    // 1. Parse package.json to get existing deps
    const pkgJsonFile = files['package.json'];
    if (!pkgJsonFile) {
        console.log('[AutoInstall] No package.json found, skipping');
        return [];
    }

    let pkgJson: any;
    try {
        pkgJson = JSON.parse(pkgJsonFile.file.contents);
    } catch {
        console.error('[AutoInstall] Failed to parse package.json');
        return [];
    }

    const existingDeps = new Set<string>([
        ...Object.keys(pkgJson.dependencies || {}),
        ...Object.keys(pkgJson.devDependencies || {}),
    ]);

    // 2. Scan all source files for imports
    const allImports = new Set<string>();
    for (const [path, file] of Object.entries(files)) {
        // Only scan source files
        if (!/\.(tsx?|jsx?|mjs|cjs)$/.test(path)) continue;
        // Skip node_modules
        if (path.includes('node_modules')) continue;

        const imports = scanImports(file.file.contents);
        imports.forEach(pkg => allImports.add(pkg));
    }

    // 3. Find missing packages
    const missing: string[] = [];
    for (const pkg of allImports) {
        if (BUILTIN_MODULES.has(pkg)) continue;
        if (existingDeps.has(pkg)) continue;
        missing.push(pkg);
    }

    if (missing.length === 0) {
        console.log('[AutoInstall] All dependencies are in package.json');
        return [];
    }

    console.log('[AutoInstall] Missing packages:', missing);
    log(`\x1b[33m⚡ Auto-detected missing packages: ${missing.join(', ')}\x1b[0m\n`);

    // 4. Add missing packages to package.json dependencies
    if (!pkgJson.dependencies) pkgJson.dependencies = {};
    for (const pkg of missing) {
        pkgJson.dependencies[pkg] = 'latest';
    }

    // Write updated package.json
    const updatedPkgJson = JSON.stringify(pkgJson, null, 2);
    await writeFile('package.json', updatedPkgJson);

    // Also update store
    const state = useStore.getState();
    state.setFiles({
        ...state.files,
        'package.json': { file: { contents: updatedPkgJson } },
    });

    // 5. Run pnpm install via smartInstall (skips if cached)
    const success = await smartInstall(log);

    if (success) {
        log(`\x1b[32m✅ Installed: ${missing.join(', ')}\x1b[0m\n`);
    } else {
        log(`\x1b[31m❌ pnpm install failed\x1b[0m\n`);
    }

    return missing;
}
