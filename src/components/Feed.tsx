'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  RefresherEventDetail,
  IonFab,
  IonFabButton,
  IonSpinner,
  IonButton,
  IonIcon,
} from '@ionic/react';
import { notificationsOutline, gridOutline, videocamOutline, filterOutline } from 'ionicons/icons';
import Notifications from './Notifications';
import FeedCard from './FeedCard';
import VideoPlayer from './VideoPlayer';
import ApplicationModal from './ApplicationModal';
import type { VideoItem } from '../types/video';
import { addSnapshotListener, removeSnapshotListener } from '../config/firebase';
import { rejectJob, unrejectJob, getRejectedJobs } from '../config/firebase';
import type { RejectedJob } from '../config/firebase';
import AppHeader from './AppHeader';
import FilterPopover from './FilterHeader';

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
  const [rejectedJobIds, setRejectedJobIds] = useState<Set<string>>(new Set());
  const [showRejected, setShowRejected] = useState(false);
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const filterButtonRef = useRef<HTMLIonButtonElement>(null);

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

  useEffect(() => {
    loadRejectedJobs();
  }, []);

  const loadRejectedJobs = async () => {
    try {
      const rejected = await getRejectedJobs();
      setRejectedJobIds(new Set(rejected.map(r => r.jobId)));
    } catch (error) {
      console.error('Error loading rejected jobs:', error);
    }
  };

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

  const handleSwipe = async (direction: 'up' | 'down' | 'left' | 'right', video: VideoItem) => {
    if (direction === 'up') {
      // Previous video
      const currentIndex = filteredVideos.findIndex(v => v.id === video.id);
      if (currentIndex > 0) {
        setSelectedVideo(filteredVideos[currentIndex - 1]);
      }
    } else if (direction === 'down') {
      // Next video
      const currentIndex = filteredVideos.findIndex(v => v.id === video.id);
      if (currentIndex < filteredVideos.length - 1) {
        setSelectedVideo(filteredVideos[currentIndex + 1]);
      }
    } else if (direction === 'left') {
      // Reject job
      if (!rejectedJobIds.has(video.id)) {
        await rejectJob(video.id);
        setRejectedJobIds(new Set([...Array.from(rejectedJobIds), video.id]));
        // Move to next video if available
        const currentIndex = filteredVideos.findIndex(v => v.id === video.id);
        if (currentIndex < filteredVideos.length - 1) {
          setSelectedVideo(filteredVideos[currentIndex + 1]);
        }
      }
    } else if (direction === 'right') {
      // Show details (handled by VideoPlayer)
    }
  };

  const handleResetFilters = async () => {
    try {
      const rejected = await getRejectedJobs();
      await Promise.all(rejected.map(r => unrejectJob(r.jobId)));
      setRejectedJobIds(new Set());
    } catch (error) {
      console.error('Error resetting filters:', error);
    }
  };

  const onToggleRejected = () => {
    setShowRejected(!showRejected);
  };

  // Filter videos based on rejection status
  const filteredVideos = useMemo(() => {
    const rejectedIds = Array.from(rejectedJobIds);
    return videos.filter(video => {
      const isRejected = rejectedIds.includes(video.id);
      return showRejected ? isRejected : !isRejected;
    });
  }, [videos, rejectedJobIds, showRejected]);

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
        rightContent={
          <IonButton
            id="filter-trigger"
            fill="clear"
            ref={filterButtonRef}
            onClick={() => setShowFilterPopover(true)}
          >
            <IonIcon
              icon={filterOutline}
              color={showRejected ? 'primary' : 'medium'}
              slot="icon-only"
            />
          </IonButton>
        }
      />

      <FilterPopover
        isOpen={showFilterPopover}
        onDismiss={() => setShowFilterPopover(false)}
        showRejected={showRejected}
        onToggleRejected={onToggleRejected}
        onResetFilters={handleResetFilters}
        triggerRef={filterButtonRef}
      />

      <style>{`
        .dark-toolbar {
          --background: #000;
          --color: #fff;
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
            {filteredVideos.length > 0 ? (
              filteredVideos.map((video) => (
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
                  const currentIndex = filteredVideos.findIndex(v => v.id === selectedVideo.id);
                  const nextVideo = filteredVideos[currentIndex + 1];
                  if (nextVideo) {
                    setSelectedVideo(nextVideo);
                  } else {
                    setMode('grid');
                  }
                }}
                onSwipe={(direction) => handleSwipe(direction, selectedVideo)}
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