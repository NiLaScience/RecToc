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
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { useRouter } from 'next/navigation';
import type { UserProfile } from '../types/user';
import { uploadFile, addSnapshotListener, updateDocument, removeSnapshotListener } from '../config/firebase';

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
  const updateProfileState = (profileData: UserProfile) => {
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
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    let callbackId: string;

    const setupProfileListener = async () => {
      try {
        callbackId = await addSnapshotListener(`users/${user.uid}`, (profileData) => {
          updateProfileState(profileData as UserProfile);
          setLoading(false);
        });
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
      if (callbackId) {
        removeSnapshotListener(callbackId).catch(console.error);
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

      // Handle photo upload
      if (photoFile) {
        try {
          // Convert File to base64 for filesystem
          const arrayBuffer = await photoFile.arrayBuffer();
          const base64Data = Buffer.from(arrayBuffer).toString('base64');
          
          // Save to filesystem temporarily
          const tempFileName = `profile_${Date.now()}.jpg`;
          await Filesystem.writeFile({
            path: tempFileName,
            data: base64Data,
            directory: Directory.Cache
          });

          // Get the file URI
          const fileInfo = await Filesystem.getUri({
            path: tempFileName,
            directory: Directory.Cache
          });

          // Upload to Firebase Storage
          const photoURL = await uploadFile(
            `users/${user.uid}/profile.jpg`,
            fileInfo.uri,
            { contentType: 'image/jpeg' }
          );

          // Clean up temp file
          await Filesystem.deleteFile({
            path: tempFileName,
            directory: Directory.Cache
          });

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

      // Update document
      await updateDocument(`users/${user.uid}`, updates);

      presentToast({
        message: 'Profile updated successfully',
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
      pendingChangesRef.current.clear();
    }
  };

  if (loading) {
    return (
      <IonPage>
        <IonContent className="ion-padding">
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <IonSpinner />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonHeader collapse="condense" className="ion-no-border">
          <IonToolbar>
            <IonTitle size="large">Settings</IonTitle>
          </IonToolbar>
        </IonHeader>

        <div className="ion-padding">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                style={{ display: 'none' }}
                id="photo-upload"
              />
              <label htmlFor="photo-upload">
                <IonAvatar style={{ width: '100px', height: '100px', cursor: 'pointer' }}>
                  <img
                    src={photoPreview || 'https://ionicframework.com/docs/img/demos/avatar.svg'}
                    alt={displayName || 'User'}
                  />
                </IonAvatar>
              </label>
            </div>
          </div>

          <IonItem>
            <IonLabel position="stacked">Display Name</IonLabel>
            <IonInput
              value={displayName}
              onIonInput={e => handleFieldChange('displayName', e.detail.value!)}
              placeholder="Enter your display name"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Username</IonLabel>
            <IonInput
              value={username}
              onIonInput={e => handleFieldChange('username', e.detail.value!)}
              placeholder="Enter your username"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Description</IonLabel>
            <IonTextarea
              value={description}
              onIonInput={e => handleFieldChange('description', e.detail.value!)}
              placeholder="Tell us about yourself"
              autoGrow
            />
          </IonItem>

          <IonButton
            expand="block"
            onClick={handleSave}
            className="ion-margin-top"
            disabled={saving}
          >
            {saving ? <IonSpinner name="crescent" /> : 'Save Changes'}
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Settings; 