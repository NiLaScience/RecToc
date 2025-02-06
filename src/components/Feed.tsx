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
  IonSpinner,
} from '@ionic/react';
import { useState, useEffect } from 'react';
import { notificationsOutline, gridOutline, videocamOutline } from 'ionicons/icons';
import Notifications from './Notifications';
import FeedCard from './FeedCard';
import VideoPlayer from './VideoPlayer';
import ApplicationModal from './ApplicationModal';
import type { VideoItem } from '../types/video';
import { addSnapshotListener, removeSnapshotListener } from '../config/firebase';
import AppHeader from './AppHeader';

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
  backgroundColor: '#000',
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  overflow: 'hidden'
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

  const headerStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: mode === 'fullscreen' ? '#000' : undefined,
  };

  useEffect(() => {
    let unsubscribeId: string | null = null;

    const setupListener = async () => {
      try {
        setLoading(true);
        // Listen to videos collection
        unsubscribeId = await addSnapshotListener(
          'videos',
          (data) => {
            if (Array.isArray(data)) {
              // Data is already in the correct format, just need to sort
              const sortedVideos = data.sort((a, b) => {
                const dateA = new Date(a.createdAt).getTime();
                const dateB = new Date(b.createdAt).getTime();
                return dateB - dateA;
              });
              
              console.log('Processed videos:', sortedVideos); // Debug log
              setVideos(sortedVideos as VideoItem[]);
            }
            setLoading(false);
          }
        );
      } catch (error) {
        console.error('Error setting up video listener:', error);
        setLoading(false);
      }
    };

    setupListener();

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
      <AppHeader
        title="Feed"
        mode={mode}
        showFeedButtons
        onToggleView={() => {
          if (mode === 'grid') {
            if (!selectedVideo && videos.length > 0) {
              setSelectedVideo(videos[0]);
            }
            setMode('fullscreen');
          } else {
            setMode('grid');
          }
        }}
        onNotifications={() => setShowNotifications(true)}
      />

      <style>{`
        .dark-toolbar {
          --background: #000;
          --color: #fff;
          --ion-color-primary: #fff;
          --ion-toolbar-background: #000;
        }
        ion-content {
          --padding-top: 56px;
        }
      `}</style>

      <IonContent 
        scrollY={mode === 'grid'} 
        fullscreen
      >
        {loading ? (
          <div style={emptyStateStyle}>
            <IonSpinner />
          </div>
        ) : mode === 'grid' ? (
          <div style={feedContainerStyle}>
            {videos.length > 0 ? (
              videos.map((video) => (
                <FeedCard
                  key={video.id}
                  video={video}
                  onClick={() => handleVideoClick(video)}
                />
              ))
            ) : (
              <div style={emptyStateStyle}>
                <p>No videos available</p>
              </div>
            )}
          </div>
        ) : (
          <div style={fullscreenVideoStyle}>
            {selectedVideo && (
              <VideoPlayer
                video={selectedVideo}
                autoPlay
                mode="feed"
                onEnded={() => {
                  // Find next video
                  const currentIndex = videos.findIndex(v => v.id === selectedVideo.id);
                  const nextVideo = videos[currentIndex + 1];
                  if (nextVideo) {
                    setSelectedVideo(nextVideo);
                  } else {
                    setMode('grid');
                  }
                }}
                onSwipe={(direction) => {
                  const currentIndex = videos.findIndex(v => v.id === selectedVideo.id);
                  if (direction === 'up' && currentIndex < videos.length - 1) {
                    setSelectedVideo(videos[currentIndex + 1]);
                  } else if (direction === 'down' && currentIndex > 0) {
                    setSelectedVideo(videos[currentIndex - 1]);
                  } else if (direction === 'down' && currentIndex === 0) {
                    setMode('grid');
                  }
                }}
              />
            )}
          </div>
        )}

        <Notifications
          open={showNotifications}
          onDidDismiss={() => setShowNotifications(false)}
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