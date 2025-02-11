import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonList,
  IonItem,
  IonLabel,
  IonChip,
  IonRouterLink,
} from '@ionic/react';
import { closeOutline, paperPlaneOutline, chatbubbleOutline } from 'ionicons/icons';
import { VideoItem } from '../types/video';
import { useState } from 'react';
import ApplicationModal from './ApplicationModal';
import AppHeader from './AppHeader';
import JobDescriptionAccordion from './shared/JobDescriptionAccordion';
import InterviewTrainingModal from './InterviewTrainingModal';

interface VideoDetailsProps {
  video: VideoItem;
  onClose: () => void;
  onApplicationModalChange?: (isOpen: boolean) => void;
}

interface JobDescription {
  title?: string;
  company?: string;
  location?: string;
  employmentType?: string;
  experienceLevel?: string;
  responsibilities?: string[];
  requirements?: string[];
  skills?: string[];
  benefits?: string[];
  applicationUrl?: string;
}

const VideoDetails: React.FC<VideoDetailsProps> = ({ video, onClose, onApplicationModalChange }) => {
  const [showApplication, setShowApplication] = useState(false);
  const [showTraining, setShowTraining] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const jobDescription = video.jobDescription as JobDescription;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (showApplication) return; // Disable swipe when application modal is open
    setTouchStart({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart || showApplication) return; // Disable swipe when application modal is open

    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY
    };

    const diffX = touchStart.x - touchEnd.x;
    const diffY = touchStart.y - touchEnd.y;

    // If horizontal swipe is greater than vertical swipe
    if (Math.abs(diffX) > Math.abs(diffY)) {
      // Right to left swipe (close details)
      if (diffX > 50) {
        onClose();
      }
    }

    setTouchStart(null);
  };

  const handleApply = () => {
    setShowApplication(true);
    onApplicationModalChange?.(true);
  };

  const handleCloseApplication = () => {
    setShowApplication(false);
    onApplicationModalChange?.(false);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <div 
        className="video-details" 
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          backgroundColor: '#1a1a1a',
          zIndex: showApplication ? 999 : 1000,
          overflowY: 'auto',
          transform: 'translateX(0)',
          transition: 'transform 0.3s ease-out',
          pointerEvents: showApplication ? 'none' : 'auto'
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <IonContent scrollY={true} style={{ '--background': '#1a1a1a', '--overflow': 'hidden' }}>
          <AppHeader
            title="Job Details"
            mode="details"
            onClose={onClose}
          />

          <div style={{ 
            height: '100%', 
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: '1rem', 
            paddingBottom: '80px',
            color: '#fff'
          }}>
            <div style={{ padding: '1rem' }}>
              <IonCard style={{ 
                '--background': '#2a2a2a',
                '--color': '#fff',
                margin: 0,
                borderRadius: '8px',
                border: '2px solid rgba(255, 255, 255, 0.1)'
              }}>
                <IonCardHeader>
                  <IonCardTitle style={{ color: '#fff' }}>{jobDescription?.title || video.title}</IonCardTitle>
                  {jobDescription?.company && (
                    <IonCardSubtitle style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      {jobDescription.company}
                      {jobDescription.location && ` • ${jobDescription.location}`}
                    </IonCardSubtitle>
                  )}
                </IonCardHeader>
                <IonCardContent>
                  {jobDescription?.employmentType && (
                    <div style={{ marginBottom: '1rem' }}>
                      <IonChip style={{ '--background': '#333', '--color': '#fff' }}>
                        {jobDescription.employmentType}
                      </IonChip>
                      {jobDescription.experienceLevel && (
                        <IonChip style={{ '--background': '#333', '--color': '#fff' }}>
                          {jobDescription.experienceLevel}
                        </IonChip>
                      )}
                    </div>
                  )}

                  <JobDescriptionAccordion
                    responsibilities={jobDescription?.responsibilities}
                    requirements={jobDescription?.requirements}
                    skills={jobDescription?.skills}
                    benefits={jobDescription?.benefits}
                    transcript={video.transcript}
                  />
                </IonCardContent>
              </IonCard>

              <div style={{ 
                display: 'flex', 
                gap: '1rem',
                margin: '2rem 0',
                maxWidth: '400px',
                marginLeft: 'auto',
                marginRight: 'auto',
              }}>
                <IonButton
                  expand="block"
                  onClick={() => setShowTraining(true)}
                  style={{ 
                    flex: 1,
                    '--background': '#2a2a2a',
                    '--color': '#fff',
                    '--border-radius': '8px',
                    '--padding-top': '1rem',
                    '--padding-bottom': '1rem'
                  }}
                >
                  <IonIcon icon={chatbubbleOutline} slot="start" />
                  Practice Interview
                </IonButton>

                <IonButton
                  expand="block"
                  onClick={handleApply}
                  style={{ 
                    flex: 1,
                    '--background': '#0055ff',
                    '--color': '#fff',
                    '--border-radius': '8px',
                    '--padding-top': '1rem',
                    '--padding-bottom': '1rem'
                  }}
                >
                  <IonIcon icon={paperPlaneOutline} slot="start" />
                  Apply Now
                </IonButton>
              </div>
            </div>
          </div>
        </IonContent>
      </div>

      {showApplication && (
        <ApplicationModal
          isOpen={showApplication}
          onClose={handleCloseApplication}
          jobId={video.id}
        />
      )}

      <InterviewTrainingModal
        isOpen={showTraining}
        onClose={() => setShowTraining(false)}
        jobId={video.id}
      />
    </>
  );
};

export default VideoDetails;
