import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

export function useAuth() {
    const [user, setUser] = useState<User | null>(auth.currentUser);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
            setUser(nextUser);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signInWithGoogle = useCallback(async () => {
        await signInWithPopup(auth, googleProvider);
    }, []);

    const signOutUser = useCallback(async () => {
        await signOut(auth);
    }, []);

    return {
        user,
        loading,
        signInWithGoogle,
        signOutUser,
    };
}
