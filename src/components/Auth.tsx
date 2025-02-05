'use client';

import { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonSegment,
  IonSegmentButton,
  IonIcon,
  IonText,
  IonList,
  IonNote,
} from '@ionic/react';
import { logInOutline, personAddOutline, mailOutline, lockClosedOutline } from 'ionicons/icons';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Capacitor } from '@capacitor/core';
import { useRouter } from 'next/navigation';

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const validateForm = () => {
    if (!email || !password) {
      setError('Email and password are required');
      return false;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    return true;
  };

  const handleAuth = async () => {
    if (!validateForm()) return;

    try {
      if (mode === 'login') {
        console.log('Attempting login with email:', email);
        await FirebaseAuthentication.signInWithEmailAndPassword({
          email,
          password
        });
      } else {
        console.log('Attempting signup with email:', email);
        await FirebaseAuthentication.createUserWithEmailAndPassword({
          email,
          password
        });
      }
      // Success - AuthContext will handle navigation
    } catch (error: any) {
      console.error('Auth error details:', {
        code: error.code,
        message: error.message,
        platform: Capacitor.isNativePlatform() ? 'native' : 'web'
      });
      
      // Provide more user-friendly error messages
      if (error.code === 'auth/network-request-failed') {
        setError('Network error. Please check your internet connection and try again.');
      } else if (error.code === 'auth/invalid-email') {
        setError('Invalid email address format.');
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setError('Invalid email or password.');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError(error.message || 'Authentication failed');
      }
    }
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonTitle>{mode === 'login' ? 'Login' : 'Sign Up'}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonHeader collapse="condense" className="ion-no-border">
          <IonToolbar>
            <IonTitle size="large">{mode === 'login' ? 'Login' : 'Sign Up'}</IonTitle>
          </IonToolbar>
        </IonHeader>

        <div className="ion-padding">
          <IonSegment 
            value={mode} 
            onIonChange={e => {
              setMode(e.detail.value as 'login' | 'signup');
              setError('');
            }}
          >
            <IonSegmentButton value="login">
              <IonIcon icon={logInOutline} />
              <IonLabel>Login</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="signup">
              <IonIcon icon={personAddOutline} />
              <IonLabel>Sign Up</IonLabel>
            </IonSegmentButton>
          </IonSegment>

          <IonList className="ion-margin-top">
            <IonItem>
              <IonIcon icon={mailOutline} slot="start" />
              <IonLabel position="stacked">Email</IonLabel>
              <IonInput
                type="email"
                value={email}
                onIonInput={e => setEmail(e.detail.value!)}
                placeholder="Enter your email"
              />
            </IonItem>

            <IonItem>
              <IonIcon icon={lockClosedOutline} slot="start" />
              <IonLabel position="stacked">Password</IonLabel>
              <IonInput
                type="password"
                value={password}
                onIonInput={e => setPassword(e.detail.value!)}
                placeholder="Enter your password"
              />
            </IonItem>

            {error && (
              <IonNote color="danger" className="ion-padding">
                <IonText color="danger">{error}</IonText>
              </IonNote>
            )}
          </IonList>

          <IonButton
            expand="block"
            onClick={handleAuth}
            className="ion-margin-top"
          >
            {mode === 'login' ? 'Login' : 'Sign Up'}
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
} 