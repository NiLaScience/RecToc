import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs/promises';
import * as path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';

interface TranscriptionResult {
  segments: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  text: string;
}

class NodeTranscriptionService {
  static async transcribeVideo(videoPath: string): Promise<TranscriptionResult> {
    const audioPath = path.join(path.dirname(videoPath), 'temp_audio.mp3');

    try {
      // Extract audio from video
      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoPath)
          .toFormat('mp3')
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .save(audioPath);
      });

      // Read the audio file
      const audioData = await fs.readFile(audioPath);

      // Create form data
      const form = new FormData();
      form.append('file', audioData, {
        filename: 'audio.mp3',
        contentType: 'audio/mp3',
      });
      form.append('model', 'whisper-1');
      form.append('response_format', 'verbose_json');

      // Send request to OpenAI
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
          ...form.getHeaders()
        },
        body: form
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as any;

      // Clean up temp audio file
      await fs.unlink(audioPath);

      // Format the response
      return {
        segments: result.segments.map((segment: any) => ({
          start: segment.start,
          end: segment.end,
          text: segment.text
        })),
        text: result.text
      };
    } catch (error) {
      // Clean up temp audio file if it exists
      try {
        await fs.unlink(audioPath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }
}

export default NodeTranscriptionService; 