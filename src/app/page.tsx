'use client';

import { IonReactRouter } from '@ionic/react-router';
import IonicWrapper from '../components/IonicWrapper';
import TabBar from '../components/TabBar';
import Auth from '../components/Auth';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';

export default function Page() {
  const { user, loading } = useAuth();

  useEffect(() => {
    console.log('Auth state in Page:', { user, loading });
  }, [user, loading]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <IonicWrapper>
      {user ? (
        <TabBar />
      ) : (
        <Auth />
      )}
    </IonicWrapper>
  );
}
