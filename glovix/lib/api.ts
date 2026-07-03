// API layer for Glovix.
// When the builder is embedded in the Sycord dashboard and a project ID has
// been provided via window.__glovixProjectId, file operations (save/load) are
// routed to the existing /api/projects/[id]/pages REST endpoint so that files
// appear in the project's Pages tab immediately.  When no project ID is set
// (standalone /builder page), the implementation falls back to localStorage so
// the open-source experience is unchanged.

/** Returns the host project ID injected by GlovixBuilder, or null. */
export function getHostProjectId(): string | null {
    if (typeof window === 'undefined') return null;
    return (window as any).__glovixProjectId ?? null;
}

/** Deterministic embedded chat id for the current host project. */
export function getEmbeddedChatId(): string | null {
    if (typeof window === 'undefined') return null;
    const preset = (window as any).__glovixChatId as string | undefined;
    if (preset) return preset;
    const projectId = getHostProjectId();
    return projectId ? `project_${projectId}` : null;
}

const PROJECT_CHAT_FETCH_OPTIONS: RequestInit = {
    credentials: 'same-origin',
};

function sanitizeMessagesForSave(messages: any[]) {
    const replacer = (_key: string, value: unknown) => {
        if (typeof value === 'string' && value.startsWith('data:') && value.length > 32_000) {
            return '[large attachment omitted from save]';
        }
        if (
            value &&
            typeof value === 'object' &&
            'image_url' in (value as object) &&
            typeof (value as { image_url?: { url?: string } }).image_url?.url === 'string'
        ) {
            const url = (value as { image_url: { url: string } }).image_url.url;
            if (url.startsWith('data:') && url.length > 32_000) {
                return { ...(value as object), image_url: { url: '[large image omitted from save]' } };
            }
        }
        return value;
    };

    try {
        return JSON.parse(JSON.stringify(messages, replacer));
    } catch (err) {
        console.warn('[GlovixAPI] Failed to sanitize messages:', err);
        return messages;
    }
}

async function fetchProjectChat(projectId: string, init?: RequestInit) {
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers: Record<string, string> = {};
    if (method !== 'GET' && method !== 'HEAD') {
        headers['Content-Type'] = 'application/json';
    }

    return fetch(`/api/projects/${projectId}/chat`, {
        ...PROJECT_CHAT_FETCH_OPTIONS,
        ...init,
        headers: {
            ...headers,
            ...(init?.headers as Record<string, string> | undefined),
        },
    });
}

/** Embedded dashboard mode uses the project chat API — not localStorage — as source of truth. */
function shouldUseLocalMessageCache() {
    return !getHostProjectId();
}

/** Embedded dashboard mode persists files via /pages — do not mirror them in localStorage. */
function shouldUseLocalProjectCache() {
    return !getHostProjectId();
}

const localStore = {
    get: (key: string) => {
        try {
            return JSON.parse(localStorage.getItem(`glovix_${key}`) || 'null');
        } catch {
            return null;
        }
    },
    set: (key: string, value: any): boolean => {
        try {
            localStorage.setItem(`glovix_${key}`, JSON.stringify(value));
            return true;
        } catch (err) {
            console.warn(`[GlovixAPI] localStorage quota exceeded for "${key}", skipping cache:`, err);
            return false;
        }
    },
    cacheMessages(chatId: string, messages: any[]): boolean {
        if (!shouldUseLocalMessageCache()) return false;
        const allMessages = localStore.get('messages') || {};
        allMessages[chatId] = messages;
        return localStore.set('messages', allMessages);
    },
};

export interface ChatHistory {
    id: string;
    user_id: string;
    title: string;
    created_at: string;
    updated_at: string;
}

export interface Project {
    id: string;
    user_id: string;
    chat_id: string;
    files: Record<string, { file: { contents: string } }>;
    created_at: string;
    updated_at: string;
}

export interface UserTokens {
    tokens_used: number;
    tokens_limit: number;
    tokens_remaining: number;
}

// Chat History
export const getChatHistory = async (userId: string): Promise<ChatHistory[]> => {
    await new Promise(r => setTimeout(r, 50));
    const chats = localStore.get('chats') || [];
    return chats.filter((c: any) => c.user_id === userId);
};

