// LocalStorage-only API for OpenSource version

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
    await new Promise(r => setTimeout(r, 50));
    const chats = localStore.get('chats') || [];
    const index = chats.findIndex((c: any) => c.id === chatId);
    if (index === -1) throw new Error('Chat not found');
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
    await new Promise(r => setTimeout(r, 50));
    const allMessages = localStore.get('messages') || {};
    return { messages: allMessages[chatId] || [] };
};

export const saveChatMessages = async (chatId: string, messages: any[]) => {
    const allMessages = localStore.get('messages') || {};
    allMessages[chatId] = messages;
    localStore.set('messages', allMessages);
    return { success: true };
};

// Projects
export const getProject = async (chatId: string): Promise<Project | null> => {
    await new Promise(r => setTimeout(r, 50));
    const projects = localStore.get('projects') || {};
    return projects[chatId] || null;
};

export const saveProject = async (chatId: string, userId: string, files: any): Promise<Project> => {
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
