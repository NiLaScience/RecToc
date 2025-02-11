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
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ApplicationService from '../services/ApplicationService';
import { JobApplication } from '../types/application';
import { VideoItem } from '../types/video';
import { timeOutline, documentTextOutline, businessOutline } from 'ionicons/icons';
import { formatDistanceToNow } from 'date-fns';
import { FirebaseFirestore } from '@capacitor-firebase/firestore';
import VideoDetails from './VideoDetails';

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

  const fetchApplications = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const apps = await ApplicationService.getUserApplications();
      
      // Fetch job details for each application
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
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [user]);

  const handleRefresh = async (event: CustomEvent) => {
    await fetchApplications();
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
        return '#ffd534';
      case 'shortlisted':
      case 'accepted':
        return '#2dd36f';
      case 'rejected':
      case 'withdrawn':
        return '#eb445a';
      default:
        return '#666';
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>My Applications</IonTitle>
        </IonToolbar>
      </IonHeader>
      
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <IonList>
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
              >
                <IonThumbnail slot="start">
                  {application.jobDetails?.thumbnailUrl ? (
                    <img 
                      src={application.jobDetails.thumbnailUrl} 
                      alt="Video thumbnail"
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover',
                        borderRadius: '4px'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: '#2a2a2a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '4px'
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
                  <h2>{application.jobDetails?.title || 'Unknown Position'}</h2>
                  {application.jobDetails?.jobDescription?.company && (
                    <p>
                      <IonIcon icon={businessOutline} style={{ verticalAlign: 'middle', marginRight: '5px' }} />
                      {application.jobDetails.jobDescription.company}
                      {application.jobDetails.jobDescription?.location && ` • ${application.jobDetails.jobDescription.location}`}
                    </p>
                  )}
                  <p>
                    <IonIcon icon={timeOutline} style={{ verticalAlign: 'middle', marginRight: '5px' }} />
                    Applied {formatDistanceToNow(new Date(application.createdAt), { addSuffix: true })}
                  </p>
                  {application.status && (
                    <IonButton
                      fill="clear"
                      size="small"
                      style={{
                        '--color': getStatusColor(application.status)
                      }}
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent item click when clicking the status button
                      }}
                    >
                      {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
                    </IonButton>
                  )}
                </IonLabel>
              </IonItem>
            ))
          ) : (
            <IonItem>
              <IonLabel className="ion-text-center">
                <p>No applications yet</p>
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