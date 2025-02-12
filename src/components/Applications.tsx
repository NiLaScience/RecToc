import {
  IonContent,
  IonPage,
  IonList,
  IonItem,
  IonLabel,
  IonSkeletonText,
  IonThumbnail,
  IonRefresher,
  IonRefresherContent,
  IonIcon,
  IonButton,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonModal,
} from '@ionic/react';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ApplicationService from '../services/ApplicationService';
import { JobApplication } from '../types/application';
import { VideoItem } from '../types/video';
import { timeOutline, documentTextOutline, businessOutline } from 'ionicons/icons';
import { formatDistanceToNow } from 'date-fns';
import { FirebaseFirestore } from '@capacitor-firebase/firestore';
import VideoDetails from './VideoDetails';
import { addSnapshotListener, removeSnapshotListener } from '../config/firebase';

const Applications: React.FC = () => {
  const { user } = useAuth();
  const [applications, setApplications] = useState<(JobApplication & { jobDetails?: VideoItem })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);

  const fetchJobDetails = async (jobId: string): Promise<VideoItem | null> => {
    try {
      const result = await FirebaseFirestore.getDocument({
        reference: `videos/${jobId}`
      });
      
      if (!result.snapshot?.data) {
        return null;
      }

      return {
        id: jobId,
        ...result.snapshot.data
      } as VideoItem;
    } catch (error) {
      console.error('Error fetching job details:', error);
      return null;
    }
  };

  useEffect(() => {
    let applicationsUnsubscribeId: string | null = null;
    let jobDetailsUnsubscribers: { [key: string]: string } = {};

    const setupListeners = async () => {
      if (!user) return;

      try {
        setLoading(true);
        
        // Listen to applications collection
        applicationsUnsubscribeId = await addSnapshotListener(
          'applications',
          async (snapshot) => {
            if (!snapshot || typeof snapshot !== 'object') {
              setApplications([]);
              return;
            }

            const apps = Object.entries(snapshot)
              .map(([id, data]) => ({
                id,
                ...(data as Omit<JobApplication, 'id'>)
              }))
              .filter((app): app is JobApplication => 
                app.candidateId === user.uid
              )
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            // Set up listeners for job details for each application
            const currentJobIds = new Set(apps.map(app => app.jobId));
            
            // Remove listeners for jobs that are no longer in the applications list
            Object.entries(jobDetailsUnsubscribers).forEach(([jobId, unsubscriberId]) => {
              if (!currentJobIds.has(jobId)) {
                removeSnapshotListener(unsubscriberId);
                delete jobDetailsUnsubscribers[jobId];
              }
            });

            // Add listeners for new jobs
            for (const app of apps) {
              if (!jobDetailsUnsubscribers[app.jobId]) {
                jobDetailsUnsubscribers[app.jobId] = await addSnapshotListener(
                  `videos/${app.jobId}`,
                  (jobData) => {
                    if (jobData) {
                      setApplications(prev => prev.map(prevApp => 
                        prevApp.jobId === app.jobId
                          ? { ...prevApp, jobDetails: { id: app.jobId, ...jobData } as VideoItem }
                          : prevApp
                      ));
                    }
                  }
                );
              }
            }

            // Initial job details fetch
            const appsWithDetails = await Promise.all(
              apps.map(async (app) => {
                const jobDetails = await fetchJobDetails(app.jobId);
                return {
                  ...app,
                  jobDetails: jobDetails || undefined
                };
              })
            );

            setApplications(appsWithDetails);
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
      if (applicationsUnsubscribeId) {
        removeSnapshotListener(applicationsUnsubscribeId);
      }
      Object.values(jobDetailsUnsubscribers).forEach(unsubscriberId => {
        removeSnapshotListener(unsubscriberId);
      });
    };
  }, [user]);

  const handleRefresh = async (event: CustomEvent) => {
    await ApplicationService.refreshApplications();
    event.detail.complete();
  };

  const renderSkeletons = () => {
    return Array(3).fill(null).map((_, i) => (
      <IonItem key={i}>
        <IonThumbnail slot="start">
          <IonSkeletonText animated />
        </IonThumbnail>
        <IonLabel>
          <h3><IonSkeletonText animated style={{ width: '70%' }} /></h3>
          <p><IonSkeletonText animated style={{ width: '50%' }} /></p>
        </IonLabel>
      </IonItem>
    ));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
      case 'reviewing':
        return {
          background: 'rgba(255, 213, 52, 0.15)',
          color: '#ffd534'
        };
      case 'shortlisted':
      case 'accepted':
        return {
          background: 'rgba(45, 211, 111, 0.15)',
          color: '#2dd36f'
        };
      case 'rejected':
      case 'withdrawn':
        return {
          background: 'rgba(235, 68, 90, 0.15)',
          color: '#eb445a'
        };
      default:
        return {
          background: 'rgba(102, 102, 102, 0.15)',
          color: '#666'
        };
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': '#000' }}>
          <IonTitle style={{ color: '#fff' }}>My Applications</IonTitle>
        </IonToolbar>
      </IonHeader>
      
      <IonContent style={{ '--background': '#1a1a1a' }}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <IonList style={{ background: 'transparent', padding: '1rem' }}>
          {loading ? (
            renderSkeletons()
          ) : applications.length > 0 ? (
            applications.map((application) => (
              <IonItem 
                key={application.id}
                button
                onClick={() => {
                  if (application.jobDetails) {
                    setSelectedVideo(application.jobDetails);
                  }
                }}
                style={{
                  '--background': '#2a2a2a',
                  '--background-hover': '#333',
                  marginBottom: '1rem',
                  borderRadius: '12px',
                  '--border-color': 'transparent',
                  '--border-style': 'none',
                  '--padding-start': '1rem',
                  '--padding-end': '1rem',
                  '--padding-top': '0.75rem',
                  '--padding-bottom': '0.75rem',
                }}
                lines="none"
              >
                <IonThumbnail slot="start" style={{ 
                  width: '80px', 
                  height: '80px',
                  marginRight: '1rem'
                }}>
                  {application.jobDetails?.thumbnailUrl ? (
                    <img 
                      src={application.jobDetails.thumbnailUrl} 
                      alt="Video thumbnail"
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover',
                        borderRadius: '8px'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: '#333',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '8px'
                    }}>
                      <IonIcon
                        icon={documentTextOutline}
                        style={{
                          fontSize: '1.5rem',
                          color: '#666',
                        }}
                      />
                    </div>
                  )}
                </IonThumbnail>
                <IonLabel>
                  <h2 style={{ 
                    color: '#fff',
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    marginBottom: '0.5rem'
                  }}>
                    {application.jobDetails?.title || 'Unknown Position'}
                  </h2>
                  {application.jobDetails?.jobDescription?.company && (
                    <p style={{ 
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: '0.9rem',
                      marginBottom: '0.25rem'
                    }}>
                      <IonIcon icon={businessOutline} style={{ 
                        verticalAlign: 'middle', 
                        marginRight: '5px',
                        color: 'rgba(255, 255, 255, 0.5)'
                      }} />
                      {application.jobDetails.jobDescription.company}
                      {application.jobDetails.jobDescription?.location && ` • ${application.jobDetails.jobDescription.location}`}
                    </p>
                  )}
                  <p style={{ 
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontSize: '0.9rem',
                    marginBottom: '0.5rem'
                  }}>
                    <IonIcon icon={timeOutline} style={{ 
                      verticalAlign: 'middle', 
                      marginRight: '5px',
                      color: 'rgba(255, 255, 255, 0.4)'
                    }} />
                    Applied {formatDistanceToNow(new Date(application.createdAt), { addSuffix: true })}
                  </p>
                  {application.status && (
                    <div 
                      style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '100px',
                        fontSize: '0.8rem',
                        fontWeight: '500',
                        background: getStatusColor(application.status).background,
                        color: getStatusColor(application.status).color,
                        marginTop: '4px'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
                    </div>
                  )}
                </IonLabel>
              </IonItem>
            ))
          ) : (
            <IonItem style={{
              '--background': '#2a2a2a',
              borderRadius: '12px',
              '--border-color': 'transparent',
              '--padding-start': '1rem',
              '--padding-end': '1rem'
            }}>
              <IonLabel className="ion-text-center">
                <p style={{ color: 'rgba(255, 255, 255, 0.5)' }}>No applications yet</p>
              </IonLabel>
            </IonItem>
          )}
        </IonList>

        <IonModal 
          isOpen={!!selectedVideo} 
          onDidDismiss={() => setSelectedVideo(null)}
        >
          {selectedVideo && (
            <VideoDetails
              video={selectedVideo}
              onClose={() => setSelectedVideo(null)}
            />
          )}
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default Applications; 