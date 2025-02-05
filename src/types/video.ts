export interface VideoItem {
  id: string;
  title: string;
  videoUrl: string;
  thumbnailUrl?: string;
  jobDescription?: string;
  tags: string[];
  userId: string;
  createdAt: string;
  views: number;
  likes: number;
  transcript?: {
    text: string;
    segments: {
      id: number;
      start: number;
      end: number;
      text: string;
    }[];
  } | null;
} 