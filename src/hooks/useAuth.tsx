
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
        // --- Login bypass for testing ---
        const mockUser = {
            uid: 'test-user-uid',
            email: 'test.user@example.com',
            emailVerified: true,
            displayName: 'Test User',
            isAnonymous: false,
            photoURL: '',
            providerData: [],
            metadata: {},
            providerId: 'password',
            tenantId: null,
            delete: async () => {},
            getIdToken: async () => 'test-token',
            getIdTokenResult: async () => ({
                token: 'test-token',
                expirationTime: '',
                authTime: '',
                issuedAtTime: '',
                signInProvider: null,
                signInSecondFactor: null,
                claims: {},
            }),
            reload: async () => {},
            toJSON: () => ({}),
        } as User;
        
        setUser(mockUser);
        setLoading(false);
        // --- End login bypass ---


        /*
        // Original auth logic. Uncomment to restore.
        if (!isFirebaseConfigValid || !auth) {
            setLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
        });

        return () => unsubscribe();
        */
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
