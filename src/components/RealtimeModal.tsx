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
} from '@ionic/react';
import { useState, useEffect, useRef } from 'react';
import { useRealtimeConnection, SessionStatus, InterviewStage } from '../hooks/useRealtimeConnection';
import ChatMessage from './ChatMessage';
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
  const contentRef = useRef<HTMLIonContentElement>(null);
  const {
    sessionStatus,
    error,
    messages,
    connect,
    disconnect,
    isCompleting,
    currentStage,
    totalStages,
  } = useRealtimeConnection(resumeData);

  const isConnected = sessionStatus === "CONNECTED";
  const isConnecting = sessionStatus === "CONNECTING";

  // Calculate progress (0 to 1)
  const progress = Math.min(
    (INTERVIEW_STAGES.indexOf(currentStage) + 1) / INTERVIEW_STAGES.length,
    1
  );

  const stageProgress = currentStage === InterviewStage.COMPLETED 
    ? 'Interview Complete'
    : `Stage ${INTERVIEW_STAGES.indexOf(currentStage) + 1}/${INTERVIEW_STAGES.length}: ${stageNames[currentStage]}`;

  useEffect(() => {
    if (isOpen && sessionStatus === "DISCONNECTED") {
      connect();
    }
    return () => {
      if (sessionStatus === "CONNECTED") {
        disconnect();
      }
    };
  }, [isOpen, sessionStatus, connect, disconnect]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle completion state
  useEffect(() => {
    if (isCompleting) {
      const toastId = toast.loading('Completing onboarding interview...', {
        duration: 5000,
      });

      const timer = setTimeout(() => {
        toast.dismiss(toastId);
        onClose();
        disconnect();
      }, 5000);

      return () => {
        clearTimeout(timer);
        toast.dismiss(toastId);
      };
    }
  }, [isCompleting, onClose, disconnect]);

  return (
    <IonModal 
      isOpen={isOpen} 
      onDidDismiss={onClose}
      data-inert={!isOpen}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle>OpenAI Realtime Chat</IonTitle>
          <IonButton slot="end" onClick={onClose} fill="clear" color="light">
            Close
          </IonButton>
        </IonToolbar>
        <div className="interview-progress">
          <IonProgressBar 
            value={progress} 
            color="primary"
            style={{ height: '6px' }}
          />
          <div className="stage-info ion-padding-horizontal ion-text-center">
            <small>{stageProgress}</small>
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
            <div className="connection-status">
              <IonChip color={isConnected ? "success" : "medium"} role="status">
                {isConnected ? "Connected" : "Disconnected"}
              </IonChip>
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
