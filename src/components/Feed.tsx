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
import ApplicationModal from './ApplicationModal';
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
  const [mode, setMode] = useState<FeedMode>('grid');
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [showApplication, setShowApplication] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeId = addSnapshotListener(
      'videos',
      null,
      (data) => {
        if (data) {
          setVideos(data as VideoItem[]);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error loading videos:', error);
        setLoading(false);
      }
    );

    return () => {
      if (unsubscribeId) {
        removeSnapshotListener(unsubscribeId);
      }
    };
  }, []);

  const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
    // Refresh will happen automatically through the snapshot listener
    event.detail.complete();
  };

  const handleVideoClick = (video: VideoItem) => {
    if (mode === 'grid') {
      setSelectedVideo(video);
      setMode('fullscreen');
    }
  };

  const handleApply = (jobId: string) => {
    setSelectedJobId(jobId);
    setShowApplication(true);
  };

  const handleCloseApplication = () => {
    setShowApplication(false);
    setSelectedJobId(null);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Feed</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setMode(mode === 'grid' ? 'fullscreen' : 'grid')}>
              <IonIcon icon={gridOutline} />
            </IonButton>
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

        {mode === 'grid' ? (
          <div style={feedContainerStyle}>
            {videos.map((video) => (
              <FeedCard
                key={video.id}
                video={video}
                onClick={() => handleVideoClick(video)}
                onApply={() => handleApply(video.id)}
              />
            ))}
            {!loading && videos.length === 0 && (
              <div style={emptyStateStyle}>
                <p>No videos yet</p>
              </div>
            )}
          </div>
        ) : (
          selectedVideo && (
            <div style={fullscreenVideoStyle}>
              <VideoPlayer
                video={selectedVideo}
                onClose={() => {
                  setMode('grid');
                  setSelectedVideo(null);
                }}
                onApply={() => handleApply(selectedVideo.id)}
              />
            </div>
          )
        )}

        <Notifications
          isOpen={showNotifications}
          onClose={() => setShowNotifications(false)}
        />

        {showApplication && selectedJobId && (
          <ApplicationModal
            isOpen={showApplication}
            onClose={handleCloseApplication}
            jobId={selectedJobId}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default Feed;