export const getChat = async (chatId: string): Promise<ChatHistory> => {
    await new Promise(r => setTimeout(r, 50));
    const chats = localStore.get('chats') || [];
    const chat = chats.find((c: any) => c.id === chatId);
    if (!chat) throw new Error('Chat not found');
    return chat;
};

export const createChat = async (userId: string, title: string): Promise<ChatHistory> => {
    await new Promise(r => setTimeout(r, 50));
    const chats = localStore.get('chats') || [];
    const newChat = {
        id: crypto.randomUUID(),
        user_id: userId,
        title,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    localStore.set('chats', [newChat, ...chats]);
    return newChat;
};

export const updateChatTitle = async (chatId: string, title: string): Promise<ChatHistory> => {
    const projectId = getHostProjectId();
    if (projectId) {
        try {
            const res = await fetchProjectChat(projectId, {
                method: 'PUT',
                body: JSON.stringify({ title }),
            });
            if (!res.ok) {
                console.warn('[GlovixAPI] Failed to save chat title to API:', res.status);
            }
        } catch (err) {
            console.warn('[GlovixAPI] Failed to save chat title to API:', err);
        }
    }

    await new Promise(r => setTimeout(r, 50));
    const chats = localStore.get('chats') || [];
    const index = chats.findIndex((c: any) => c.id === chatId);
    if (index === -1) {
        const fallbackChat = {
            id: chatId,
            user_id: '',
            title,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        localStore.set('chats', [fallbackChat, ...chats]);
        return fallbackChat;
    }
    chats[index] = { ...chats[index], title, updated_at: new Date().toISOString() };
    localStore.set('chats', chats);
    return chats[index];
};

export const deleteChat = async (chatId: string): Promise<void> => {
    await new Promise(r => setTimeout(r, 50));
    const chats = localStore.get('chats') || [];
    localStore.set('chats', chats.filter((c: any) => c.id !== chatId));
    
    // Delete messages
    const messages = localStore.get('messages') || {};
    delete messages[chatId];
    localStore.set('messages', messages);
    
    // Delete project
    const projects = localStore.get('projects') || {};
    delete projects[chatId];
    localStore.set('projects', projects);
};

// Messages
export const getChatMessages = async (chatId: string, explicitProjectId?: string | null) => {
    const projectId = explicitProjectId ?? getHostProjectId();
    const resolvedChatId = projectId ? `project_${projectId}` : chatId;

    if (projectId) {
        let res: Response | null = null;
        try {
            res = await fetchProjectChat(projectId);
        } catch (err) {
            console.warn('[GlovixAPI] Chat API request failed:', err);
        }

        if (res?.ok) {
            try {
                const data = await res.json();
                const serverMessages = Array.isArray(data?.messages) ? data.messages : [];
                if (shouldUseLocalMessageCache()) {
                    localStore.cacheMessages(resolvedChatId, serverMessages);
                }
                return { messages: serverMessages };
            } catch (err) {
                console.warn('[GlovixAPI] Failed to parse chat API response:', err);
            }
        } else if (res) {
            console.warn('[GlovixAPI] Chat API returned', res.status);
        }

        return { messages: [] };
    }

    if (!shouldUseLocalMessageCache()) {
        return { messages: [] };
    }

    await new Promise(r => setTimeout(r, 50));
    const allMessages = localStore.get('messages') || {};
    return { messages: allMessages[resolvedChatId] || allMessages[chatId] || [] };
};

export type SaveChatMessagesOptions = {
    keepalive?: boolean;
    projectId?: string | null;
};

export const saveChatMessages = async (
    chatId: string,
    messages: any[],
    options?: SaveChatMessagesOptions,
) => {
    const projectId = options?.projectId ?? getHostProjectId();
    const resolvedChatId = projectId ? `project_${projectId}` : (getEmbeddedChatId() || chatId);
    const payload = sanitizeMessagesForSave(messages);
    let apiSaved = false;

    if (projectId) {
        const expectedChatId = `project_${projectId}`;
        if (chatId !== expectedChatId) {
            console.warn('[GlovixAPI] Skipping chat save — chat id does not match project', {
                chatId,
                projectId,
            });
            return { success: false };
        }

        try {
            const res = await fetchProjectChat(projectId, {
                method: 'PUT',
                body: JSON.stringify({ messages: payload }),
                keepalive: options?.keepalive ?? false,
            });
            if (res.ok) {
                apiSaved = true;
            } else {
                const errorBody = await res.text().catch(() => '');
                console.warn('[GlovixAPI] Failed to save chat to API:', res.status, errorBody);
            }
        } catch (err) {
            console.warn('[GlovixAPI] Failed to save chat to API:', err);
        }
    }

    const localCached = shouldUseLocalMessageCache()
        ? localStore.cacheMessages(resolvedChatId, payload) ||
          (resolvedChatId !== chatId && localStore.cacheMessages(chatId, payload))
        : false;

    if (projectId) {
        if (!apiSaved) {
            console.warn('[GlovixAPI] Chat API save did not succeed — messages kept in memory only until next successful save');
        }
        return { success: apiSaved };
    }

    if (!localCached) {
        console.warn('[GlovixAPI] Chat messages could not be cached locally (storage quota may be full)');
    }

    return { success: localCached };
};

/** Start Syte live preview (https://sycord.site/api/ start_preview). Issues domain if set on project. */
export async function startSytePreview(
    projectId: string,
    options?: { domain?: string; issueDomain?: boolean },
): Promise<{
    ok: boolean
    previewUrl?: string | null
    previewReady?: boolean
    domainIssued?: boolean
    error?: string
    needsCreate?: boolean
}> {
    try {
        const res = await fetch('/api/workspace/preview', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectId,
                domain: options?.domain,
                issueDomain: options?.issueDomain,
            }),
        });
        const data = await res.json().catch(() => ({} as any));
        if (!res.ok) {
            return {
                ok: false,
                error: data?.error || `HTTP ${res.status}`,
                needsCreate: Boolean(data?.needsCreate),
                previewUrl: data?.previewUrl,
            };
        }
        return {
            ok: true,
            previewUrl: data.previewUrl,
            previewReady: data.previewReady,
            domainIssued: data.domainIssued,
        };
    } catch (err) {
        console.warn('[GlovixAPI] startSytePreview failed:', err);
        return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
    }
}

