'use client'
import { useEffect, useLayoutEffect } from 'react';
import { Chat } from './Chat';
import { useStore } from '../store';
import { getHostProjectId, getChatMessages, getProject, saveChatMessages } from '../lib/api';
import { mountFiles, autoInstallDependencies } from '../lib/webcontainer';

/**
 * Chat-only experience used when Syra is embedded inside a Sycord project.
 *
 * There is exactly ONE chat per project (keyed by the host project id), and the
 * UI is nothing but the chat — no splash screen, no top bar, no workbench, and
 * no mobile navigation. Files the AI writes are persisted to the project's
 * Pages (MongoDB) by the tools layer; messages are persisted to the project's
 * chat session in the database via /api/projects/[id]/chat.
 */
export function EmbeddedChat() {
    const theme = useStore(s => s.theme);
    const setCurrentChatId = useStore(s => s.setCurrentChatId);
    const setMessages = useStore(s => s.setMessages);
    const setFiles = useStore(s => s.setFiles);
    const isDark = theme === 'dark';

    const projectId = getHostProjectId();
    const chatId = projectId ? `project_${projectId}` : null;

    useLayoutEffect(() => {
        if (!chatId) return;
        setCurrentChatId(chatId);
    }, [chatId, setCurrentChatId]);

    useEffect(() => {
        if (!projectId || !chatId) return;

        let cancelled = false;

        // Clear in-memory state from the previous project before loading this one.
        setMessages([]);
        setFiles({});

        (async () => {
            try {
                const data = await getChatMessages(chatId, projectId);
                if (cancelled) return;
                setMessages(Array.isArray(data?.messages) ? data.messages : []);
            } catch (err) {
                console.warn('[EmbeddedChat] Failed to restore messages:', err);
                if (!cancelled) setMessages([]);
            }

            try {
                const project = await getProject(chatId);
                if (cancelled || !project?.files) return;

                const files = typeof project.files === 'string'
                    ? JSON.parse(project.files)
                    : project.files;
                if (files && Object.keys(files).length > 0) {
                    setFiles(files);
                    mountFiles(files)
                        .then(() => {
                            const addOutput = useStore.getState().addTerminalOutput;
                            autoInstallDependencies(files, addOutput).catch(() => {});
                        })
                        .catch(() => {});
                }
            } catch (err) {
                console.warn('[EmbeddedChat] Failed to restore project files:', err);
            }
        })();

        return () => {
            cancelled = true;
            const state = useStore.getState();
            if (state.messages.length > 0) {
                void saveChatMessages(chatId, state.messages, {
                    keepalive: true,
                    projectId,
                });
            }
        };
    }, [projectId, chatId, setMessages, setFiles]);

    return (
        <div className={`h-full w-full overflow-hidden ${isDark ? 'bg-[#18191B] text-[#e5e5e5]' : 'bg-white text-gray-900'}`}>
            <Chat />
        </div>
    );
}
