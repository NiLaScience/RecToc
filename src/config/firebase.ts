'use client';

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator, Auth, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { Analytics, getAnalytics, isSupported } from "firebase/analytics";
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { initializeAuth, indexedDBLocalPersistence } from 'firebase/auth';

// Add type for auth state change
interface AuthStateChange {
  user: {
    displayName: string | null;
    email: string | null;
    emailVerified: boolean;
    isAnonymous: boolean;
    phoneNumber: string | null;
    photoURL: string | null;
    uid: string;
  } | null;
}

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase only if it hasn't been initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firebase services with platform-specific configuration
let auth: Auth;
let db;
let storage;
let analytics: Analytics | null = null;

// Only initialize services if we're in the browser
if (typeof window !== 'undefined') {
  if (Capacitor.isNativePlatform()) {
    // Use IndexedDB persistence for mobile platforms
    auth = initializeAuth(app, {
      persistence: indexedDBLocalPersistence
    });
    
    // Initialize Capacitor Firebase Authentication and sync state
    FirebaseAuthentication.addListener('authStateChange', async () => {
      try {
        const result = await FirebaseAuthentication.getCurrentUser();
        if (result.user) {
          console.log('Native auth state changed:', result.user);
        } else {
          console.log('User signed out on native platform');
        }
      } catch (error) {
        console.error('Error handling native auth state change:', error);
      }
    });
  } else {
    // Use default persistence for web
    auth = getAuth(app);
  }

  // Initialize other Firebase services
  db = getFirestore(app);
  storage = getStorage(app);

  // Initialize Analytics if supported
  isSupported().then(supported => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(console.error);
}

export { app, auth, db, storage, analytics };

// Initialize Capacitor Firebase Authentication if on native platform
export const initializeFirebaseAuth = async () => {
  if (!Capacitor.isNativePlatform()) {
    console.log('Not running on a native platform, using web authentication');
    return;
  }

  try {
    // Get current user from Capacitor Firebase Authentication
    const result = await FirebaseAuthentication.getCurrentUser();
    console.log('Current native user:', result.user);
    return result.user;
  } catch (error) {
    console.error('Error initializing Firebase Authentication:', error);
    return null;
  }
};

// Only call initialization on the client side
if (typeof window !== 'undefined') {
  initializeFirebaseAuth().catch(console.error);
}