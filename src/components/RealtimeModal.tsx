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
} from '@ionic/react';
import { useState, useEffect, useRef } from 'react';
import { useRealtimeConnection } from '../hooks/useRealtimeConnection';
import ChatMessage from './ChatMessage';
import '../styles/chat.css';

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

const RealtimeModal: React.FC<RealtimeModalProps> = ({ isOpen, onClose, resumeData }) => {
  const contentRef = useRef<HTMLIonContentElement>(null);
  const {
    isConnected,
    isConnecting,
    error,
    messages,
    connect,
    disconnect,
  } = useRealtimeConnection(resumeData);

  useEffect(() => {
    if (isOpen && !isConnected && !isConnecting) {
      connect();
    }
    return () => {
      if (isConnected) {
        disconnect();
      }
    };
  }, [isOpen, isConnected, isConnecting, connect, disconnect]);

  useEffect(() => {
    contentRef.current?.scrollToBottom(300);
  }, [messages]);

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
