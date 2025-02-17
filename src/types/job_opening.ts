export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'internship' | 'freelance';
export type ExperienceLevel = 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
export type SalaryPeriod = 'yearly' | 'monthly' | 'weekly' | 'hourly';

/**
 * Represents a job description with standardized fields.
 * This is the single source of truth for job-related data across the application.
 */
export interface JobDescription {
  // Required fields
  title: string;

  // Optional fields with strict types
  company?: string;
  location?: string;
  employmentType?: EmploymentType;
  experienceLevel?: ExperienceLevel;
  responsibilities?: string[];
  requirements?: string[];
  skills?: string[];
  benefits?: string[];
  salary?: {
    min: number;
    max: number;
    currency: string;
    period: SalaryPeriod;
  };
}

/**
 * Default values for JobDescription fields.
 * Use this instead of defining defaults in individual components.
 */
export const DEFAULT_JOB_DESCRIPTION: JobDescription = {
  title: 'Untitled Position',
  company: 'Unknown Company',
  location: 'Remote',
  employmentType: 'full-time',
  experienceLevel: 'mid',
  responsibilities: [],
  requirements: [],
  skills: [],
  benefits: [],
};

/**
 * Schema object for use in prompts/parsing
 */
export const JobDescriptionSchemaObj = {
  title: "Job title",
  company: "Company name",
  location: "Job location",
  employmentType: "full-time/part-time/contract/internship/freelance",
  experienceLevel: "entry/mid/senior/lead/executive",
  skills: ["Required skill 1", "Required skill 2"],
  responsibilities: ["Responsibility 1", "Responsibility 2"],
  requirements: ["Requirement 1", "Requirement 2"],
  benefits: ["Benefit 1", "Benefit 2"],
  salary: {
    min: "minimum salary (number)",
    max: "maximum salary (number)",
    currency: "USD/EUR/etc",
    period: "yearly/monthly/weekly/hourly"
  }
} as const;

/**
 * Type guard to validate if an object matches the JobDescription interface
 */
export function isValidJobDescription(job: unknown): job is JobDescription {
  if (!job || typeof job !== 'object') return false;
  
  const j = job as any;
  if (typeof j.title !== 'string') return false;
  
  if (j.company !== undefined && typeof j.company !== 'string') return false;
  if (j.location !== undefined && typeof j.location !== 'string') return false;
  
  if (j.employmentType !== undefined && 
      !['full-time', 'part-time', 'contract', 'internship', 'freelance'].includes(j.employmentType)) {
    return false;
  }
  
  if (j.experienceLevel !== undefined && 
      !['entry', 'mid', 'senior', 'lead', 'executive'].includes(j.experienceLevel)) {
    return false;
  }
  
  if (j.responsibilities !== undefined && !Array.isArray(j.responsibilities)) return false;
  if (j.requirements !== undefined && !Array.isArray(j.requirements)) return false;
  if (j.skills !== undefined && !Array.isArray(j.skills)) return false;
  if (j.benefits !== undefined && !Array.isArray(j.benefits)) return false;
  
  if (j.salary !== undefined) {
    if (typeof j.salary !== 'object') return false;
    if (typeof j.salary.min !== 'number') return false;
    if (typeof j.salary.max !== 'number') return false;
    if (typeof j.salary.currency !== 'string') return false;
    if (!['yearly', 'monthly', 'weekly', 'hourly'].includes(j.salary.period)) return false;
  }
  
  return true;
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