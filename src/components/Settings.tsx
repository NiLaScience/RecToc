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
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Capacitor } from '@capacitor/core';
import { FirebaseFirestore } from '@capacitor-firebase/firestore';
import type { UserProfile, UserProfileUpdate } from '../types/user';

const Settings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [description, setDescription] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [presentToast] = useIonToast();

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  const loadUserProfile = async () => {
    if (!user) return;

    try {
      let profileData: UserProfile | null = null;

      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseFirestore.getDocument({
          reference: `/users/${user.uid}`
        });
        if (result && 'data' in result) {
          profileData = result.data as UserProfile;
        }
      } else {
        const db = getFirestore();
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          profileData = docSnap.data() as UserProfile;
        }
      }

      if (profileData) {
        setProfile(profileData);
        setDisplayName(profileData.displayName || '');
        setUsername(profileData.username || '');
        setDescription(profileData.description || '');
        setPhotoPreview(profileData.photoURL || '');
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading profile:', error);
      presentToast({
        message: 'Failed to load profile',
        duration: 3000,
        color: 'danger'
      });
      setLoading(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!user) return;

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
      let photoURL = profile?.photoURL || '';

      if (photoFile) {
        const storage = getStorage();
        const photoRef = ref(storage, `users/${user.uid}/profile.jpg`);
        await uploadBytes(photoRef, photoFile);
        photoURL = await getDownloadURL(photoRef);
      }

      const timestamp = new Date().toISOString();
      
      if (!profile) {
        // Create new profile
        const newProfile: UserProfile = {
          uid: user.uid,
          displayName: displayName.trim(),
          username: username.trim(),
          description: description.trim(),
          photoURL,
          createdAt: timestamp,
          updatedAt: timestamp
        };

        if (Capacitor.isNativePlatform()) {
          await FirebaseFirestore.setDocument({
            reference: `/users/${user.uid}`,
            data: newProfile
          });
        } else {
          const db = getFirestore();
          await setDoc(doc(db, 'users', user.uid), newProfile);
        }
      } else {
        // Update existing profile
        const updateData: UserProfileUpdate = {
          displayName: displayName.trim(),
          username: username.trim(),
          description: description.trim(),
          photoURL,
          updatedAt: timestamp
        };

        if (Capacitor.isNativePlatform()) {
          await FirebaseFirestore.updateDocument({
            reference: `/users/${user.uid}`,
            data: updateData
          });
        } else {
          const db = getFirestore();
          await setDoc(doc(db, 'users', user.uid), updateData, { merge: true });
        }
      }

      // Reload profile after save
      await loadUserProfile();

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
          <IonLabel position="stacked">Display Name</IonLabel>
          <IonInput
            value={displayName}
            onIonChange={e => setDisplayName(e.detail.value!)}
            placeholder="Enter your display name"
          />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Username</IonLabel>
          <IonInput
            value={username}
            onIonChange={e => setUsername(e.detail.value!)}
            placeholder="Enter your username"
          />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Description</IonLabel>
          <IonTextarea
            value={description}
            onIonChange={e => setDescription(e.detail.value!)}
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
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Settings; 