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
    headers: { 'Content-Type': 'application/json' },
};

function sanitizeMessagesForSave(messages: any[]) {
    return JSON.parse(JSON.stringify(messages));
}

async function fetchProjectChat(projectId: string, init?: RequestInit) {
    return fetch(`/api/projects/${projectId}/chat`, {
        ...PROJECT_CHAT_FETCH_OPTIONS,
        ...init,
        headers: {
            ...(PROJECT_CHAT_FETCH_OPTIONS.headers as Record<string, string>),
            ...(init?.headers as Record<string, string> | undefined),
        },
    });
}

const localStore = {
    get: (key: string) => {
        try {
            return JSON.parse(localStorage.getItem(`glovix_${key}`) || 'null');
        } catch {
            return null;
        }
    },
    set: (key: string, value: any) => {
        localStorage.setItem(`glovix_${key}`, JSON.stringify(value));
    }
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
export const getChatMessages = async (chatId: string) => {
    const projectId = getHostProjectId();
    const embeddedChatId = getEmbeddedChatId();
    const resolvedChatId = embeddedChatId || chatId;

    if (projectId) {
        try {
            const res = await fetchProjectChat(projectId);
            if (res.ok) {
                const data = await res.json();
                const serverMessages = Array.isArray(data?.messages) ? data.messages : [];
                if (serverMessages.length > 0) {
                    const allMessages = localStore.get('messages') || {};
                    allMessages[resolvedChatId] = serverMessages;
                    localStore.set('messages', allMessages);
                    return { messages: serverMessages };
                }

                // Migrate browser-local history to the project session once.
                const allMessages = localStore.get('messages') || {};
                const localMessages =
                    allMessages[resolvedChatId] ||
                    allMessages[chatId] ||
                    [];
                if (localMessages.length > 0) {
                    fetchProjectChat(projectId, {
                        method: 'PUT',
                        body: JSON.stringify({ messages: sanitizeMessagesForSave(localMessages) }),
                        keepalive: true,
                    }).catch((err) => {
                        console.warn('[GlovixAPI] Failed to migrate local chat to API:', err);
                    });
                    return { messages: localMessages };
                }

                return { messages: [] };
            }
            console.warn('[GlovixAPI] Failed to load chat from API:', res.status);
        } catch (err) {
            console.warn('[GlovixAPI] Failed to load chat from API, falling back to localStorage:', err);
        }
    }

    await new Promise(r => setTimeout(r, 50));
    const allMessages = localStore.get('messages') || {};
    return { messages: allMessages[resolvedChatId] || allMessages[chatId] || [] };
};

export const saveChatMessages = async (chatId: string, messages: any[], options?: { keepalive?: boolean }) => {
    const projectId = getHostProjectId();
    const embeddedChatId = getEmbeddedChatId();
    const resolvedChatId = embeddedChatId || chatId;
    const payload = sanitizeMessagesForSave(messages);

    if (projectId) {
        try {
            const res = await fetchProjectChat(projectId, {
                method: 'PUT',
                body: JSON.stringify({ messages: payload }),
                keepalive: options?.keepalive ?? false,
            });
            if (!res.ok) {
                const errorBody = await res.text().catch(() => '');
                console.warn('[GlovixAPI] Failed to save chat to API:', res.status, errorBody);
            }
        } catch (err) {
            console.warn('[GlovixAPI] Failed to save chat to API:', err);
        }
    }

    const allMessages = localStore.get('messages') || {};
    allMessages[resolvedChatId] = payload;
    if (resolvedChatId !== chatId) {
        allMessages[chatId] = payload;
    }
    localStore.set('messages', allMessages);
    return { success: true };
};

// Projects
export const getProject = async (chatId: string): Promise<Project | null> => {
    // When embedded in the dashboard, load files from the pages API so we
    // restore the exact set of files the AI previously saved.
    const projectId = getHostProjectId();
    if (projectId) {
        try {
            const res = await fetch(`/api/projects/${projectId}/pages`);
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
    // When embedded in the dashboard, persist every file to the pages API so
    // it appears in the project's Pages tab immediately.
    const projectId = getHostProjectId();
    if (projectId) {
        try {
            const saves = Object.entries(files as Record<string, { file: { contents: string } }>)
                // Skip system / internal files that should not appear as pages
                .filter(([name]) =>
                    !name.startsWith('.glovix/') &&
                    name !== 'glovix-picker.js' &&
                    !/^\.env(?:\.|$)/.test(name)
                )
                .map(([name, file]) =>
                    fetch(`/api/projects/${projectId}/pages`, {
                        method: 'POST',
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
            console.warn('[GlovixAPI] Batch page save failed, falling back to localStorage:', err);
        }
    }

    // Always also save to localStorage as a local cache / fallback for the
    // standalone /builder page and for offline recovery.
    const projects = localStore.get('projects') || {};
    const project = {
        id: crypto.randomUUID(),
        chat_id: chatId,
        user_id: userId,
        files,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
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
