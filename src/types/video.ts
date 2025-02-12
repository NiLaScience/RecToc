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
  salary?: string;
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

export interface VideoItem {
  id?: string;
  title: string;
  videoUrl: string;
  thumbnailUrl?: string;
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