import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

export interface RecordingResult {
  uri: string;
  format: string;
  webPath?: string;
}

class VideoRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  async startRecording(): Promise<RecordingResult> {
    if (Capacitor.isNativePlatform()) {
      throw new Error('Video recording is not supported on mobile. Please use the file upload option instead.');
    } else {
      return this.startWebRecording();
    }
  }

  private async startWebRecording(): Promise<RecordingResult> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      return new Promise((resolve, reject) => {
        this.recordedChunks = [];
        this.mediaRecorder = new MediaRecorder(stream);

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.recordedChunks.push(event.data);
          }
        };

        this.mediaRecorder.onstop = async () => {
          const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          resolve({
            uri: url,
            format: 'webm',
            webPath: url,
          });
        };

        this.mediaRecorder.start();
      });
    } catch (error) {
      console.error('Error starting web recording:', error);
      throw error;
    }
  }

  async stopRecording(): Promise<void> {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }
  }
}

export default new VideoRecordingService(); 