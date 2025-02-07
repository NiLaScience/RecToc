'use client';

import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { FirebaseFirestore } from '@capacitor-firebase/firestore';
import { FirebaseStorage } from '@capacitor-firebase/storage';
import { FirebaseApp } from '@capacitor-firebase/app';
import { FirebaseFunctions } from '@capacitor-firebase/functions';
import { FirebaseRemoteConfig } from '@capacitor-firebase/remote-config';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
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
let isInitialized = false;
let db: any = null;

const initializeFirebase = async () => {
  if (isInitialized) return;
  
  try {
    if (Capacitor.isNativePlatform()) {
      // For native platforms, Firebase is initialized in the native layer
      // We just need to verify it's working by getting the app name
      try {
        await FirebaseApp.getName();
        isInitialized = true;
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
        // Initialize Firestore
        db = getFirestore(app);
        isInitialized = true;
        if (process.env.NODE_ENV === 'development') {
          console.log('Firebase Web initialized successfully');
        }
      } catch (error: any) {
        if (error.code === 'app/duplicate-app') {
          isInitialized = true;
        } else {
          console.error('Error initializing Firebase for web:', error);
          throw error;
        }
      }
    }
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    throw error;
  }
};

// Initialize immediately in browser environment
if (typeof window !== 'undefined') {
  initializeFirebase().catch(console.error);
}

// Ensure Firebase is initialized before any operation
const ensureInitialized = async () => {
  if (!isInitialized) {
    await initializeFirebase();
  }
};

