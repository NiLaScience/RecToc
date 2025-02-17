export interface JobDescription {
  title: string;
  company?: string;
  location?: string;
  employmentType?: string;
  experienceLevel?: string;
  responsibilities?: string[];
  requirements?: string[];
  skills?: string[];
  benefits?: string[];
  salary?: {
    min: number;
    max: number;
    currency: string;
    period: string;
  };
}

export interface Transcript {
  text: string;
  segments: {
    id: number | string;
    start: number;
    end: number;
    text: string;
  }[];
}

export interface Slide {
  title: string;        // e.g. "Highlights"
  heading: string;      // Short tagline
  bullets: string[];    // Bullet points for the slide
  backgroundImageUrl?: string;  // DALLE or other AI-generated image
}

export interface JobOpening {
  id: string;
  title: string;
  videoUrl?: string;  // Now optional
  slides: Slide[];    // Required array of 4 slides
  voiceoverUrl?: string;  // Optional TTS audio URL
  jobDescription?: JobDescription;
  tags: string[];
  userId: string;
  createdAt: string;
  views: number;
  likes: number;
  transcript?: Transcript | null;
  sourceVideo?: string;
  applicationUrl?: string;
} 