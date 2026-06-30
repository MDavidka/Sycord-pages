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

    useEffect(() => {
        messagesRef.current = messages;
        filesRef.current = files;
        currentChatIdRef.current = currentChatId;
    }, [messages, files, currentChatId]);

    const isSavingMessagesRef = useRef(false);
    const isSavingFilesRef = useRef(false);

    const saveMessages = useCallback(async (chatId: string, msgs: any[], options?: { keepalive?: boolean }) => {
        if (!chatId || msgs.length === 0 || isSavingMessagesRef.current) return;
        try {
            isSavingMessagesRef.current = true;
            await saveChatMessages(chatId, msgs, options);
        } catch (err) {
            console.error('[AutoSave] Failed to save messages:', err);
        } finally {
            isSavingMessagesRef.current = false;
        }
    }, []);

    const saveFiles = useCallback(async (chatId: string, userId: string, projectFiles: any) => {
        if (!chatId || !userId || Object.keys(projectFiles).length === 0 || isSavingFilesRef.current) return;
        try {
            isSavingFilesRef.current = true;
            await saveProject(chatId, userId, projectFiles);
        } catch (err) {
            console.error('[AutoSave] Failed to save files:', err);
        } finally {
            isSavingFilesRef.current = false;
        }
    }, []);

    const flushPendingSaves = useCallback((options?: { keepalive?: boolean }) => {
        const chatId = getEmbeddedChatId() || currentChatIdRef.current;
        const activeUser = useStore.getState().user;
        if (!chatId) return;

        if (messagesRef.current.length > 0) {
            void saveMessages(chatId, messagesRef.current, options);
        }
        if (activeUser && Object.keys(filesRef.current).length > 0) {
            void saveFiles(chatId, activeUser.uid, filesRef.current);
        }
    }, [saveMessages, saveFiles]);

    // Auto-save messages
    useEffect(() => {
        const chatId = getEmbeddedChatId() || currentChatId;
        if (!chatId || messages.length === 0) return;
        const timer = setTimeout(() => {
            saveMessages(chatId, messages);
        }, MESSAGES_DEBOUNCE);
        return () => clearTimeout(timer);
    }, [messages, currentChatId, saveMessages]);

    // Auto-save files
    useEffect(() => {
        const chatId = getEmbeddedChatId() || currentChatId;
        if (!chatId || !user?.uid || Object.keys(files).length === 0) return;
        const timer = setTimeout(() => {
            saveFiles(chatId, user.uid, files);
        }, FILES_DEBOUNCE);
        return () => clearTimeout(timer);
    }, [files, currentChatId, user?.uid, saveFiles]);

    // Save on unmount
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
