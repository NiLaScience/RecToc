import React, { useState } from 'react';
import {
  IonButton,
  IonIcon,
  IonSpinner,
  IonText,
} from '@ionic/react';
import { videocamOutline, stopCircleOutline } from 'ionicons/icons';
import VideoRecordingService from '../services/VideoRecordingService';

interface VideoRecorderProps {
  onVideoRecorded: (uri: string, format: string) => void;
  onError: (error: string) => void;
}

const VideoRecorder: React.FC<VideoRecorderProps> = ({ onVideoRecorded, onError }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);

  const startRecording = async () => {
    try {
      setLoading(true);
      setIsRecording(true);
      const result = await VideoRecordingService.startRecording();
      onVideoRecorded(result.uri, result.format);
    } catch (error) {
      console.error('Error starting recording:', error);
      onError('Failed to start recording. Please try again.');
    } finally {
      setLoading(false);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      setLoading(true);
      await VideoRecordingService.stopRecording();
    } catch (error) {
      console.error('Error stopping recording:', error);
      onError('Failed to stop recording. Please try again.');
    } finally {
      setLoading(false);
      setIsRecording(false);
    }
  };

  return (
    <div className="ion-padding-vertical">
      {loading ? (
        <IonButton expand="block" disabled>
          <IonSpinner name="crescent" />
        </IonButton>
      ) : isRecording ? (
        <IonButton expand="block" color="danger" onClick={stopRecording}>
          <IonIcon icon={stopCircleOutline} slot="start" />
          Stop Recording
        </IonButton>
      ) : (
        <IonButton expand="block" onClick={startRecording}>
          <IonIcon icon={videocamOutline} slot="start" />
          Record Video
        </IonButton>
      )}
    </div>
  );
};

export default VideoRecorder; 