import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonItem,
  IonLabel,
  IonSpinner,
  IonChip,
  IonFooter,
  IonProgressBar,
  IonIcon,
  IonButtons,
} from '@ionic/react';
import { closeOutline } from 'ionicons/icons';
import { useState, useEffect, useRef } from 'react';
import { useRealtimeConnection, type SessionStatus, InterviewStage } from '../hooks/useRealtimeConnection';
import { useAuth } from '../context/AuthContext';
import { updateDocument } from '../config/firebase';
import ChatMessage from './ChatMessage';
import AccordionGroup from './shared/AccordionGroup';
import AccordionSection from './shared/AccordionSection';
import '../styles/chat.css';
import { toast } from 'react-hot-toast';

interface ResumeData {
  experience: Array<{
    company: string;
    title: string;
    startDate: string;
    endDate?: string;
    description: string;
  }>;
  education: Array<{
    school: string;
    degree: string;
    field: string;
    graduationDate: string;
  }>;
  skills: string[];
  [key: string]: any;
}

interface RealtimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  resumeData?: ResumeData;
}

const INTERVIEW_STAGES = [
  InterviewStage.INTRODUCTION,
  InterviewStage.EXPERIENCE_REVIEW,
  InterviewStage.SKILLS_ASSESSMENT,
  InterviewStage.PREFERENCES,
  InterviewStage.EXPECTATIONS,
  InterviewStage.WRAP_UP
];

const stageNames: Record<InterviewStage, string> = {
  introduction: 'Introduction',
  experience_review: 'Experience Review',
  skills_assessment: 'Skills Assessment',
  preferences: 'Job Preferences',
  expectations: 'Career Goals',
  wrap_up: 'Wrap Up',
  completed: 'Completed'
};

