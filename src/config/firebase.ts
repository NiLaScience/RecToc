'use client';

import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { FirebaseFirestore } from '@capacitor-firebase/firestore';
import { FirebaseStorage } from '@capacitor-firebase/storage';
import { FirebaseApp } from '@capacitor-firebase/app';
import { FirebaseFunctions } from '@capacitor-firebase/functions';
import { FirebaseRemoteConfig } from '@capacitor-firebase/remote-config';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';

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

// Initialize Firebase based on platform
const initializeFirebase = async () => {
  try {
    if (Capacitor.isNativePlatform()) {
      // For native platforms, Firebase is initialized in the native layer
      // We just need to verify it's working by getting the app name
      try {
        await FirebaseApp.getName();
      } catch (error) {
        console.error('Firebase not initialized in native layer:', error);
        throw new Error('Firebase must be initialized in the native layer for this platform');
      }
    } else {
      // For web platform, use Firebase Web SDK
      try {
        const app = initializeApp(firebaseConfig);
        // Initialize Auth for web platform
        const auth = getAuth(app);
        if (process.env.NODE_ENV === 'development') {
          console.log('Firebase Web initialized successfully');
        }
      } catch (error: any) {
        if (error.code !== 'app/duplicate-app') {
          console.error('Error initializing Firebase for web:', error);
          throw error;
        }
        // Firebase already initialized
      }
    }
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    throw error;
  }
};

// Initialize Capacitor plugins if in browser environment
if (typeof window !== 'undefined') {
  // Initialize Firebase
  initializeFirebase();

  // Set up emulators if needed
  if (process.env.NODE_ENV === 'development') {
    FirebaseAuthentication.useEmulator({
      host: 'localhost',
      port: 9099
    }).catch(console.error);

    FirebaseFirestore.useEmulator({
      host: 'localhost',
      port: 8080
    }).catch(console.error);

    FirebaseStorage.useEmulator({
      host: 'localhost',
      port: 9199
    }).catch(console.error);

    FirebaseFunctions.useEmulator({
      host: 'localhost',
      port: 5001
    }).catch(console.error);
  }
}

// Helper function to get the current user's ID token
export const getIdToken = async (): Promise<string | null> => {
  try {
    const result = await FirebaseAuthentication.getIdToken();
    return result.token;
  } catch (error) {
    console.error('Error getting ID token:', error);
    return null;
  }
};

