import { JobDescription, Slide } from '../types/job_opening';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface GenerateJobSlidesResponse {
  slides: Slide[];
  status: 'generating_images' | 'complete' | 'error';
}

interface GenerateVoiceoverResponse {
  voiceoverUrl: string;
}

export class SlideGenerationService {
  private functions = getFunctions();
  
  public async generateJobPresentation(jobData: JobDescription, jobId: string): Promise<{
    slides: Slide[];
    voiceoverUrl?: string;
    status: string;
  }> {
    const generateSlides = httpsCallable<
      { jobData: JobDescription; jobId: string },
      GenerateJobSlidesResponse
    >(this.functions, 'generateJobSlides');

    const generateVoiceover = httpsCallable<
      { jobData: JobDescription; jobId: string },
      GenerateVoiceoverResponse
    >(this.functions, 'generateVoiceover');

    try {
      // Generate slides first (this returns immediately with placeholder images)
      const slidesResponse = await generateSlides({ jobData, jobId });
      
      // Start voiceover generation
      const voiceoverResponse = await generateVoiceover({ jobData, jobId });

      return {
        slides: slidesResponse.data.slides,
        voiceoverUrl: voiceoverResponse.data.voiceoverUrl,
        status: slidesResponse.data.status
      };
    } catch (error) {
      console.error('Error in generateJobPresentation:', error);
      throw error;
    }
  }
} 