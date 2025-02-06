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
import type { VideoItem } from '../types/video';
import { addSnapshotListener, removeSnapshotListener } from '../config/firebase';

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
    let callbackId: string;

    const setupFeedListener = async () => {
      try {
        console.log('Setting up feed listener...');
        setLoading(true);
        
        callbackId = await addSnapshotListener('videos', (documents) => {
          console.log('Feed update received:', {
            documentsCount: documents.length,
            firstDocId: documents[0]?.id,
            timestamp: new Date().toISOString()
          });
          
          const fetchedVideos = documents.map((doc: any) => {
            console.log('Processing document:', {
              id: doc.id,
              title: doc.data.title,
              createdAt: doc.data.createdAt
            });
            return {
              ...doc.data,
              id: doc.id
            };
          });
          
          const sortedVideos = fetchedVideos.sort((a: VideoItem, b: VideoItem) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          
          console.log('Updating feed with sorted videos:', {
            totalVideos: sortedVideos.length,
            newestVideo: sortedVideos[0]?.title,
            newestDate: sortedVideos[0]?.createdAt
          });
          
          setVideos(sortedVideos);
          setLoading(false);
        });
        
        console.log('Feed listener setup complete, callbackId:', callbackId);
      } catch (error) {
        console.error('Error setting up feed listener:', error);
        setLoading(false);
      }
    };

    setupFeedListener();

    return () => {
      if (callbackId) {
        console.log('Cleaning up feed listener:', callbackId);
        removeSnapshotListener(callbackId).catch(console.error);
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

  const handleVideoEnd = () => {
    if (currentVideoIndex < videos.length - 1) {
      setCurrentVideoIndex(prev => prev + 1);
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
              onEnded={handleVideoEnd}
            />
          </div>
        )}
        <IonFab vertical="bottom" horizontal="center" slot="fixed" style={{ marginBottom: '16px' }} data-feed-toggle>
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