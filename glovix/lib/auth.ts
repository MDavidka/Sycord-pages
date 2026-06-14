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
    
    // Check if user exists in localStorage
    const stored = localStorage.getItem('glovix_user');
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch {
            // Invalid data, use demo user
        }
    }
    
    // Auto-login with demo user
    localStorage.setItem('glovix_user', JSON.stringify(DEMO_USER));
    return DEMO_USER;
};

export const register = async (email: string, _password: string): Promise<User> => {
    await new Promise(r => setTimeout(r, 200));
    
    const user: User = {
        uid: crypto.randomUUID(),
        email,
        photoURL: undefined
    };
    
    localStorage.setItem('glovix_user', JSON.stringify(user));
    return user;
};

export const login = async (email: string, _password: string): Promise<User> => {
    await new Promise(r => setTimeout(r, 200));
    
    const user: User = {
        uid: crypto.randomUUID(),
        email,
        photoURL: undefined
    };
    
    localStorage.setItem('glovix_user', JSON.stringify(user));
    return user;
};

export const logout = async (): Promise<void> => {
    await new Promise(r => setTimeout(r, 100));
    localStorage.removeItem('glovix_user');
    
    // Auto-login again with demo user
    localStorage.setItem('glovix_user', JSON.stringify(DEMO_USER));
};

export const forgotPassword = async (_email: string): Promise<void> => {
    await new Promise(r => setTimeout(r, 200));
    // Mock - do nothing
};

export const getStoredToken = (): string | null => {
    return null; // No tokens in OpenSource version
};
