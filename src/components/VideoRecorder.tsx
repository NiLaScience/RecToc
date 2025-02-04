import React, { useState, useRef, useEffect } from 'react';
import {
  IonButton,
  IonIcon,
  IonSpinner,
  IonText,
} from '@ionic/react';
import { videocamOutline, stopCircleOutline, refreshOutline } from 'ionicons/icons';
import VideoRecordingService from '../services/VideoRecordingService';

interface VideoRecorderProps {
  onVideoRecorded: (uri: string, format: string) => void;
  onError: (error: string) => void;
}

const VideoRecorder: React.FC<VideoRecorderProps> = ({ onVideoRecorded, onError }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    initializeCamera();
    return () => {
      VideoRecordingService.cleanup();
      if (recordedVideoUrl) {
        URL.revokeObjectURL(recordedVideoUrl);
      }
    };
  }, []);

  const initializeCamera = async () => {
    try {
      setLoading(true);
      const stream = await VideoRecordingService.initializeRecording();
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error initializing camera:', error);
      onError('Failed to initialize camera. Please check permissions and try again.');
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      setLoading(true);
      if (recordedVideoUrl) {
        URL.revokeObjectURL(recordedVideoUrl);
        setRecordedVideoUrl(null);
      }
      await VideoRecordingService.startRecording();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      onError('Failed to start recording. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const stopRecording = async () => {
    try {
      setLoading(true);
      const result = await VideoRecordingService.stopRecording();
      setRecordedVideoUrl(result.uri);
      onVideoRecorded(result.uri, result.format);
      
      // Switch to the recorded video preview
      if (previewRef.current) {
        previewRef.current.src = result.uri;
        previewRef.current.play();
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      onError('Failed to stop recording. Please try again.');
    } finally {
      setLoading(false);
      setIsRecording(false);
    }
  };

  const resetRecording = () => {
    if (recordedVideoUrl) {
      URL.revokeObjectURL(recordedVideoUrl);
      setRecordedVideoUrl(null);
    }
    initializeCamera();
  };

  return (
    <div className="ion-padding-vertical">
      <div style={{ 
        width: '100%', 
        aspectRatio: '16/9',
        backgroundColor: '#000',
        borderRadius: '8px',
        overflow: 'hidden',
        marginBottom: '1rem',
        position: 'relative'
      }}>
        {/* Live camera preview */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'cover',
            display: recordedVideoUrl ? 'none' : 'block'
          }}
        />
        {/* Recorded video preview */}
        <video
          ref={previewRef}
          playsInline
          controls
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'contain',
            display: recordedVideoUrl ? 'block' : 'none',
            backgroundColor: '#000'
          }}
        />
      </div>

      {loading ? (
        <IonButton expand="block" disabled>
          <IonSpinner name="crescent" />
        </IonButton>
      ) : recordedVideoUrl ? (
        <IonButton expand="block" color="medium" onClick={resetRecording}>
          <IonIcon icon={refreshOutline} slot="start" />
          Record Again
        </IonButton>
      ) : isRecording ? (
        <IonButton expand="block" color="danger" onClick={stopRecording}>
          <IonIcon icon={stopCircleOutline} slot="start" />
          Stop Recording
        </IonButton>
      ) : (
        <IonButton expand="block" onClick={startRecording}>
          <IonIcon icon={videocamOutline} slot="start" />
          Start Recording
        </IonButton>
      )}
    </div>
  );
};

export default VideoRecorder; 