const RealtimeModal: React.FC<RealtimeModalProps> = ({ isOpen, onClose, resumeData }) => {
  const { user } = useAuth();
  const contentRef = useRef<HTMLIonContentElement>(null);
  const mountedRef = useRef(false);
  const {
    sessionStatus,
    error,
    messages,
    connect,
    disconnect,
    isCompleting,
    currentStage,
    totalStages,
    progress,
    stageTitle,
    feedback,
    preferences,
    keyInsights
  } = useRealtimeConnection(resumeData);

  const isConnected = sessionStatus === "CONNECTED";
  const isConnecting = sessionStatus === "CONNECTING";

  // Initialize connection on mount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Handle connection state
  useEffect(() => {
    if (!mountedRef.current) return;

    const handleConnection = async () => {
      try {
        if (isOpen && sessionStatus === "DISCONNECTED") {
          await connect();
        } else if (!isOpen && sessionStatus === "CONNECTED") {
          disconnect();
        }
      } catch (err) {
        console.error('Connection error:', err);
      }
    };

    handleConnection();
  }, [isOpen, sessionStatus]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle completion state
  useEffect(() => {
    if (isCompleting && user) {
      const toastId = toast.loading('Completing onboarding interview...', {
        duration: 5000,
      });

      const saveInterviewResults = async () => {
        try {
          // Update user profile with interview results
          await updateDocument(`users/${user.uid}`, {
            interviewResults: {
              preferences,
              keyInsights,
              completedAt: new Date().toISOString()
            },
            updatedAt: new Date().toISOString()
          });

          toast.dismiss(toastId);
          toast.success('Interview results saved to your profile');
          onClose();
          disconnect();
        } catch (err) {
          console.error('Error saving interview results:', err);
          toast.dismiss(toastId);
          toast.error('Failed to save interview results');
        }
      };

      saveInterviewResults();

      return () => {
        toast.dismiss(toastId);
      };
    }
  }, [isCompleting, user, preferences, keyInsights, onClose, disconnect]);

  return (
    <IonModal 
      isOpen={isOpen} 
      onDidDismiss={onClose}
      className="interview-training-modal"
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
        <div className="interview-progress">
          <IonProgressBar 
            value={progress / 100} 
            color="primary"
            style={{ height: '6px' }}
          />
          <div className="stage-info ion-padding-horizontal ion-text-center">
            <small>{stageTitle} ({Math.round(progress)}%)</small>
          </div>
        </div>
      </IonHeader>

      <IonContent ref={contentRef} scrollEvents={true}>
        {error ? (
          <div className="ion-text-center ion-padding" role="alert">
            <IonLabel color="danger">{error}</IonLabel>
          </div>
        ) : isConnecting ? (
          <div className="ion-text-center ion-padding" role="status">
            <IonSpinner color="light" />
            <p>Connecting to OpenAI Realtime API...</p>
          </div>
        ) : (
          <>
            {/* Stage display and controls */}
            <div className="ion-padding">
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '1rem'
              }}>
                <div>
                  <div>
                    {isConnecting && <p>Connecting to AI Interview Coach...</p>}
                    {isConnected && progress === 0 && (
                      <IonChip color="success">Interview ready to begin, say hello!</IonChip>
                    )}
                    {isConnected && progress > 0 && (
                      <IonChip color="primary">Interview in progress</IonChip>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <IonButton 
                    onClick={connect}
                    disabled={sessionStatus !== "DISCONNECTED"}
                  >
                    Start Interview
                  </IonButton>
                  <IonButton 
                    color="danger" 
                    onClick={disconnect}
                    disabled={sessionStatus !== "CONNECTED"}
                  >
                    End Interview
                  </IonButton>
                </div>
              </div>

              {/* Interview feedback */}
              {feedback && progress > 0 && (
                <AccordionGroup>
                  <AccordionSection 
                    value="feedback" 
                    label={`Current Feedback: ${feedback.feedbackType}`}
                  >
                    <div className="ion-padding">
                      <p>{feedback.message}</p>
                      {feedback.details && (
                        <>
                          <h4>Strengths:</h4>
                          <ul>
                            {feedback.details.strengths.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                          <h4>Areas for Improvement:</h4>
                          <ul>
                            {feedback.details.improvements.map((imp, i) => (
                              <li key={i}>{imp}</li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  </AccordionSection>
                </AccordionGroup>
              )}

              {/* Preferences Summary */}
              {Object.keys(preferences).length > 0 && (
                <AccordionGroup>
                  <AccordionSection
                    value="preferences"
                    label="Your Job Preferences"
                  >
                    <div className="ion-padding">
                      {preferences.jobTypes && (
                        <div>
                          <h4>Job Types:</h4>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {preferences.jobTypes.map((type, i) => (
                              <IonChip key={i}>{type}</IonChip>
                            ))}
                          </div>
                        </div>
                      )}
                      {preferences.locations && (
                        <div>
                          <h4>Preferred Locations:</h4>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {preferences.locations.map((loc, i) => (
                              <IonChip key={i}>{loc}</IonChip>
                            ))}
                          </div>
                        </div>
                      )}
                      {preferences.salary && (
                        <div>
                          <h4>Salary Expectation:</h4>
                          <p>{preferences.salary}</p>
                        </div>
                      )}
                      {preferences.remote !== undefined && (
                        <div>
                          <h4>Remote Work:</h4>
                          <IonChip color={preferences.remote ? "success" : "medium"}>
                            {preferences.remote ? "Yes" : "No"}
                          </IonChip>
                        </div>
                      )}
                    </div>
                  </AccordionSection>
                </AccordionGroup>
              )}

              {/* Key Insights */}
              {keyInsights.length > 0 && (
                <AccordionGroup>
                  <AccordionSection
                    value="insights"
                    label="Key Insights"
                  >
                    <div className="ion-padding">
                      <ul>
                        {keyInsights.map((insight, i) => (
                          <li key={i}>{insight}</li>
                        ))}
                      </ul>
                    </div>
                  </AccordionSection>
                </AccordionGroup>
              )}
            </div>
            
            <div className="chat-container" role="log" aria-live="polite">
              {messages.map((msg, index) => (
                <ChatMessage 
                  key={index}
                  message={msg}
                  isUser={msg.isUser ?? false}
                />
              ))}
            </div>
          </>
        )}
      </IonContent>

      <IonFooter>
        <div className="chat-input-container">
          <IonItem lines="none" className="ion-margin-horizontal">
            <IonChip color={isConnected ? "success" : "medium"} slot="start">
              {isConnected ? "Connected" : "Disconnected"}
            </IonChip>
          </IonItem>
        </div>
      </IonFooter>
    </IonModal>
  );
};

export default RealtimeModal;
