'use client';

import { useEffect, useState } from 'react';
import { IonApp } from '@ionic/react';

export default function IonicWrapper({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted ? <IonApp>{children}</IonApp> : null;
} 