// Helper function to get the current user's ID token
export const getIdToken = async (): Promise<string | null> => {
  await ensureInitialized();
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
  await ensureInitialized();
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
  await ensureInitialized();
  try {
    await FirebaseAuthentication.signOut();
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

// Helper function to upload a file to Firebase Storage
export const uploadFile = async (path: string, uri?: string, metadata?: { contentType?: string; blob?: Blob }) => {
  await ensureInitialized();
  try {
    await new Promise<void>((resolve, reject) => {
      FirebaseStorage.uploadFile(
        {
          path,
          ...(uri && { uri }),
          ...(metadata?.blob && { blob: metadata.blob }),
          metadata: {
            contentType: metadata?.contentType
          }
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
  await ensureInitialized();
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
  await ensureInitialized();
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
  await ensureInitialized();
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
  await ensureInitialized();
  try {
    // Check if this is a collection reference with query params
    const [path, queryString] = reference.split('?');
    const segments = path.split('/');
    console.log('Setting up snapshot listener for:', reference);
    
    if (segments.length % 2 === 1) {
      // Collection reference
      interface FirestoreFilter {
        fieldPath: string;
        opStr: string;
        value: any;
      }
      
      const filters: FirestoreFilter[] = [];
      
      // Parse query string if present
      if (queryString) {
        const params = new URLSearchParams(queryString);
        Array.from(params.entries()).forEach(([field, value]) => {
          // Handle special array-based filters
          if (field === '__name__-in') {
            const ids = value.split(',');
            filters.push({
              fieldPath: '__name__',
              opStr: 'in',
              value: ids.map(id => `${path}/${id}`) // Convert to full document path
            });
          } else if (field === '__name__-not-in') {
            const ids = value.split(',');
            filters.push({
              fieldPath: '__name__',
              opStr: 'not-in',
              value: ids.map(id => `${path}/${id}`) // Convert to full document path
            });
          } else if (field === 'id-in') {
            const ids = value.split(',');
            filters.push({
              fieldPath: 'id',
              opStr: 'in',
              value: ids
            });
          } else if (field === 'id-not-in') {
            const ids = value.split(',');
            filters.push({
              fieldPath: 'id',
              opStr: 'not-in',
              value: ids
            });
          } else {
            filters.push({
              fieldPath: field,
              opStr: '==',
              value
            });
          }
        });
      }

      console.log('Applying filters:', filters);

      const callbackId = await FirebaseFirestore.addCollectionSnapshotListener(
        { 
          reference: path,
          ...(filters.length > 0 && { filters })
        },
        (event, error) => {
          if (error) {
            console.error('Snapshot listener error:', error);
            return;
          }
          if (event?.snapshots) {
            console.log('Collection snapshot received:', path, event.snapshots.length, 'documents');
            const documents = event.snapshots.map(snapshot => {
              const data = typeof snapshot.data === 'object' ? snapshot.data : {};
              return {
                id: snapshot.id,
                ...data
              };
            });
            callback(documents);
          }
        }
      );
      return callbackId;
    } else {
      // Document reference
      const callbackId = await FirebaseFirestore.addDocumentSnapshotListener(
        { reference: path },
        (event, error) => {
          if (error) {
            console.error('Snapshot listener error:', error);
            return;
          }
          if (event?.snapshot?.data) {
            console.log('Document snapshot received:', path);
            callback(event.snapshot.data);
          }
        }
      );
      return callbackId;
    }
  } catch (error) {
    console.error('Error adding snapshot listener:', error);
    throw error;
  }
};

// Helper function to remove a snapshot listener
export const removeSnapshotListener = async (callbackId: string) => {
  await ensureInitialized();
  try {
    await FirebaseFirestore.removeSnapshotListener({ callbackId });
  } catch (error) {
    console.error('Error removing snapshot listener:', error);
    throw error;
  }
};

// Helper function to call a Firebase Function
export const callFunction = async (name: string, data?: any) => {
  await ensureInitialized();
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
  await ensureInitialized();
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
  await ensureInitialized();
  try {
    await FirebaseRemoteConfig.fetchAndActivate();
  } catch (error) {
    console.error('Error fetching and activating config:', error);
    throw error;
  }
};

// Helper function to get a boolean value from Remote Config
export const getRemoteConfigBoolean = async (key: string): Promise<boolean> => {
  await ensureInitialized();
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
  await ensureInitialized();
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
  await ensureInitialized();
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
  await ensureInitialized();
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
  await ensureInitialized();
  try {
    await FirebaseRemoteConfig.removeConfigUpdateListener({ id });
  } catch (error) {
    console.error('Error removing config update listener:', error);
    throw error;
  }
};

// Helper function to remove all config update listeners
export const removeAllConfigListeners = async () => {
  await ensureInitialized();
  try {
    await FirebaseRemoteConfig.removeAllListeners();
  } catch (error) {
    console.error('Error removing all config listeners:', error);
    throw error;
  }
};

export interface RejectedJob {
  id: string;
  jobId: string;
  userId: string;
  rejectedAt: string;
}

// Helper function to get a collection from Firestore with proper typing
export const getCollection = async <T extends { id: string }>(
  collection: string,
  options?: { where: [string, string, any][] }
): Promise<T[]> => {
  await ensureInitialized();
  try {
    const result = await FirebaseFirestore.getCollection({
      reference: collection,
      ...(options && {
        filters: options.where.map(([field, op, value]) => ({
          fieldPath: field,
          opStr: op,
          value
        }))
      })
    });
    
    if (!result || !Array.isArray(result.snapshots)) {
      return [];
    }

    return result.snapshots.map(snapshot => {
      const data = typeof snapshot.data === 'object' ? snapshot.data : {};
      return {
        ...data,
        id: snapshot.id,
      } as T;
    });
  } catch (error) {
    console.error('Error getting collection:', error);
    throw error;
  }
};

// Helper functions for rejected jobs
export const rejectJob = async (jobId: string): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) throw new Error('User not authenticated');
  
  await addDocument('rejectedJobs', {
    userId: user.uid,
    jobId,
    rejectedAt: new Date().toISOString()
  });
};

export const unrejectJob = async (rejectedJobId: string): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) throw new Error('User not authenticated');
  
  // Delete the rejection document directly using its ID
  await deleteDocument(`rejectedJobs/${rejectedJobId}`);
};

export const getRejectedJobs = async (): Promise<RejectedJob[]> => {
  const user = await getCurrentUser();
  if (!user) throw new Error('User not authenticated');
  
  return await getCollection<RejectedJob>('rejectedJobs', {
    where: [['userId', '==', user.uid]]
  });
};

// Helper function to delete a document from Firestore
export const deleteDocument = async (reference: string) => {
  await ensureInitialized();
  try {
    await FirebaseFirestore.deleteDocument({
      reference
    });
  } catch (error) {
    console.error('Error deleting document:', error);
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

export { db };