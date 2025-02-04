'use client';

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { Analytics, getAnalytics, isSupported } from "firebase/analytics";
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { initializeAuth, indexedDBLocalPersistence } from 'firebase/auth';

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

// Initialize other Firebase services
const db = getFirestore(app);
const storage = getStorage(app);

// Initialize Analytics if supported
let analytics: Analytics | null = null;
isSupported().then(supported => {
  if (supported) {
    analytics = getAnalytics(app);
  }
});

export { app, auth, db, storage, analytics };

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