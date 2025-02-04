'use client';

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonButton,
  IonSpinner,
  IonAvatar,
  useIonToast,
} from '@ionic/react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getFirestore, doc, onSnapshot, setDoc, getDoc, DocumentData } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Capacitor } from '@capacitor/core';
import { FirebaseFirestore } from '@capacitor-firebase/firestore';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { useRouter } from 'next/navigation';
import type { UserProfile, UserProfileUpdate } from '../types/user';
import type { AddDocumentSnapshotListenerCallbackEvent } from '@capacitor-firebase/firestore';

const Settings = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [description, setDescription] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [presentToast] = useIonToast();
  const pendingChangesRef = useRef<Set<string>>(new Set());

  // Helper function to update all profile-related state
  const updateProfileState = (profileData: UserProfile, isLocalUpdate = false) => {
    setProfile(profileData);
    
    // Only update fields that don't have pending changes
    if (!pendingChangesRef.current.has('displayName')) {
      setDisplayName(profileData.displayName || '');
    }
    if (!pendingChangesRef.current.has('username')) {
      setUsername(profileData.username || '');
    }
    if (!pendingChangesRef.current.has('description')) {
      setDescription(profileData.description || '');
    }
    if (!pendingChangesRef.current.has('photoURL')) {
      setPhotoPreview(profileData.photoURL || '');
    }
  };

  // Track field changes
  const handleFieldChange = (field: string, value: string) => {
    pendingChangesRef.current.add(field);
    switch (field) {
      case 'displayName':
        setDisplayName(value);
        break;
      case 'username':
        setUsername(value);
        break;
      case 'description':
        setDescription(value);
        break;
    }
  };

  // Track photo changes
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      pendingChangesRef.current.add('photoURL');
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }

    let unsubscribe: (() => void) | undefined;

    const setupProfileListener = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          await FirebaseFirestore.addDocumentSnapshotListener({
            reference: `/users/${user.uid}`,
          }, (event: AddDocumentSnapshotListenerCallbackEvent<DocumentData> | null) => {
            if (event?.snapshot?.data) {
              const profileData = event.snapshot.data as UserProfile;
              updateProfileState(profileData);
            }
            setLoading(false);
          });
        } else {
          const db = getFirestore();
          const docRef = doc(db, 'users', user.uid);
          unsubscribe = onSnapshot(docRef, (doc) => {
            if (doc.exists()) {
              const profileData = doc.data() as UserProfile;
              updateProfileState(profileData);
            }
            setLoading(false);
          }, (error) => {
            console.error('Error listening to profile updates:', error);
            presentToast({
              message: 'Failed to listen to profile updates',
              duration: 3000,
              color: 'danger'
            });
            setLoading(false);
          });
        }
      } catch (error) {
        console.error('Error setting up profile listener:', error);
        presentToast({
          message: 'Failed to set up profile updates',
          duration: 3000,
          color: 'danger'
        });
        setLoading(false);
      }
    };

    setupProfileListener();

    return () => {
      if (Capacitor.isNativePlatform()) {
        FirebaseFirestore.removeAllListeners();
      } else if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user, router]);

  const handleSave = async () => {
    if (!user) {
      presentToast({
        message: 'You must be logged in to save profile',
        duration: 3000,
        color: 'warning'
      });
      return;
    }

    // Validate required fields
    if (!displayName.trim() || !username.trim()) {
      presentToast({
        message: 'Display name and username are required',
        duration: 3000,
        color: 'warning'
      });
      return;
    }

    setSaving(true);

    try {
      const timestamp = new Date().toISOString();
      const updates: Partial<UserProfile> = {};
      let hasChanges = false;

      // Only include fields that have actually changed
      if (displayName.trim() !== profile?.displayName) {
        updates.displayName = displayName.trim();
        hasChanges = true;
      }
      
      if (username.trim() !== profile?.username) {
        updates.username = username.trim();
        hasChanges = true;
      }
      
      if (description.trim() !== profile?.description) {
        updates.description = description.trim();
        hasChanges = true;
      }

      // Handle photo upload separately
      if (photoFile) {
        try {
          const storage = getStorage();
          const photoRef = ref(storage, `users/${user.uid}/profile.jpg`);
          await uploadBytes(photoRef, photoFile);
          const photoURL = await getDownloadURL(photoRef);
          updates.photoURL = photoURL;
          hasChanges = true;
        } catch (error) {
          console.error('Error uploading photo:', error);
          presentToast({
            message: 'Failed to upload photo',
            duration: 3000,
            color: 'warning'
          });
        }
      }

      if (!hasChanges) {
        presentToast({
          message: 'No changes to save',
          duration: 3000,
          color: 'success'
        });
        setSaving(false);
        return;
      }

      // Add metadata
      updates.updatedAt = timestamp;

      if (Capacitor.isNativePlatform()) {
        console.log('Saving profile updates on native platform:', updates);
        
        // Update fields atomically one at a time
        for (const [field, value] of Object.entries(updates)) {
          await FirebaseFirestore.setDocument({
            reference: `/users/${user.uid}`,
            data: { [field]: value },
            merge: true
          });
          
          // Small delay between updates to prevent race conditions
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } else {
        const db = getFirestore();
        const docRef = doc(db, 'users', user.uid);
        
        // For web, we can use a single atomic update
        await setDoc(docRef, updates, { merge: true });
      }

      // Fetch the latest state after all updates
      if (Capacitor.isNativePlatform()) {
        const updatedDoc = await FirebaseFirestore.getDocument({ 
          reference: `/users/${user.uid}` 
        });
        if (updatedDoc?.snapshot?.data) {
          updateProfileState(updatedDoc.snapshot.data as UserProfile);
        }
      } else {
        const updatedDoc = await getDoc(doc(getFirestore(), 'users', user.uid));
        if (updatedDoc.exists()) {
          updateProfileState(updatedDoc.data() as UserProfile);
        }
      }

      presentToast({
        message: 'Profile saved successfully',
        duration: 3000,
        color: 'success'
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      presentToast({
        message: 'Failed to save profile',
        duration: 3000,
        color: 'danger'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        await FirebaseAuthentication.signOut();
      } else {
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        await auth.signOut();
      }
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
      presentToast({
        message: 'Failed to sign out',
        duration: 3000,
        color: 'danger'
      });
    }
  };

  if (loading) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Settings</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <div className="ion-text-center">
            <IonSpinner />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="ion-text-center ion-padding">
          <IonAvatar style={{ width: '120px', height: '120px', margin: '0 auto' }}>
            <img
              src={photoPreview || 'https://ionicframework.com/docs/img/demos/avatar.svg'}
              alt="Profile"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </IonAvatar>
          <input
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            style={{ display: 'none' }}
            id="photo-upload"
          />
          <IonButton
            fill="clear"
            onClick={() => document.getElementById('photo-upload')?.click()}
          >
            Change Photo
          </IonButton>
        </div>

        <IonItem>
          <IonLabel position="stacked" color="medium">Email</IonLabel>
          <IonInput
            value={user?.email || 'No email provided'}
            readonly
            className="ion-margin-top"
            style={{ opacity: 0.7 }}
          />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Display Name</IonLabel>
          <IonInput
            value={displayName}
            onIonChange={e => handleFieldChange('displayName', e.detail.value!)}
            placeholder="Enter your display name"
          />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Username</IonLabel>
          <IonInput
            value={username}
            onIonChange={e => handleFieldChange('username', e.detail.value!)}
            placeholder="Enter your username"
          />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Description</IonLabel>
          <IonTextarea
            value={description}
            onIonChange={e => handleFieldChange('description', e.detail.value!)}
            placeholder="Tell us about yourself"
            rows={4}
          />
        </IonItem>

        <div className="ion-padding">
          <IonButton
            expand="block"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <IonSpinner name="crescent" /> : 'Save Profile'}
          </IonButton>

          <IonButton
            expand="block"
            color="danger"
            className="ion-margin-top"
            onClick={handleSignOut}
          >
            Sign Out
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Settings; 