/** Returns the public deployed URL for a dashboard project, if any. */
export async function getProjectDeployedUrl(projectId: string): Promise<string | null> {
    try {
        const res = await fetch(`/api/projects/${projectId}`, { credentials: 'same-origin' });
        if (!res.ok) return null;
        const project = await res.json();
        const url =
            project?.cloudflareUrl ||
            project?.deploymentRuntime?.url ||
            project?.domain ||
            null;
        if (!url || typeof url !== 'string') return null;
        return url.startsWith('http') ? url : `https://${url}`;
    } catch (err) {
        console.warn('[GlovixAPI] getProjectDeployedUrl failed:', err);
        return null;
    }
}

// Projects
export const getProject = async (chatId: string): Promise<Project | null> => {
    // When embedded in the dashboard, load files from the pages API so we
    // restore the exact set of files the AI previously saved.
    const projectId = getHostProjectId();
    if (projectId) {
        try {
            const res = await fetch(`/api/projects/${projectId}/pages`, {
                credentials: 'same-origin',
            });
            if (res.ok) {
                const data = await res.json();
                const pages: Array<{ name: string; content: string }> = data.pages ?? [];
                if (pages.length === 0) return null;
                // Reconstruct the files map that Glovix expects
                const files: Record<string, { file: { contents: string } }> = {};
                for (const page of pages) {
                    files[page.name] = { file: { contents: page.content } };
                }
                return {
                    id: projectId,
                    user_id: '',
                    chat_id: chatId,
                    files,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };
            }
        } catch (err) {
            console.warn('[GlovixAPI] Failed to load pages from API, falling back to localStorage:', err);
        }
    }

    await new Promise(r => setTimeout(r, 50));
    const projects = localStore.get('projects') || {};
    return projects[chatId] || null;
};

// ── Pages tab (project file source of truth) ──
// When embedded in the dashboard, the project's Pages array (MongoDB) is the
// single source of truth for the file base. These helpers let the builder read
// and mutate the Pages tab directly instead of relying on a separate in-memory
// copy of the files.

