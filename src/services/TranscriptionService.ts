import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

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
  private static async getOpenAIKey(): Promise<string> {
    const key = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    if (!key) {
      throw new Error('OpenAI API key not found in environment variables');
    }
    return key;
  }

  private static async prepareFileForUpload(uri: string): Promise<Blob> {
    if (Capacitor.isNativePlatform()) {
      try {
        // For native platforms, handle both recorded videos and selected files
        const fileContents = await Filesystem.readFile({
          path: uri,
          directory: Directory.Data
        });

        // If the file is already base64 encoded
        const data = fileContents.data as string;
        if (data.startsWith('data:')) {
          const response = await fetch(data);
          return await response.blob();
        }

        // Convert base64 to blob
        const base64Response = await fetch(`data:video/mp4;base64,${data}`);
        return await base64Response.blob();
      } catch (error) {
        console.error('Error preparing file for upload:', error);
        
        // If reading as base64 fails, try direct fetch (might be a content:// URI)
        try {
          const response = await fetch(uri);
          return await response.blob();
        } catch (fetchError) {
          console.error('Error fetching file directly:', fetchError);
          throw new Error('Failed to prepare video file for transcription');
        }
      }
    } else {
      // For web platform
      const response = await fetch(uri);
      return await response.blob();
    }
  }

  static async transcribeVideo(videoUri: string | File): Promise<TranscriptionResult> {
    try {
      const apiKey = await this.getOpenAIKey();
      const videoBlob = videoUri instanceof File ? videoUri : await this.prepareFileForUpload(videoUri);

      const formData = new FormData();
      formData.append('file', videoBlob, 'video.mp4');
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');
      formData.append('language', 'en');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Transcription failed: ${error}`);
      }

      const result = await response.json();
      return {
        text: result.text,
        segments: result.segments.map((segment: any) => ({
          id: segment.id,
          start: segment.start,
          end: segment.end,
          text: segment.text
        }))
      };
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  }
}

export default TranscriptionService; 