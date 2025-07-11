
'use client';

import { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, isFirebaseConfigValid } from '@/lib/firebase';

interface AuthContextType {
    user: User | null;
    userEmail: string | null;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    userEmail: null,
    loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isFirebaseConfigValid || !auth) {
            setLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const value = {
        user,
        userEmail: user?.email || null,
        loading,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    return useContext(AuthContext);
}
