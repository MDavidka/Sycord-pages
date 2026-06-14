// Auto-save for LocalStorage (OpenSource version)
import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';
import { saveChatMessages, saveProject } from './api';

const MESSAGES_DEBOUNCE = 1000;
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

    const isSavingRef = useRef(false);

    const saveMessages = useCallback(async (chatId: string, msgs: any[]) => {
        if (!chatId || msgs.length === 0 || isSavingRef.current) return;
        try {
            isSavingRef.current = true;
            await saveChatMessages(chatId, msgs);
        } catch (err) {
            console.error('[AutoSave] Failed to save messages:', err);
        } finally {
            isSavingRef.current = false;
        }
    }, []);

    const saveFiles = useCallback(async (chatId: string, userId: string, projectFiles: any) => {
        if (!chatId || !userId || Object.keys(projectFiles).length === 0 || isSavingRef.current) return;
        try {
            isSavingRef.current = true;
            await saveProject(chatId, userId, projectFiles);
        } catch (err) {
            console.error('[AutoSave] Failed to save files:', err);
        } finally {
            isSavingRef.current = false;
        }
    }, []);

    // Auto-save messages
    useEffect(() => {
        if (!currentChatId || messages.length === 0) return;
        const timer = setTimeout(() => {
            saveMessages(currentChatId, messages);
        }, MESSAGES_DEBOUNCE);
        return () => clearTimeout(timer);
    }, [messages, currentChatId, saveMessages]);

    // Auto-save files
    useEffect(() => {
        if (!currentChatId || !user?.uid || Object.keys(files).length === 0) return;
        const timer = setTimeout(() => {
            saveFiles(currentChatId, user.uid, files);
        }, FILES_DEBOUNCE);
        return () => clearTimeout(timer);
    }, [files, currentChatId, user?.uid, saveFiles]);

    // Save on unmount
    useEffect(() => {
        return () => {
            const chatId = currentChatIdRef.current;
            const user = useStore.getState().user;
            if (chatId && user) {
                if (messagesRef.current.length > 0) {
                    saveMessages(chatId, messagesRef.current);
                }
                if (Object.keys(filesRef.current).length > 0) {
                    saveFiles(chatId, user.uid, filesRef.current);
                }
            }
        };
    }, [currentChatId, user?.uid, saveMessages, saveFiles]);
}
