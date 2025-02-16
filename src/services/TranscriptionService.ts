import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import CloudFunctionService from './CloudFunctionService';

interface TranscriptionResult {
  text: string;
  segments: {
    id: number;
    start: number;
    end: number;
    text: string;
  }[];
}

class TranscriptionService {
  private static readonly MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB in bytes

  private static async extractAudioFromVideo(videoBlob: Blob): Promise<Blob> {
    return new Promise((resolve, reject) => {
      try {
        // Create a video element to load the video
        const videoElement = document.createElement('video');
        videoElement.src = URL.createObjectURL(videoBlob);
        
        // Create audio context and media elements
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioContext.createMediaElementSource(videoElement);
        const destination = audioContext.createMediaStreamDestination();
        source.connect(destination);
        
        // Create media recorder with audio only
        const mediaRecorder = new MediaRecorder(destination.stream, {
          mimeType: 'audio/webm;codecs=opus',
          audioBitsPerSecond: 128000 // 128kbps audio
        });
        
        const audioChunks: Blob[] = [];
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          resolve(audioBlob);
          
          // Cleanup
          URL.revokeObjectURL(videoElement.src);
          videoElement.remove();
          audioContext.close();
        };
        
        // Start recording and playing
        mediaRecorder.start();
        videoElement.play();
        
        // Stop recording when video ends
        videoElement.onended = () => {
          mediaRecorder.stop();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private static async prepareFileForUpload(uri: string): Promise<Blob> {
    if (Capacitor.isNativePlatform()) {
      try {
        // For Android, just fetch the file directly without base64 conversion
        const response = await fetch(uri);
        return await response.blob();
      } catch (error) {
        console.error('Error preparing file for upload:', error);
        throw new Error('Failed to prepare video file for transcription');
      }
    } else {
      // For web platform
      const response = await fetch(uri);
      const videoBlob = await response.blob();
      
      // If it's a video format, extract the audio
      if (videoBlob.type.startsWith('video/')) {
        console.log('Extracting audio from video...');
        return await this.extractAudioFromVideo(videoBlob);
      }
      
      return videoBlob;
    }
  }

  private static async compressVideo(blob: Blob): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const mediaRecorder = new MediaRecorder(canvas.captureStream(), {
        mimeType: 'video/webm;codecs=vp8',
        videoBitsPerSecond: 1000000 // 1Mbps
      });
      
      const chunks: Blob[] = [];
      
      video.src = URL.createObjectURL(blob);
      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        
        mediaRecorder.onstop = () => {
          const compressedBlob = new Blob(chunks, { type: 'video/webm' });
          URL.revokeObjectURL(video.src);
          resolve(compressedBlob);
        };
        
        video.onended = () => {
          mediaRecorder.stop();
        };
        
        mediaRecorder.start();
        video.play();
        
        const drawFrame = () => {
          if (video.ended || video.paused) return;
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          requestAnimationFrame(drawFrame);
        };
        drawFrame();
      };
      
      video.onerror = reject;
    });
  }

  static async transcribeVideo(videoUri: string | File): Promise<TranscriptionResult> {
    try {
      let audioBlob: Blob;

      if (videoUri instanceof File) {
        console.log('Processing video file:', videoUri.type, videoUri.size);
        try {
          audioBlob = await this.extractAudioFromVideo(videoUri);
          console.log('Audio extraction successful, blob size:', audioBlob.size);
        } catch (error) {
          console.error('Audio extraction failed:', error);
          throw new Error('Failed to extract audio from video');
        }
      } else {
        console.log('Processing video URI:', videoUri);
        const videoBlob = await this.prepareFileForUpload(videoUri);
        try {
          audioBlob = await this.extractAudioFromVideo(videoBlob);
          console.log('Audio extraction successful, blob size:', audioBlob.size);
        } catch (error) {
          console.error('Audio extraction failed:', error);
          throw new Error('Failed to extract audio from video');
        }
      }

      if (!audioBlob) {
        throw new Error('Failed to prepare audio for transcription');
      }

      // Convert blob to base64
      const reader = new FileReader();
      const audioBase64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result.split(',')[1]); // Remove data URL prefix
          } else {
            reject(new Error('Failed to convert audio to base64'));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      // Call the Cloud Function using CloudFunctionService
      console.log('Sending transcription request to Cloud Function...');
      const result = await CloudFunctionService.callFunction<
        {
          type: string;
          audioData: string;
          options: {
            response_format: string;
            language: string;
          };
        },
        {
          text: string;
          segments: Array<{
            id: number;
            start: number;
            end: number;
            text: string;
          }>;
        }
      >('callOpenAIAPI', {
        type: 'transcription',
        audioData: audioBase64,
        options: {
          response_format: 'verbose_json',
          language: 'en',
        },
      });

      return {
        text: result.text,
        segments: result.segments.map(segment => ({
          id: segment.id,
          start: segment.start,
          end: segment.end,
          text: segment.text,
        })),
      };
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  }
}

export default TranscriptionService; 