'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let unsubscribe: () => void;

    const setupAuth = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          // Set up Capacitor auth listeners
          await FirebaseAuthentication.removeAllListeners();
          await FirebaseAuthentication.addListener('authStateChange', async (change) => {
            console.log('Auth state changed in Capacitor:', change);
            setUser(change.user as any);
            setLoading(false);
          });

          // Get initial state
          const result = await FirebaseAuthentication.getCurrentUser();
          console.log('Initial Capacitor auth state:', result);
          setUser(result.user as any);
          setLoading(false);
        } else {
          // Web auth
          unsubscribe = onAuthStateChanged(auth, (user) => {
            console.log('Web auth state changed:', user);
            setUser(user);
            setLoading(false);
          });
        }
      } catch (error) {
        console.error('Error setting up auth:', error);
        setLoading(false);
      }
    };

    setupAuth();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Debug log
  useEffect(() => {
    console.log('AuthContext state updated:', { user, loading, pathname });
  }, [user, loading, pathname]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext); 