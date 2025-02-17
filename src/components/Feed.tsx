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
  IonToast,
  IonModal
} from '@ionic/react';
import { notificationsOutline, gridOutline, videocamOutline, filterOutline } from 'ionicons/icons';
import Notifications from './Notifications';
import ApplicationModal from './ApplicationModal';
import type { JobOpening } from '../types/job_opening';
import { addSnapshotListener, removeSnapshotListener } from '../config/firebase';
import { rejectJob, unrejectJob, getRejectedJobs } from '../config/firebase';
import type { RejectedJob } from '../config/firebase';
import AppHeader from './AppHeader';
import FilterPopover from './FilterHeader';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import JobTile from './JobTile';
import JobPresentation from './JobPresentation';
import JobDetails from './JobDetails';

const HEADER_HEIGHT = 56; // Fixed header height

const feedContainerStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '1px',
  backgroundColor: 'silver'
};

const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%'
};

const fullscreenVideoStyle: React.CSSProperties = {
  position: 'absolute',
  top: '23px', // Header height
  left: 0,
  right: 0,
  bottom: '23px', // Tab bar height
  backgroundColor: '#000',
  overflow: 'hidden'
};

type FeedMode = 'grid' | 'feed' | 'details';

const Feed = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mode, setMode] = useState<FeedMode>('grid');
  const [selectedJob, setSelectedJob] = useState<JobOpening | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
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
          'job_openings',
          (videoData) => {
            if (Array.isArray(videoData)) {
              const sortedVideos = videoData.sort((a, b) => {
                const dateA = new Date(a.createdAt).getTime();
                const dateB = new Date(b.createdAt).getTime();
                return dateB - dateA;
              });
              
              console.log('Processed jobs:', sortedVideos);
              setJobs(sortedVideos as JobOpening[]);
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

  const handleJobClick = (job: JobOpening) => {
    setSelectedJob(job);
    setMode('feed');
    setCurrentSlideIndex(0); // Reset slide index for new job
  };

  const handleApply = (jobId: string) => {
    setSelectedJobId(jobId);
    setShowApplication(true);
  };

  const handleCloseApplication = () => {
    setShowApplication(false);
    setSelectedJobId(null);
  };

  const handleNextJob = () => {
    if (!selectedJob) return;
    const currentIndex = jobs.findIndex(v => v.id === selectedJob.id);
    if (currentIndex < jobs.length - 1) {
      if (!showRejected) {
        for (let i = currentIndex + 1; i < jobs.length; i++) {
          if (!rejectedJobIds.has(jobs[i].id)) {
            setSelectedJob(jobs[i]);
            setCurrentSlideIndex(0); // Reset slide index for new job
            break;
          }
        }
      } else {
        setSelectedJob(jobs[currentIndex + 1]);
        setCurrentSlideIndex(0); // Reset slide index for new job
      }
    }
  };

  const handlePreviousJob = () => {
    if (!selectedJob) return;
    const currentIndex = jobs.findIndex(v => v.id === selectedJob.id);
    if (currentIndex > 0) {
      if (!showRejected) {
        for (let i = currentIndex - 1; i >= 0; i--) {
          const jobId = jobs[i].id;
          if (jobId && !rejectedJobIds.has(jobId)) {
            setSelectedJob(jobs[i]);
            setCurrentSlideIndex(0); // Reset slide index for new job
            break;
          }
        }
      } else {
        setSelectedJob(jobs[currentIndex - 1]);
        setCurrentSlideIndex(0); // Reset slide index for new job
      }
    }
  };

  const handleRejectJob = async () => {
    if (!selectedJob) return;
    
    // Reject job
    const newRejectedJobIds = new Set(rejectedJobIds);
    newRejectedJobIds.add(selectedJob.id);
    setRejectedJobIds(newRejectedJobIds);
    setShowToast(true);

    // Find next non-rejected job
    const currentIndex = jobs.findIndex(v => v.id === selectedJob.id);
    const nextJob = jobs.slice(currentIndex + 1).find(v => !newRejectedJobIds.has(v.id));
    if (nextJob) {
      setSelectedJob(nextJob);
      setCurrentSlideIndex(0); // Reset slide index for new job
    } else {
      setMode('grid');
    }

    // Update rejection in Firestore
    try {
      const userRef = doc(db, 'users', user?.uid || '');
      await updateDoc(userRef, {
        [`rejectedJobs.${selectedJob.id}`]: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating rejected jobs:', error);
    }
  };

  const handleShowDetails = () => {
    if (!selectedJob) return;
    setMode('details');
    setSelectedJobId(selectedJob.id);
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
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const isRejected = rejectedJobIds.has(job.id);
      return showRejected ? isRejected : !isRejected;
    });
  }, [jobs, rejectedJobIds, showRejected]);

  return (
    <IonPage>
      <div ref={headerRef}>
        <AppHeader
          title="Job Feed"
          mode={mode}
          showFeedButtons
          onToggleView={() => {
            if (mode === 'grid') {
              if (!selectedJob && jobs.length > 0) {
                const firstJob = !showRejected 
                  ? jobs.find(v => !rejectedJobIds.has(v.id))
                  : jobs[0];
                if (firstJob) {
                  setSelectedJob(firstJob);
                  setCurrentSlideIndex(0); // Reset slide index for new job
                }
              }
              setMode('feed');
            } else {
              setMode('grid');
              setCurrentSlideIndex(0); // Reset slide index when returning to grid
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
        ) : jobs.length === 0 ? (
          <div style={emptyStateStyle}>
            <p>No jobs available</p>
          </div>
        ) : mode === 'grid' ? (
          <div style={{ paddingTop: '56px', backgroundColor: '#000' }}>
            <div style={{
              ...feedContainerStyle,
              marginTop: '-56px'
            }}>
              {filteredJobs.map((job) => (
                <JobTile
                  key={job.id}
                  job={job}
                  onClick={() => handleJobClick(job)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div style={fullscreenVideoStyle}>
            {selectedJob && (
              <JobPresentation
                job={selectedJob}
                mode="feed"
                currentSlideIndex={currentSlideIndex}
                onSlideChange={setCurrentSlideIndex}
                onNextJob={handleNextJob}
                onPreviousJob={handlePreviousJob}
                onReject={handleRejectJob}
                onShowDetails={handleShowDetails}
                autoPlay
                onEnded={() => {
                  // Find next job
                  const currentIndex = jobs.findIndex(v => v.id === selectedJob.id);
                  const nextJob = jobs[currentIndex + 1];
                  if (nextJob) {
                    setSelectedJob(nextJob);
                    setCurrentSlideIndex(0); // Reset slide index for new job
                  } else {
                    setMode('grid');
                  }
                }}
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

      {/* Job Details Modal */}
      {mode === 'details' && selectedJob && (
        <IonModal
          isOpen={mode === 'details'}
          onDidDismiss={() => {
            setMode('feed');
            setSelectedJobId(null);
          }}
        >
          <JobDetails
            job={selectedJob}
            onClose={() => {
              setMode('feed');
              setSelectedJobId(null);
            }}
          />
        </IonModal>
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