// Auto-save for LocalStorage (OpenSource version) and embedded project chat API
import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';
import { getEmbeddedChatId, getHostProjectId, saveChatMessages, saveProject } from './api';

const MESSAGES_DEBOUNCE = 500;
const FILES_DEBOUNCE = 2000;

export function useAutoSave() {
    const { messages, files, currentChatId, user } = useStore();

    const messagesRef = useRef(messages);
    const filesRef = useRef(files);
    const currentChatIdRef = useRef(currentChatId);
    const hostProjectIdRef = useRef<string | null>(null);

    useEffect(() => {
        messagesRef.current = messages;
        filesRef.current = files;
        currentChatIdRef.current = currentChatId;
        hostProjectIdRef.current = getHostProjectId();
    }, [messages, files, currentChatId]);

    const isSavingMessagesRef = useRef(false);
    const isSavingFilesRef = useRef(false);

    const saveMessages = useCallback(async (
        chatId: string,
        msgs: any[],
        options?: { keepalive?: boolean; projectId?: string | null },
    ) => {
        if (!chatId || msgs.length === 0 || isSavingMessagesRef.current) return;

        const projectId = options?.projectId ?? hostProjectIdRef.current ?? getHostProjectId();
        if (projectId) {
            const expectedChatId = `project_${projectId}`;
            if (chatId !== expectedChatId) {
                return;
            }
        }

        try {
            isSavingMessagesRef.current = true;
            await saveChatMessages(chatId, msgs, { ...options, projectId });
        } catch (err) {
            console.error('[AutoSave] Failed to save messages:', err);
        } finally {
            isSavingMessagesRef.current = false;
        }
    }, []);

    const saveFiles = useCallback(async (
        chatId: string,
        userId: string,
        projectFiles: any,
        projectId?: string | null,
    ) => {
        if (!chatId || !userId || Object.keys(projectFiles).length === 0 || isSavingFilesRef.current) return;

        const resolvedProjectId = projectId ?? hostProjectIdRef.current ?? getHostProjectId();
        if (resolvedProjectId && chatId !== `project_${resolvedProjectId}`) {
            return;
        }

        try {
            isSavingFilesRef.current = true;
            await saveProject(chatId, userId, projectFiles);
        } catch (err) {
            console.error('[AutoSave] Failed to save files:', err);
        } finally {
            isSavingFilesRef.current = false;
        }
    }, []);

    const flushPendingSaves = useCallback((options?: { keepalive?: boolean; projectId?: string | null }) => {
        const projectId = options?.projectId ?? hostProjectIdRef.current ?? getHostProjectId();
        if (!projectId) return;

        const chatId = `project_${projectId}`;
        const activeUser = useStore.getState().user;

        if (messagesRef.current.length > 0) {
            void saveMessages(chatId, messagesRef.current, { ...options, projectId });
        }
        if (activeUser && Object.keys(filesRef.current).length > 0) {
            void saveFiles(chatId, activeUser.uid, filesRef.current, projectId);
        }
    }, [saveMessages, saveFiles]);

    // Auto-save messages
    useEffect(() => {
        const projectId = getHostProjectId();
        const chatId = projectId ? `project_${projectId}` : (getEmbeddedChatId() || currentChatId);
        if (!chatId || messages.length === 0) return;

        const timer = setTimeout(() => {
            if (getHostProjectId() !== projectId) return;
            saveMessages(chatId, messages, { projectId });
        }, MESSAGES_DEBOUNCE);

        return () => clearTimeout(timer);
    }, [messages, currentChatId, saveMessages]);

    // Auto-save files
    useEffect(() => {
        const projectId = getHostProjectId();
        const chatId = projectId ? `project_${projectId}` : (getEmbeddedChatId() || currentChatId);
        if (!chatId || !user?.uid || Object.keys(files).length === 0) return;

        const timer = setTimeout(() => {
            if (getHostProjectId() !== projectId) return;
            saveFiles(chatId, user.uid, files, projectId);
        }, FILES_DEBOUNCE);

        return () => clearTimeout(timer);
    }, [files, currentChatId, user?.uid, saveFiles]);

    // Save on unmount — only when the host project id is still known.
    useEffect(() => {
        return () => {
            flushPendingSaves({ keepalive: true });
        };
    }, [flushPendingSaves]);

    // Save before the browser unloads the page (reload / tab close)
    useEffect(() => {
        if (!getHostProjectId()) return;

        const handlePageHide = () => {
            flushPendingSaves({ keepalive: true });
        };

        window.addEventListener('pagehide', handlePageHide);
        window.addEventListener('beforeunload', handlePageHide);
        return () => {
            window.removeEventListener('pagehide', handlePageHide);
            window.removeEventListener('beforeunload', handlePageHide);
        };
    }, [flushPendingSaves]);
}
