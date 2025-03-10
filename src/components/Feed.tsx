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
  IonFab,
  IonFabButton,
} from '@ionic/react';
import { useState, useEffect } from 'react';
import { notificationsOutline, gridOutline, videocamOutline } from 'ionicons/icons';
import Notifications from './Notifications';
import FeedCard from './FeedCard';
import VideoPlayer from './VideoPlayer';
import { getFirestore, collection, query, orderBy, onSnapshot, DocumentData } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { FirebaseFirestore } from '@capacitor-firebase/firestore';
import type { AddCollectionSnapshotListenerCallbackEvent } from '@capacitor-firebase/firestore';

export interface VideoItem {
  id: string;
  title: string;
  videoUrl: string;
  tags: string[];
  userId: string;
  createdAt: string;
  views: number;
  likes: number;
}

interface FirestoreDoc {
  id: string;
  data: {
    title: string;
    videoUrl: string;
    tags: string[];
    userId: string;
    createdAt: string;
    views: number;
    likes: number;
  };
}

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

const fullscreenVideoStyle: React.CSSProperties = {
  height: '100%',
  width: '100%',
  backgroundColor: '#000'
};

type FeedMode = 'grid' | 'fullscreen';

const Feed = () => {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [feedMode, setFeedMode] = useState<FeedMode>('grid');
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  useEffect(() => {
    let unsubscribe: () => void;

    const setupFeedListener = async () => {
      try {
        setLoading(true);
        
        if (Capacitor.isNativePlatform()) {
          // Use native Firestore plugin
          await FirebaseFirestore.addCollectionSnapshotListener({
            reference: '/videos'
          }, (event: AddCollectionSnapshotListenerCallbackEvent<DocumentData> | null) => {
            if (event?.snapshots) {
              const fetchedVideos = event.snapshots
                .map(doc => ({
                  ...doc.data as Omit<VideoItem, 'id'>,
                  id: doc.id
                }))
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
              setVideos(fetchedVideos);
            }
            setLoading(false);
          });
        } else {
          // Use web SDK
          const db = getFirestore();
          const videosRef = collection(db, 'videos');
          const q = query(videosRef, orderBy('createdAt', 'desc'));
          
          unsubscribe = onSnapshot(q, (querySnapshot) => {
            const fetchedVideos: VideoItem[] = [];
            querySnapshot.forEach((doc) => {
              fetchedVideos.push({
                ...doc.data(),
                id: doc.id
              } as VideoItem);
            });
            setVideos(fetchedVideos);
            setLoading(false);
          });
        }
      } catch (error) {
        console.error('Error setting up feed listener:', error);
        setLoading(false);
      }
    };

    setupFeedListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      if (Capacitor.isNativePlatform()) {
        FirebaseFirestore.removeAllListeners();
      }
    };
  }, []);

  const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
    // No need to manually refresh with real-time updates
    event.detail.complete();
  };

  const handleVideoSwipe = (direction: 'up' | 'down') => {
    if (direction === 'up' && currentVideoIndex < videos.length - 1) {
      setCurrentVideoIndex(prev => prev + 1);
    } else if (direction === 'down' && currentVideoIndex > 0) {
      setCurrentVideoIndex(prev => prev - 1);
    }
  };

  const toggleFeedMode = () => {
    setFeedMode(prev => prev === 'grid' ? 'fullscreen' : 'grid');
  };

  if (loading) {
    return (
      <IonPage>
        <IonHeader className="ion-no-border">
          <IonToolbar>
            <IonTitle>Feed</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={emptyStateStyle}>
            <p style={{ color: '#6b7280' }}>Loading videos...</p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (!videos || videos.length === 0) {
    return (
      <IonPage>
        <IonHeader className="ion-no-border">
          <IonToolbar>
            <IonTitle>Feed</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={emptyStateStyle}>
            <p style={{ color: '#6b7280' }}>No videos available</p>
          </div>
        </IonContent>
      </IonPage>
    );
  }
  
  return (
    <IonPage>
      {feedMode === 'grid' && (
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
      )}
      <IonContent fullscreen={feedMode === 'fullscreen'}>
        {feedMode === 'grid' ? (
          <>
            <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
              <IonRefresherContent />
            </IonRefresher>
            <IonHeader collapse="condense" className="ion-no-border">
              <IonToolbar>
                <IonTitle size="large">Feed</IonTitle>
              </IonToolbar>
            </IonHeader>
            <div style={feedContainerStyle}>
              {videos.map((video) => (
                <FeedCard key={video.id} video={video} />
              ))}
            </div>
          </>
        ) : (
          <div style={fullscreenVideoStyle}>
            <VideoPlayer
              video={videos[currentVideoIndex]}
              onSwipe={handleVideoSwipe}
              autoPlay
            />
          </div>
        )}
        <IonFab vertical="bottom" horizontal="center" slot="fixed" style={{ marginBottom: '16px' }}>
          <IonFabButton onClick={toggleFeedMode} color={feedMode === 'grid' ? 'primary' : 'light'}>
            <IonIcon icon={feedMode === 'grid' ? videocamOutline : gridOutline} />
          </IonFabButton>
        </IonFab>
        <Notifications
          open={showNotifications}
          onDidDismiss={() => setShowNotifications(false)}
        />
      </IonContent>
    </IonPage>
  );
};

export default Feed; 