/** True for files that are NOT stored as project Pages (system/internal). */
export function isPageBackedFile(name: string): boolean {
    if (!name) return false;
    if (name.startsWith('.glovix/')) return false;
    if (name === 'glovix-picker.js') return false;
    if (/^\.env(?:\.|$)/.test(name) || /\/\.env(?:\.|$)/.test(name)) return false;
    return true;
}

/**
 * Fetch the project's Pages and return them as a Glovix files map
 * (`{ [path]: { file: { contents } } }`). Returns null when not embedded in a
 * project or when the request fails, so callers can fall back to local state.
 */
export const getProjectPagesMap = async (): Promise<Record<string, { file: { contents: string } }> | null> => {
    const projectId = getHostProjectId();
    if (!projectId) return null;
    try {
        const res = await fetch(`/api/projects/${projectId}/pages`);
        if (!res.ok) {
            console.warn('[GlovixAPI] getProjectPagesMap failed:', res.status);
            return null;
        }
        const data = await res.json();
        const pages: Array<{ name: string; content: string }> = data.pages ?? [];
        const files: Record<string, { file: { contents: string } }> = {};
        for (const page of pages) {
            if (typeof page?.name === 'string' && typeof page?.content === 'string') {
                files[page.name.replace(/^\/+/, '')] = { file: { contents: page.content } };
            }
        }
        return files;
    } catch (err) {
        console.warn('[GlovixAPI] getProjectPagesMap error:', err);
        return null;
    }
};

/** Delete a single page from the project's Pages tab. No-op when not embedded. */
export const deleteProjectPage = async (name: string): Promise<boolean> => {
    const projectId = getHostProjectId();
    if (!projectId) return false;
    try {
        const res = await fetch(`/api/projects/${projectId}/pages?name=${encodeURIComponent(name)}`, {
            method: 'DELETE',
        });
        return res.ok;
    } catch (err) {
        console.warn(`[GlovixAPI] deleteProjectPage("${name}") error:`, err);
        return false;
    }
};

export const saveProject = async (chatId: string, userId: string, files: any): Promise<Project> => {
    const projectId = getHostProjectId();
    const now = new Date().toISOString();

    if (projectId) {
        try {
            const saves = Object.entries(files as Record<string, { file: { contents: string } }>)
                .filter(([name]) =>
                    !name.startsWith('.glovix/') &&
                    name !== 'glovix-picker.js' &&
                    !/^\.env(?:\.|$)/.test(name)
                )
                .map(([name, file]) =>
                    fetch(`/api/projects/${projectId}/pages`, {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name,
                            content: file.file.contents,
                            usedFor: 'AI Builder',
                        }),
                    }).then(r => {
                        if (!r.ok) console.warn(`[GlovixAPI] Failed to save page "${name}":`, r.status);
                    })
                );
            await Promise.allSettled(saves);
        } catch (err) {
            console.warn('[GlovixAPI] Batch page save failed:', err);
        }

        // In embedded mode the Pages API is the source of truth — mirroring files
        // into localStorage quickly exceeds the browser quota (DOMException).
        if (!shouldUseLocalProjectCache()) {
            return {
                id: projectId,
                chat_id: chatId,
                user_id: userId,
                files,
                created_at: now,
                updated_at: now,
            };
        }
    }

    const projects = localStore.get('projects') || {};
    const project = {
        id: crypto.randomUUID(),
        chat_id: chatId,
        user_id: userId,
        files,
        created_at: now,
        updated_at: now,
    };
    projects[chatId] = project;
    localStore.set('projects', projects);
    return project;
};

// User Tokens (Mock - unlimited for OpenSource)
export const getUserTokens = async (_userId: string): Promise<UserTokens> => {
    await new Promise(r => setTimeout(r, 50));
    return {
        tokens_used: 0,
        tokens_limit: 999999999,
        tokens_remaining: 999999999
    };
};

export const useTokens = async (_userId: string, _tokens: number): Promise<UserTokens> => {
    await new Promise(r => setTimeout(r, 50));
    return {
        tokens_used: 0,
        tokens_limit: 999999999,
        tokens_remaining: 999999999
    };
};