// Helper function to get the current user
export const getCurrentUser = async () => {
  try {
    const result = await FirebaseAuthentication.getCurrentUser();
    return result.user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

// Helper function to sign out
export const signOut = async () => {
  try {
    await FirebaseAuthentication.signOut();
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

// Helper function to upload a file to Firebase Storage
export const uploadFile = async (path: string, uri: string, metadata?: { contentType?: string }) => {
  try {
    await new Promise<void>((resolve, reject) => {
      FirebaseStorage.uploadFile(
        {
          path,
          uri,
          metadata
        },
        (event, error) => {
          if (error) {
            reject(error);
          } else if (event?.completed) {
            resolve();
          }
        }
      );
    });

    const result = await FirebaseStorage.getDownloadUrl({ path });
    return result.downloadUrl;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

// Helper function to add a document to Firestore
export const addDocument = async (collection: string, data: any) => {
  try {
    const result = await FirebaseFirestore.addDocument({
      reference: collection,
      data
    });
    return result.reference;
  } catch (error) {
    console.error('Error adding document:', error);
    throw error;
  }
};

// Helper function to update a document in Firestore
export const updateDocument = async (reference: string, data: any) => {
  try {
    await FirebaseFirestore.updateDocument({
      reference,
      data
    });
  } catch (error) {
    console.error('Error updating document:', error);
    throw error;
  }
};

// Helper function to get a document from Firestore
export const getDocument = async (reference: string) => {
  try {
    const result = await FirebaseFirestore.getDocument({
      reference
    });
    return result.snapshot.data;
  } catch (error) {
    console.error('Error getting document:', error);
    throw error;
  }
};

// Helper function to add a snapshot listener
export const addSnapshotListener = async (reference: string, callback: (data: any) => void) => {
  try {
    const callbackId = await FirebaseFirestore.addDocumentSnapshotListener(
      { reference },
      (event, error) => {
        if (error) {
          console.error('Snapshot listener error:', error);
          return;
        }
        if (event?.snapshot?.data) {
          callback(event.snapshot.data);
        }
      }
    );
    return callbackId;
  } catch (error) {
    console.error('Error adding snapshot listener:', error);
    throw error;
  }
};

// Helper function to remove a snapshot listener
export const removeSnapshotListener = async (callbackId: string) => {
  try {
    await FirebaseFirestore.removeSnapshotListener({ callbackId });
  } catch (error) {
    console.error('Error removing snapshot listener:', error);
    throw error;
  }
};

// Helper function to call a Firebase Function
export const callFunction = async (name: string, data?: any) => {
  try {
    const result = await FirebaseFunctions.callByName({ 
      name, 
      data 
    });
    return result.data;
  } catch (error) {
    console.error(`Error calling function ${name}:`, error);
    throw error;
  }
};

// Helper function to initialize Remote Config with default settings
export const initializeRemoteConfig = async () => {
  try {
    await FirebaseRemoteConfig.setSettings({
      fetchTimeoutInSeconds: 10,
      minimumFetchIntervalInSeconds: process.env.NODE_ENV === 'development' ? 0 : 3600 // 1 hour in production
    });
    await FirebaseRemoteConfig.fetchAndActivate();
  } catch (error) {
    console.error('Error initializing Remote Config:', error);
    throw error;
  }
};

// Helper function to fetch and activate remote config
export const fetchAndActivateConfig = async () => {
  try {
    await FirebaseRemoteConfig.fetchAndActivate();
  } catch (error) {
    console.error('Error fetching and activating config:', error);
    throw error;
  }
};

// Helper function to get a boolean value from Remote Config
export const getRemoteConfigBoolean = async (key: string): Promise<boolean> => {
  try {
    const { value } = await FirebaseRemoteConfig.getBoolean({ key });
    return value;
  } catch (error) {
    console.error(`Error getting boolean config for key ${key}:`, error);
    throw error;
  }
};

// Helper function to get a number value from Remote Config
export const getRemoteConfigNumber = async (key: string): Promise<number> => {
  try {
    const { value } = await FirebaseRemoteConfig.getNumber({ key });
    return value;
  } catch (error) {
    console.error(`Error getting number config for key ${key}:`, error);
    throw error;
  }
};

// Helper function to get a string value from Remote Config
export const getRemoteConfigString = async (key: string): Promise<string> => {
  try {
    const { value } = await FirebaseRemoteConfig.getString({ key });
    return value;
  } catch (error) {
    console.error(`Error getting string config for key ${key}:`, error);
    throw error;
  }
};

// Helper function to add a config update listener
export const addConfigUpdateListener = async (callback: (event: any) => void) => {
  try {
    const callbackId = await FirebaseRemoteConfig.addConfigUpdateListener((event, error) => {
      if (error) {
        console.error('Config update error:', error);
        return;
      }
      callback(event);
    });
    return callbackId;
  } catch (error) {
    console.error('Error adding config update listener:', error);
    throw error;
  }
};

// Helper function to remove a config update listener
export const removeConfigUpdateListener = async (id: string) => {
  try {
    await FirebaseRemoteConfig.removeConfigUpdateListener({ id });
  } catch (error) {
    console.error('Error removing config update listener:', error);
    throw error;
  }
};

// Helper function to remove all config update listeners
export const removeAllConfigListeners = async () => {
  try {
    await FirebaseRemoteConfig.removeAllListeners();
  } catch (error) {
    console.error('Error removing all config listeners:', error);
    throw error;
  }
};

// Initialize Remote Config when in browser environment
if (typeof window !== 'undefined') {
  // Initialize Firebase and Remote Config
  initializeFirebase()
    .then(() => initializeRemoteConfig())
    .catch(console.error);

  // ... rest of initialization code ...
}