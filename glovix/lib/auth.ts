// LocalStorage-only Auth for OpenSource version

export interface User {
    uid: string;
    email: string;
    photoURL?: string;
}

const DEMO_USER: User = {
    uid: 'demo-user',
    email: 'demo@glovix.local',
    photoURL: undefined
};

// Auto-login with demo user
export const getCurrentUser = async (): Promise<User | null> => {
    await new Promise(r => setTimeout(r, 100));
    
    if (typeof window === 'undefined') {
        return DEMO_USER;
    }

    // Check if user exists in localStorage
    try {
        const stored = localStorage.getItem('glovix_user');
        if (stored) {
            return JSON.parse(stored);
        }
        // Auto-login with demo user
        localStorage.setItem('glovix_user', JSON.stringify(DEMO_USER));
    } catch {
        // Invalid data or storage error, use demo user
    }
    
    return DEMO_USER;
};

export const register = async (email: string, _password: string): Promise<User> => {
    await new Promise(r => setTimeout(r, 200));
    
    const user: User = {
        uid: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `user-${Date.now()}`,
        email,
        photoURL: undefined
    };
    
    try {
        if (typeof window !== 'undefined') {
            localStorage.setItem('glovix_user', JSON.stringify(user));
        }
    } catch {}
    return user;
};

export const login = async (email: string, _password: string): Promise<User> => {
    await new Promise(r => setTimeout(r, 200));
    
    const user: User = {
        uid: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `user-${Date.now()}`,
        email,
        photoURL: undefined
    };
    
    try {
        if (typeof window !== 'undefined') {
            localStorage.setItem('glovix_user', JSON.stringify(user));
        }
    } catch {}
    return user;
};

export const logout = async (): Promise<void> => {
    await new Promise(r => setTimeout(r, 100));
    try {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('glovix_user');
            // Auto-login again with demo user
            localStorage.setItem('glovix_user', JSON.stringify(DEMO_USER));
        }
    } catch {}
};

export const forgotPassword = async (_email: string): Promise<void> => {
    await new Promise(r => setTimeout(r, 200));
    // Mock - do nothing
};

export const getStoredToken = (): string | null => {
    return null; // No tokens in OpenSource version
};
