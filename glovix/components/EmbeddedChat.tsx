'use client'
import { useEffect, useRef } from 'react';
import { Chat } from './Chat';
import { useStore } from '../store';
import { getHostProjectId, getChatMessages, getProject } from '../lib/api';
import { mountFiles, autoInstallDependencies } from '../lib/webcontainer';

/**
 * Chat-only experience used when Syra is embedded inside a Sycord project.
 *
 * There is exactly ONE chat per project (keyed by the host project id), and the
 * UI is nothing but the chat — no splash screen, no top bar, no workbench, and
 * no mobile navigation. Files the AI writes are persisted to the project's
 * Pages (MongoDB) by the tools layer; here we only load any previously saved
 * messages and files so the conversation resumes seamlessly.
 */
export function EmbeddedChat() {
    const user = useStore(s => s.user);
    const theme = useStore(s => s.theme);
    const setCurrentChatId = useStore(s => s.setCurrentChatId);
    const setMessages = useStore(s => s.setMessages);
    const setFiles = useStore(s => s.setFiles);
    const isDark = theme === 'dark';
    const loadedRef = useRef(false);

    useEffect(() => {
        const projectId = getHostProjectId();
        if (!projectId || !user || loadedRef.current) return;
        loadedRef.current = true;

        // One deterministic chat per project.
        const chatId = `project_${projectId}`;
        setCurrentChatId(chatId);

        (async () => {
            // Restore previous conversation for this project, if any.
            try {
                const data = await getChatMessages(chatId);
                if (Array.isArray(data?.messages) && data.messages.length > 0) {
                    setMessages(data.messages);
                }
            } catch {
                /* ignore — start fresh */
            }

            // Restore previously saved files (from the project's Pages) and mount
            // them so the in-browser preview / tooling has the latest state.
            try {
                const project = await getProject(chatId);
                if (project?.files) {
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
                }
            } catch {
                /* ignore — no saved files yet */
            }
        })();
    }, [user, setCurrentChatId, setMessages, setFiles]);

    return (
        <div className={`h-full w-full overflow-hidden ${isDark ? 'bg-[#18191B] text-[#e5e5e5]' : 'bg-white text-gray-900'}`}>
            <Chat />
        </div>
    );
}
