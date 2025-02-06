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
} from '@ionic/react';
import { closeOutline, paperPlaneOutline } from 'ionicons/icons';
import { VideoItem } from '../types/video';
import { useState } from 'react';
import ApplicationModal from './ApplicationModal';

interface VideoDetailsProps {
  video: VideoItem;
  onClose: () => void;
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

const VideoDetails: React.FC<VideoDetailsProps> = ({ video, onClose }) => {
  const [showApplication, setShowApplication] = useState(false);
  const jobDescription = video.jobDescription as JobDescription;

  const handleApply = () => {
    setShowApplication(true);
  };

  const handleCloseApplication = () => {
    setShowApplication(false);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <div className="video-details" style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        backgroundColor: '#fff',
        zIndex: 1000,
        overflowY: 'auto'
      }}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Video Details</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={onClose}>
                <IonIcon icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>

        <IonContent>
          <div style={{ padding: '1rem', paddingBottom: '80px' }}>
            {/* Job Description Card */}
            {jobDescription && (
              <IonCard>
                <IonCardHeader>
                  <IonCardTitle>{jobDescription.title || 'Job Description'}</IonCardTitle>
                  {jobDescription.company && (
                    <IonCardSubtitle>
                      {jobDescription.company}
                      {jobDescription.location && ` • ${jobDescription.location}`}
                    </IonCardSubtitle>
                  )}
                </IonCardHeader>

                <IonCardContent>
                  <div style={{ marginBottom: '1rem' }}>
                    {jobDescription.employmentType && (
                      <IonChip>{jobDescription.employmentType}</IonChip>
                    )}
                    {jobDescription.experienceLevel && (
                      <IonChip>{jobDescription.experienceLevel}</IonChip>
                    )}
                  </div>

                  {jobDescription.responsibilities && jobDescription.responsibilities.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <h4>Responsibilities</h4>
                      <IonList>
                        {jobDescription.responsibilities.map((item, index) => (
                          <IonItem key={index}>
                            <IonLabel className="ion-text-wrap">{item}</IonLabel>
                          </IonItem>
                        ))}
                      </IonList>
                    </div>
                  )}

                  {jobDescription.requirements && jobDescription.requirements.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <h4>Requirements</h4>
                      <IonList>
                        {jobDescription.requirements.map((item, index) => (
                          <IonItem key={index}>
                            <IonLabel className="ion-text-wrap">{item}</IonLabel>
                          </IonItem>
                        ))}
                      </IonList>
                    </div>
                  )}

                  {jobDescription.skills && jobDescription.skills.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <h4>Skills</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {jobDescription.skills.map((skill, index) => (
                          <IonChip key={index}>{skill}</IonChip>
                        ))}
                      </div>
                    </div>
                  )}

                  {jobDescription.benefits && jobDescription.benefits.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <h4>Benefits</h4>
                      <IonList>
                        {jobDescription.benefits.map((item, index) => (
                          <IonItem key={index}>
                            <IonLabel className="ion-text-wrap">{item}</IonLabel>
                          </IonItem>
                        ))}
                      </IonList>
                    </div>
                  )}
                </IonCardContent>
              </IonCard>
            )}

            {/* Transcript Card */}
            <IonCard>
              <IonCardHeader>
                <IonCardTitle>Video Transcript</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                {video.transcript ? (
                  <IonList>
                    {video.transcript.segments.map((segment) => (
                      <IonItem key={segment.id}>
                        <IonLabel className="ion-text-wrap">
                          <p style={{ 
                            color: '#666', 
                            fontSize: '0.8rem', 
                            marginBottom: '0.25rem' 
                          }}>
                            {formatTime(segment.start)} - {formatTime(segment.end)}
                          </p>
                          {segment.text}
                        </IonLabel>
                      </IonItem>
                    ))}
                  </IonList>
                ) : (
                  <p style={{ textAlign: 'center', color: '#666' }}>
                    No transcript available
                  </p>
                )}
              </IonCardContent>
            </IonCard>

            {/* Apply Button - Always visible */}
            <IonButton
              expand="block"
              onClick={handleApply}
              style={{ 
                margin: '2rem 0',
                maxWidth: '400px',
                marginLeft: 'auto',
                marginRight: 'auto'
              }}
            >
              <IonIcon icon={paperPlaneOutline} slot="start" />
              Apply Now
            </IonButton>
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
    </>
  );
};

export default VideoDetails;
