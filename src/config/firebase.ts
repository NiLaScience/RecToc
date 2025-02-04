'use client';

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { Analytics, getAnalytics, isSupported } from "firebase/analytics";
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { initializeAuth, indexedDBLocalPersistence } from 'firebase/auth';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCDPqC9jG5cymkwQptrCoS4ph3EZvbtaZA",
  authDomain: "rec-toc-56a25.firebaseapp.com",
  projectId: "rec-toc-56a25",
  storageBucket: "rec-toc-56a25.firebasestorage.app",
  messagingSenderId: "558786439803",
  appId: "1:558786439803:web:e909f5099dc59a1c84d0de",
  measurementId: "G-H1SFBCCE5T"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services with platform-specific configuration
let auth: Auth;
if (Capacitor.isNativePlatform()) {
  // Use IndexedDB persistence for mobile platforms
  auth = initializeAuth(app, {
    persistence: indexedDBLocalPersistence
  });
} else {
  // Use default persistence for web
  auth = getAuth(app);
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);

// Initialize analytics only in browser environment
export let analytics: Analytics | null = null;
if (typeof window !== 'undefined' && !Capacitor.isNativePlatform()) {
  // Check if analytics is supported before initializing
  isSupported().then(supported => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

// Initialize Capacitor Firebase Authentication if on native platform
export const initializeFirebaseAuth = async () => {
  if (!Capacitor.isNativePlatform()) {
    console.log('Not running on a native platform, using web authentication');
    return;
  }

  if (!Capacitor.isPluginAvailable('FirebaseAuthentication')) {
    console.warn('FirebaseAuthentication plugin is not available on this platform.');
    return;
  }

  try {
    // Initialize sign in with current user
    const result = await FirebaseAuthentication.getCurrentUser();
    console.log('Current user:', result.user);
    return result.user;
  } catch (error) {
    console.error('Error initializing Firebase Authentication:', error);
    return null;
  }
};

// Call initialization
initializeFirebaseAuth().catch(console.error);

export default app;