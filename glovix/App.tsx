'use client'
import './glovix.css';
import { useEffect, useState } from 'react';
import { MemoryRouter, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomePage } from './components/HomePage';
import { EmbeddedChat } from './components/EmbeddedChat';
import { useStore } from './store';
import { getCurrentUser } from './lib/auth';
import { getChatMessages, getProject, getChat } from './lib/api';
import { getHostProjectId } from './lib/api';
import { useAutoSave } from './lib/autoSave';
import { mountFiles, autoInstallDependencies } from './lib/webcontainer';
import { initErudaIfPresent } from './lib/init-eruda';

function HomePageRoute() {
    const { setCurrentChatId, setMessages, setFiles } = useStore();

    useEffect(() => {
        setCurrentChatId(null);
        setMessages([]);
        setFiles({});
    }, []);

    return <HomePage />;
}

function ChatPage() {
    const { chatId } = useParams();
    const navigate = useNavigate();
    const { user, setCurrentChatId, setMessages, setFiles } = useStore();
    const [accessDenied, setAccessDenied] = useState(false);
    const [, setLoading] = useState(true);

    useEffect(() => {
        if (chatId && user) {
            loadChat(chatId);
        }
    }, [chatId, user?.uid]);

    const loadChat = async (id: string) => {
        const currentState = useStore.getState();

        // If we already have this chat loaded with messages, don't reload
        if (currentState.currentChatId === id && currentState.messages.length > 0) {
            setLoading(false);
            return;
        }

        setCurrentChatId(id);

        try {
            await getChat(id);
        } catch (err: any) {
            if (err.message === 'Access denied' || err.message === 'Chat not found') {
                setAccessDenied(true);
                setLoading(false);
                return;
            }
        }

        // Only load messages from server if we don't have any (new chat from HomePage already has first message)
        if (currentState.messages.length === 0) {
            try {
                const msgs = await getChatMessages(id);
                if (Array.isArray(msgs) && msgs.length > 0) {
                    setMessages(msgs);
                }
            } catch {
                // Ignore
            }
        }

        try {
            const project = await getProject(id);
            if (project?.files) {
                const files = typeof project.files === 'string' ? JSON.parse(project.files) : project.files;
                setFiles(files);
                // Mount files to WebContainer so they're available in terminal
                if (Object.keys(files).length > 0) {
                    console.log('[App] Mounting files to WebContainer...');
                    await mountFiles(files);
                    console.log('[App] Files mounted successfully');
                    // Auto-detect and install missing dependencies
                    const addOutput = useStore.getState().addTerminalOutput;
                    autoInstallDependencies(files, addOutput).catch(err => {
                        console.error('[App] Auto-install failed:', err);
                    });
                }
            } else if (Object.keys(currentState.files).length === 0) {
                setFiles({});
            }
        } catch (err) {
            console.error('[App] Failed to load/mount files:', err);
            if (Object.keys(currentState.files).length === 0) {
                setFiles({});
            }
        }

        setLoading(false);
    };

    if (accessDenied) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#18191B] p-4">
                <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
                <p className="text-[#a3a3a3] mb-6">You don't have permission to view this chat.</p>
                <button
                    onClick={() => navigate('/')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                    Go Home
                </button>
            </div>
        );
    }

    return <Layout />;
}

function AppContent() {
    const { setUser, theme } = useStore();
    const [loading, setLoading] = useState(true);

    useAutoSave();

    // When Syra is embedded inside a Sycord project, the whole experience is a
    // single chat — no splash, no bar, no workbench, no navigation.
    const embedded = !!getHostProjectId();

    useEffect(() => {
        document.documentElement.classList.toggle('light', theme === 'light');
    }, [theme]);

    useEffect(() => {
        initErudaIfPresent();
    }, []);

    useEffect(() => {
        const initAuth = async () => {
            const user = await getCurrentUser();
            setUser(user);
            setLoading(false);
        };
        initAuth();
    }, [setUser]);

    const isDark = theme === 'dark';

    // Embedded chat-only mode: render nothing but the chat. We don't show the
    // "loading" splash here — the chat shell appears immediately and becomes
    // interactive as soon as the (auto-login) user is ready.
    if (embedded) {
        return (
          <ErrorBoundary>
            <EmbeddedChat />
          </ErrorBoundary>
        );
    }

    if (loading) {
        return (
            <div className={`h-screen w-screen flex flex-col items-center justify-center ${isDark ? 'bg-[#18191B]' : 'bg-white'}`}>
                <div className={`text-xl tracking-widest font-light ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Syra
                </div>
                <div className={`mt-6 w-8 h-0.5 ${isDark ? 'bg-white/20' : 'bg-gray-200'} overflow-hidden`}>
                    <div className={`h-full w-full ${isDark ? 'bg-white' : 'bg-gray-900'} animate-[loading_1s_ease-in-out_infinite]`}></div>
                </div>
            </div>
        );
    }

    return (
        <>
          <Routes>
                <Route path="/" element={<ErrorBoundary><HomePageRoute /></ErrorBoundary>} />
                <Route path="/c/:chatId" element={<ErrorBoundary><ChatPage /></ErrorBoundary>} />
                {/* Fallback redirect */}
                <Route path="*" element={<ErrorBoundary><HomePageRoute /></ErrorBoundary>} />
              </Routes>
        </>
    );
}

function App() {
    return (
        <MemoryRouter>
            <AppContent />
        </MemoryRouter>
    );
}

export default App;