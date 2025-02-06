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
  const jobDescription = video.jobDescription as JobDescription;

  const handleApply = () => {
    if (jobDescription.applicationUrl) {
      window.open(jobDescription.applicationUrl, '_blank');
    } else {
      console.log('Application flow not implemented yet');
    }
  };

  return (
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
                  <div>
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

          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Transcript</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              {video.transcript ? (
                <div>
                  {video.transcript.segments.map((segment) => (
                    <p key={segment.id} style={{ marginBottom: '1rem' }}>
                      <span style={{ color: '#666', fontSize: '0.8rem' }}>
                        {Math.floor(segment.start / 60)}:{(segment.start % 60).toString().padStart(2, '0')} - 
                        {Math.floor(segment.end / 60)}:{(segment.end % 60).toString().padStart(2, '0')}
                      </span>
                      <br />
                      {segment.text}
                    </p>
                  ))}
                </div>
              ) : (
                'No transcript available'
              )}
            </IonCardContent>
          </IonCard>
        </div>

        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '1rem',
          backgroundColor: '#fff',
          borderTop: '1px solid #eee',
          display: 'flex',
          justifyContent: 'center',
          zIndex: 1001
        }}>
          <IonButton 
            expand="block"
            color="primary"
            onClick={handleApply}
            style={{ width: '100%', maxWidth: '400px' }}
          >
            <IonIcon icon={paperPlaneOutline} slot="start" />
            Apply Now
          </IonButton>
        </div>
      </IonContent>
    </div>
  );
};

export default VideoDetails;
