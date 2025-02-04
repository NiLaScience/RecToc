'use client';

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
} from '@ionic/react';
import { logOutOutline } from 'ionicons/icons';
import { auth } from '../config/firebase';
import { signOut } from 'firebase/auth';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Capacitor } from '@capacitor/core';
import { useRouter } from 'next/navigation';

const Settings = () => {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        // Use Capacitor Firebase Authentication for native platforms
        await FirebaseAuthentication.signOut();
      } else {
        // Use regular Firebase Auth for web
        await signOut(auth);
      }
      // Use router instead of window.location
      router.replace('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense" className="ion-no-border">
          <IonToolbar>
            <IonTitle size="large">Settings</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonList>
          <IonItem button onClick={handleSignOut}>
            <IonIcon icon={logOutOutline} slot="start" />
            <IonLabel color="danger">Sign Out</IonLabel>
          </IonItem>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default Settings; 