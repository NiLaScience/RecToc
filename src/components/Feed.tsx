'use client';

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  RefresherEventDetail,
} from '@ionic/react';
import { useState, useEffect } from 'react';
import { notificationsOutline } from 'ionicons/icons';
import Notifications from './Notifications';
import useStore from '@/store';
import FeedCard from './FeedCard';
import { FeedItem } from '@/store';

const feedContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  padding: '1rem'
};

const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%'
};

const Feed = () => {
  const { homeItems } = useStore();
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    console.log('Feed component mounted');
    console.log('homeItems:', homeItems);
    if (homeItems && homeItems.length > 0) {
      console.log('First item:', homeItems[0]);
    }
  }, [homeItems]);

  const handleRefresh = (event: CustomEvent<RefresherEventDetail>) => {
    setTimeout(() => {
      event.detail.complete();
    }, 1500);
  };

  if (!homeItems || homeItems.length === 0) {
    console.log('No items in feed');
    return (
      <div style={emptyStateStyle}>
        <p style={{ color: '#6b7280' }}>No items in feed</p>
      </div>
    );
  }

  console.log('Rendering feed with', homeItems.length, 'items');
  
  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonTitle>Feed</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setShowNotifications(true)}>
              <IonIcon icon={notificationsOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>
        <IonHeader collapse="condense" className="ion-no-border">
          <IonToolbar>
            <IonTitle size="large">Feed</IonTitle>
          </IonToolbar>
        </IonHeader>
        <Notifications
          open={showNotifications}
          onDidDismiss={() => setShowNotifications(false)}
        />
        <div style={feedContainerStyle}>
          {homeItems.map((item: FeedItem) => {
            console.log('Rendering item:', item.title);
            return <FeedCard key={item.title} item={item} />;
          })}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Feed; 