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
  private stream: MediaStream | null = null;

  async initializeRecording(): Promise<MediaStream> {
    if (this.stream) {
      return this.stream;
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    return this.stream;
  }

  async startRecording(): Promise<void> {
    if (!this.stream) {
      throw new Error('Recording not initialized');
    }

    this.recordedChunks = [];
    
    // Try to use MP4 format if supported, fallback to WebM
    const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
    const options = {
      mimeType: mimeType,
      videoBitsPerSecond: 2500000 // 2.5 Mbps
    };

    try {
      this.mediaRecorder = new MediaRecorder(this.stream, options);
    } catch (e) {
      console.warn('Failed to create MediaRecorder with specified options, falling back to defaults');
      this.mediaRecorder = new MediaRecorder(this.stream);
    }

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.start();
  }

  async stopRecording(): Promise<RecordingResult> {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      throw new Error('No active recording');
    }

    return new Promise((resolve, reject) => {
      this.mediaRecorder!.onstop = async () => {
        try {
          // Get the MIME type from the recorder
          const mimeType = this.mediaRecorder!.mimeType;
          const format = mimeType.split('/')[1];  // Extract format from MIME type
          
          const blob = new Blob(this.recordedChunks, { type: mimeType });
          const url = URL.createObjectURL(blob);

          // For web platform, we'll convert to MP4 if it's not already
          if (!Capacitor.isNativePlatform() && format !== 'mp4') {
            try {
              // Convert to MP4 using FFmpeg.js or similar library
              // For now, we'll just use the WebM format and handle the conversion
              // in the TranscriptionService
              console.log('Recording format:', format);
            } catch (error) {
              console.error('Error converting video format:', error);
            }
          }

          resolve({
            uri: url,
            format: format,
            webPath: url,
          });
        } catch (error) {
          reject(error);
        }
      };

      this.mediaRecorder!.stop();
    });
  }

  cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.recordedChunks = [];
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }
}

export default new VideoRecordingService(); 