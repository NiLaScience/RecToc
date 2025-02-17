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
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonChip,
  IonText,
  IonSpinner,
} from '@ionic/react';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ApplicationService from '../services/ApplicationService';
import { JobApplication } from '../types/application';
import { timeOutline, documentTextOutline, businessOutline } from 'ionicons/icons';
import { formatDistanceToNow } from 'date-fns';
import { FirebaseFirestore } from '@capacitor-firebase/firestore';
import JobDetails from './JobDetails';
import { addSnapshotListener, removeSnapshotListener } from '../config/firebase';
import type { ApplicationStatus, AgentStatus } from '../types/application';
import type { JobOpening } from '../types/job_opening';

const Applications: React.FC = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [applications, setApplications] = useState<(JobApplication & { jobDetails?: JobOpening })[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobOpening | null>(null);

  const fetchJobDetails = async (jobId: string): Promise<JobOpening | null> => {
    try {
      const response = await FirebaseFirestore.getDocument({
        reference: `job_openings/${jobId}`
      });

      if (!response.snapshot?.data) {
        return null;
      }

      return {
        id: jobId,
        ...response.snapshot.data
      } as JobOpening;
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
        setIsLoading(true);
        
        // Listen to applications collection with query for current user
        applicationsUnsubscribeId = await addSnapshotListener(
          `applications?candidateId==${user.uid}`,
          async (snapshot) => {
            if (!snapshot || !Array.isArray(snapshot) || snapshot.length === 0) {
              setApplications([]);
              return;
            }

            // Sort applications by creation date
            const apps = snapshot
              .filter(doc => doc && typeof doc === 'object') // Ensure we have valid documents
              .sort((a, b) => {
                if (!a.createdAt || !b.createdAt) return 0;
                const dateA = new Date(a.createdAt).getTime();
                const dateB = new Date(b.createdAt).getTime();
                return dateB - dateA;
              });

            // Set up listeners for job details for each application
            const currentJobIds = new Set(apps.map(app => app.job_id || app.jobId));
            
            // Remove listeners for jobs that are no longer in the applications list
            Object.entries(jobDetailsUnsubscribers).forEach(([jobId, unsubscriberId]) => {
              if (!currentJobIds.has(jobId)) {
                removeSnapshotListener(unsubscriberId);
                delete jobDetailsUnsubscribers[jobId];
              }
            });

            // Add listeners for new jobs
            for (const app of apps) {
              const jobId = app.job_id || app.jobId;
              if (jobId && !jobDetailsUnsubscribers[jobId]) {
                jobDetailsUnsubscribers[jobId] = await addSnapshotListener(
                  `job_openings/${jobId}`,
                  (jobData) => {
                    if (jobData) {
                      setApplications(prev => prev.map(prevApp => 
                        (prevApp.job_id === jobId || prevApp.jobId === jobId)
                          ? { ...prevApp, jobDetails: { id: jobId, ...jobData } as JobOpening }
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
                const jobId = app.job_id || app.jobId;
                let jobDetails = undefined;
                if (jobId) {
                  jobDetails = await fetchJobDetails(jobId);
                }
                return {
                  ...app,
                  jobDetails: jobDetails || undefined
                };
              })
            );

            console.log('Setting applications:', appsWithDetails);
            setApplications(appsWithDetails);
            setIsLoading(false);
          }
        );
      } catch (error) {
        console.error('Error setting up listeners:', error);
        setIsLoading(false);
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

  const getStatusColor = (status: ApplicationStatus | AgentStatus): string => {
    switch (status) {
      // Application statuses
      case 'draft':
        return 'medium';
      case 'submitted':
        return 'primary';
      case 'withdrawn':
        return 'medium';
      case 'rejected':
        return 'danger';
      case 'accepted':
        return 'success';
      
      // Agent statuses
      case 'queued':
      case 'processing':
        return 'primary';
      case 'completed':
        return 'success';
      case 'failed':
        return 'danger';
      default:
        return 'medium';
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
          {isLoading ? (
            renderSkeletons()
          ) : applications.length > 0 ? (
            applications.map((application) => (
              <IonCard key={application.id} className="ion-margin-vertical">
                <IonCardHeader>
                  <IonCardTitle>{application.jobDetails?.title || 'Loading...'}</IonCardTitle>
                  <IonCardSubtitle>
                    {application.jobDetails?.jobDescription?.company || 'Company not available'}
                  </IonCardSubtitle>
                </IonCardHeader>
                <IonCardContent>
                  <div className="ion-padding-bottom">
                    <IonChip color={getStatusColor(application.status)}>
                      {application.status}
                    </IonChip>
                    {application.agentStatus && (
                      <IonChip color={getStatusColor(application.agentStatus)}>
                        AI Agent: {application.agentStatus}
                      </IonChip>
                    )}
                  </div>
                  
                  {/* Show agent GIF if available */}
                  {application.agentGifUrl && (
                    <div className="ion-padding-vertical">
                      <h4>Application Process Recording</h4>
                      <img 
                        src={application.agentGifUrl} 
                        alt="Application process" 
                        style={{ maxWidth: '100%', borderRadius: '8px' }}
                      />
                    </div>
                  )}
                  
                  {/* Show agent error if any */}
                  {application.agentError && (
                    <div className="ion-padding-vertical">
                      <IonText color="danger">
                        <p>Error: {application.agentError}</p>
                      </IonText>
                    </div>
                  )}
                  
                  {/* Rest of the existing card content */}
                  <IonItem 
                    button
                    onClick={() => {
                      if (application.jobDetails) {
                        setSelectedJob(application.jobDetails);
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
                      {application.jobDetails?.slides?.[0]?.backgroundImageUrl ? (
                        <img 
                          src={application.jobDetails.slides[0].backgroundImageUrl} 
                          alt={application.jobDetails.title}
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
                        {application.createdAt && !isNaN(new Date(application.createdAt).getTime()) 
                          ? `Applied ${formatDistanceToNow(new Date(application.createdAt), { addSuffix: true })}`
                          : 'Recently applied'}
                      </p>
                    </IonLabel>
                  </IonItem>
                </IonCardContent>
              </IonCard>
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
          isOpen={!!selectedJob} 
          onDidDismiss={() => setSelectedJob(null)}
        >
          {selectedJob && (
            <JobDetails
              job={selectedJob}
              onClose={() => setSelectedJob(null)}
            />
          )}
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default Applications; 