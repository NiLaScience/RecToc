'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

interface User {
  displayName: string | null;
  email: string | null;
  emailVerified: boolean;
  isAnonymous: boolean;
  phoneNumber: string | null;
  photoURL: string | null;
  uid: string;
}

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
    let isSubscribed = true;

    const setupAuth = async () => {
      try {
        // Remove any existing listeners
        await FirebaseAuthentication.removeAllListeners();
        
        // Set up auth state change listener
        await FirebaseAuthentication.addListener('authStateChange', async (change) => {
          console.log('Auth state changed:', change);
          if (isSubscribed) {
            setUser(change.user as User | null);
            setLoading(false);
          }
        });

        // Get initial state
        const result = await FirebaseAuthentication.getCurrentUser();
        console.log('Initial auth state:', result);
        if (isSubscribed) {
          setUser(result.user as User | null);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error setting up auth:', error);
        if (isSubscribed) {
          setLoading(false);
        }
      }
    };

    setupAuth();

    return () => {
      isSubscribed = false;
      FirebaseAuthentication.removeAllListeners();
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