import { useEffect, useState } from 'react';
import {
  IonContent,
  IonSpinner,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonChip,
  IonProgressBar,
  IonModal,
  IonButton,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonIcon,
} from '@ionic/react';
import { closeOutline } from 'ionicons/icons';

import { useAuth } from '../context/AuthContext';
import type { JobApplication } from '../types/application';
import type { VideoItem } from '../types/video';
import type { UserProfile } from '../types/user';
import AccordionGroup from './shared/AccordionGroup';
import AccordionSection from './shared/AccordionSection';
import { ListContent, ChipsContent, ExperienceContent, EducationContent } from './shared/AccordionContent';
import CVAccordion from './shared/CVAccordion';
import ChatMessage from './ChatMessage';

import ApplicationService from '../services/ApplicationService';
import { addSnapshotListener, removeSnapshotListener } from '../config/firebase';
import { useOnboardingInterview } from '../hooks/useOnboardingInterview';
import '../styles/chat.css';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Set up the onboarding coach
  const {
    state: onboardingState,
    sessionStatus,
    error: onboardingError,
    messages: onboardingMessages,
    stopOnboarding,
    connect,
  } = useOnboardingInterview({
    resumeData: profile?.cv || {
      personalInfo: { name: 'Anonymous' },
      experience: [],
      education: [],
      skills: [],
    },
    onProgressUpdate: (stage, progress, title) => {
      console.log('onboarding progress updated:', { stage, progress, title });
    },
    onFeedback: (feedback) => {
      console.log('Feedback from agent:', feedback);
    },
  });

  // Handle data loading - only load user profile
  useEffect(() => {
    let profileUnsubscribeId: string | null = null;

    const loadData = async () => {
      if (!user) return;

      try {
        profileUnsubscribeId = await addSnapshotListener(`users/${user.uid}`, (data) => {
          if (data) {
            setProfile(data as UserProfile);
            setLoading(false);
          }
        });
      } catch (err) {
        console.error('Error loading data:', err);
        setLoading(false);
      }
    };

    if (isOpen) {
      loadData();
    }
    return () => {
      if (profileUnsubscribeId) removeSnapshotListener(profileUnsubscribeId);
    };
  }, [user, isOpen]);

  // Handle cleanup when modal closes
  useEffect(() => {
    if (!isOpen) {
      stopOnboarding();
    }
  }, [isOpen, stopOnboarding]);

  if (!isOpen) return null;

  return (
    <IonModal 
      isOpen={isOpen} 
      onDidDismiss={onClose}
      className="onboarding-modal"
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle>Onboarding Interview</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      
      <IonContent scrollY={true}>
        {loading ? (
          <div className="ion-padding ion-text-center">
            <IonSpinner />
          </div>
        ) : (
          <>
            <div style={{ padding: '1rem' }}>
              {/* Controls */}
              <div style={{ 
                display: 'flex',
                justifyContent: 'center',
                width: '100%',
                gap: '1rem',
                marginBottom: '1.5rem'
              }}>
                <IonButton 
                  onClick={connect}
                  disabled={sessionStatus !== 'DISCONNECTED'}
                >
                  Start Onboarding
                </IonButton>
                <IonButton 
                  color="danger" 
                  onClick={stopOnboarding}
                  disabled={sessionStatus !== 'CONNECTED'}
                >
                  End Onboarding
                </IonButton>
              </div>

              {/* onboarding progress bar */}
              <IonProgressBar
                value={onboardingState.progress / 100}
                color="primary"
                style={{ height: '6px', marginBottom: '1.5rem' }}
              ></IonProgressBar>

              {/* Stage information */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, marginBottom: '0.5rem' }}>
                  Stage: {onboardingState.stageTitle} ({Math.round(onboardingState.progress)}%)
                </h3>
                {sessionStatus === 'CONNECTING' && <p>Connecting to AI onboarding Coach...</p>}
                {sessionStatus === 'CONNECTED' && onboardingState.progress === 0 && (
                  <IonChip color="success">onboarding ready to begin, say hello!</IonChip>
                )}
                {sessionStatus === 'CONNECTED' && onboardingState.progress > 0 && (
                  <IonChip color="primary">onboarding in progress</IonChip>
                )}
              </div>

              {/* onboarding feedback */}
              {onboardingState.feedback && onboardingState.progress > 0 && (
                <AccordionGroup>
                  <AccordionSection 
                    value="feedback" 
                    label={`Current Feedback: ${onboardingState.feedback.feedbackType}`}
                  >
                    <div className="ion-padding">
                      <p>{onboardingState.feedback.message}</p>
                      {onboardingState.feedback.details && (
                        <>
                          <h4>Strengths:</h4>
                          <ul>
                            {onboardingState.feedback.details.strengths.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                          <h4>Areas for Improvement:</h4>
                          <ul>
                            {onboardingState.feedback.details.improvements.map((imp, i) => (
                              <li key={i}>{imp}</li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  </AccordionSection>
                </AccordionGroup>
              )}
            </div>

            {/* User's CV data */}
            {profile?.cv && (
              <div style={{ margin: '1rem 0' }}>
                <CVAccordion
                  personalInfo={profile.cv.personalInfo}
                  experience={profile.cv.experience}
                  education={profile.cv.education}
                  skills={profile.cv.skills}
                  certifications={profile.cv.certifications}
                  languages={profile.cv.languages}
                  displayName={profile.displayName}
                />
              </div>
            )}
          </>
        )}
      </IonContent>
    </IonModal>
  );
};

export default OnboardingModal;
