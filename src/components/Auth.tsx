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
import { auth } from '../config/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Capacitor } from '@capacitor/core';
import { useRouter } from 'next/navigation';

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('Auth state changed:', user);
      // Remove the navigation, let AuthContext handle it
    });

    return () => unsubscribe();
  }, [router]);

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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) {
      return;
    }
    
    try {
      console.log('Starting authentication...', { mode, email });
      
      if (Capacitor.isNativePlatform()) {
        console.log('Using Capacitor authentication');
        // Use Capacitor Firebase Authentication for native platforms
        const result = mode === 'signup'
          ? await FirebaseAuthentication.createUserWithEmailAndPassword({ email, password })
          : await FirebaseAuthentication.signInWithEmailAndPassword({ email, password });
        
        console.log('Capacitor auth result:', result);
        
        if (result.user) {
          console.log('Authentication successful, user:', result.user);
          // Remove navigation, let AuthContext handle it
        } else {
          console.error('No user in result');
          setError('Authentication failed - no user returned');
        }
      } else {
        console.log('Using web authentication');
        // Use regular Firebase Auth for web
        if (mode === 'signup') {
          await createUserWithEmailAndPassword(auth, email, password);
        } else {
          await signInWithEmailAndPassword(auth, email, password);
        }
        // Remove navigation, let AuthContext handle it
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      // Provide more user-friendly error messages
      if (err.code === 'email-already-in-use') {
        setError('This email is already registered. Please try logging in instead.');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('Invalid email or password');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address');
      } else {
        setError(err.message || 'Authentication failed');
      }
    }
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonTitle>Welcome to RecToc</IonTitle>
        </IonToolbar>
      </IonHeader>
      
      <IonContent className="ion-padding">
        <IonHeader collapse="condense" className="ion-no-border">
          <IonToolbar>
            <IonTitle size="large">Welcome to RecToc</IonTitle>
          </IonToolbar>
        </IonHeader>

        <div className="ion-text-center ion-padding">
          <IonSegment value={mode} onIonChange={e => setMode(e.detail.value as 'login' | 'signup')}>
            <IonSegmentButton value="login">
              <IonIcon icon={logInOutline} />
              <IonLabel>Login</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="signup">
              <IonIcon icon={personAddOutline} />
              <IonLabel>Sign Up</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </div>

        <form onSubmit={handleAuth} className="ion-padding">
          <IonList>
            <IonItem>
              <IonIcon icon={mailOutline} slot="start" />
              <IonLabel position="stacked">Email</IonLabel>
              <IonInput
                type="email"
                value={email}
                onIonChange={e => setEmail(e.detail.value!)}
                required
                placeholder="Enter your email"
              />
            </IonItem>

            <IonItem className="ion-margin-bottom">
              <IonIcon icon={lockClosedOutline} slot="start" />
              <IonLabel position="stacked">Password</IonLabel>
              <IonInput
                type="password"
                value={password}
                onIonChange={e => setPassword(e.detail.value!)}
                required
                placeholder="Enter your password"
              />
              {mode === 'signup' && (
                <IonNote slot="helper">Password must be at least 6 characters</IonNote>
              )}
            </IonItem>

            {error && (
              <IonText color="danger" className="ion-padding">
                <p className="ion-text-center">{error}</p>
              </IonText>
            )}

            <IonButton expand="block" type="submit" className="ion-margin-top">
              <IonIcon icon={mode === 'login' ? logInOutline : personAddOutline} slot="start" />
              {mode === 'login' ? 'Login' : 'Sign Up'}
            </IonButton>
          </IonList>
        </form>
      </IonContent>
    </IonPage>
  );
} 