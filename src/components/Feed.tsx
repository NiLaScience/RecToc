'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  IonPage,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  RefresherEventDetail,
  IonFab,
  IonFabButton,
  IonSpinner,
  IonButton,
  IonIcon,
  IonToast
} from '@ionic/react';
import { notificationsOutline, gridOutline, videocamOutline, filterOutline } from 'ionicons/icons';
import Notifications from './Notifications';
import VideoPlayer from './VideoPlayer';
import VideoTile from './VideoTile';
import ApplicationModal from './ApplicationModal';
import type { VideoItem } from '../types/video';
import { addSnapshotListener, removeSnapshotListener } from '../config/firebase';
import { rejectJob, unrejectJob, getRejectedJobs } from '../config/firebase';
import type { RejectedJob } from '../config/firebase';
import AppHeader from './AppHeader';
import FilterPopover from './FilterHeader';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

const HEADER_HEIGHT = 56; // Fixed header height

const feedContainerStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '1.5px',
  backgroundColor: 'black'
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

type FeedMode = 'grid' | 'fullscreen' | 'details';

const Feed = () => {
  const { user } = useAuth();
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
  const [showToast, setShowToast] = useState(false);
  const filterButtonRef = useRef<HTMLIonButtonElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let unsubscribeId: string | null = null;
    let rejectionsUnsubscribeId: string | null = null;

    const setupListeners = async () => {
      if (!user) return;

      try {
        setLoading(true);
        
        // Listen to rejected jobs
        rejectionsUnsubscribeId = await addSnapshotListener(
          `rejectedJobs?userId=${user.uid}`,
          (data) => {
            if (Array.isArray(data)) {
              console.log('Rejected jobs update:', data);
              const rejectedIds = new Set(data.map(r => r.jobId));
              setRejectedJobIds(rejectedIds);
            }
          }
        );

        // Listen to all videos
        unsubscribeId = await addSnapshotListener(
          'videos',
          (videoData) => {
            if (Array.isArray(videoData)) {
              const sortedVideos = videoData.sort((a, b) => {
                const dateA = new Date(a.createdAt).getTime();
                const dateB = new Date(b.createdAt).getTime();
                return dateB - dateA;
              });
              
              console.log('Processed videos:', sortedVideos);
              setVideos(sortedVideos as VideoItem[]);
            }
            setLoading(false);
          }
        );
      } catch (error) {
        console.error('Error setting up listeners:', error);
        setLoading(false);
      }
    };

    setupListeners();

    return () => {
      if (unsubscribeId) {
        removeSnapshotListener(unsubscribeId);
      }
      if (rejectionsUnsubscribeId) {
        removeSnapshotListener(rejectionsUnsubscribeId);
      }
    };
  }, [user]); // Only depend on user, not showRejected

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
      const currentIndex = videos.findIndex(v => v.id === video.id);
      if (currentIndex > 0) {
        // Find the previous non-rejected video if we're not showing rejected videos
        if (!showRejected) {
          for (let i = currentIndex - 1; i >= 0; i--) {
            if (!rejectedJobIds.has(videos[i].id)) {
              setSelectedVideo(videos[i]);
              break;
            }
          }
        } else {
          setSelectedVideo(videos[currentIndex - 1]);
        }
      }
    } else if (direction === 'down') {
      // Next video
      const currentIndex = videos.findIndex(v => v.id === video.id);
      if (currentIndex < videos.length - 1) {
        // Find the next non-rejected video if we're not showing rejected videos
        if (!showRejected) {
          for (let i = currentIndex + 1; i < videos.length; i++) {
            if (!rejectedJobIds.has(videos[i].id)) {
              setSelectedVideo(videos[i]);
              break;
            }
          }
        } else {
          setSelectedVideo(videos[currentIndex + 1]);
        }
      }
    } else if (direction === 'left') {
      // Reject job
      const newRejectedJobIds = new Set(rejectedJobIds);
      newRejectedJobIds.add(video.id);
      setRejectedJobIds(newRejectedJobIds);
      setShowToast(true);

      // Find next non-rejected video
      const currentIndex = filteredVideos.findIndex(v => v.id === video.id);
      const nextVideo = filteredVideos.slice(currentIndex + 1).find(v => !newRejectedJobIds.has(v.id));
      if (nextVideo) {
        setSelectedVideo(nextVideo);
      } else {
        setMode('grid');
      }

      // Update rejection in Firestore
      try {
        const userRef = doc(db, 'users', user?.uid || '');
        await updateDoc(userRef, {
          [`rejectedJobs.${video.id}`]: serverTimestamp()
        });
      } catch (error) {
        console.error('Error updating rejected jobs:', error);
      }
    } else if (direction === 'right') {
      // Show details
      setMode('details');
      setSelectedJobId(video.id);
      setShowApplication(true);
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

  // Filter videos in memory based on rejection status
  const filteredVideos = useMemo(() => {
    return videos.filter(video => {
      const isRejected = rejectedJobIds.has(video.id);
      return showRejected ? isRejected : !isRejected;
    });
  }, [videos, rejectedJobIds, showRejected]);

  return (
    <IonPage>
      <div ref={headerRef}>
        <AppHeader
          title="Feed"
          mode={mode}
          showFeedButtons
          onToggleView={() => {
            if (mode === 'grid') {
              if (!selectedVideo && videos.length > 0) {
                const firstVideo = !showRejected 
                  ? videos.find(v => !rejectedJobIds.has(v.id))
                  : videos[0];
                if (firstVideo) {
                  setSelectedVideo(firstVideo);
                }
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
      </div>

      <FilterPopover
        isOpen={showFilterPopover}
        onDismiss={() => setShowFilterPopover(false)}
        showRejected={showRejected}
        onToggleRejected={onToggleRejected}
        onResetFilters={handleResetFilters}
        triggerRef={filterButtonRef}
      />

      <IonContent scrollY={mode === 'grid'} style={{ '--background': '#000' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <IonSpinner />
          </div>
        ) : videos.length === 0 ? (
          <div style={emptyStateStyle}>
            <p>No videos available</p>
          </div>
        ) : mode === 'grid' ? (
          <div style={{ paddingTop: '56px', backgroundColor: '#000' }}>
            <div style={{
              ...feedContainerStyle,
              marginTop: '-56px'
            }}>
              {filteredVideos.map((video) => (
                <VideoTile
                  key={video.id}
                  video={video}
                  onClick={() => handleVideoClick(video)}
                />
              ))}
            </div>
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
      </IonContent>

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

      <IonToast
        isOpen={showToast}
        onDidDismiss={() => setShowToast(false)}
        message="Job rejected"
        duration={1500}
        position="top"
        color="danger"
        style={{ zIndex: 9999 }}
      />
    </IonPage>
  );
};

export default Feed;