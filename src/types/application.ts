import type { CVSchema } from '../services/OpenAIService';

export type ApplicationStatus = 
  | 'draft'      // Application started but not submitted
  | 'submitted'  // Application submitted to recruiter
  | 'reviewing'  // Recruiter is reviewing
  | 'shortlisted'// Candidate shortlisted
  | 'rejected'   // Application rejected
  | 'accepted'   // Application accepted
  | 'withdrawn'; // Candidate withdrew application

export interface JobApplication {
  id: string;
  jobId: string;            // Reference to the job posting
  candidateId: string;      // Reference to the candidate's user profile
  status: ApplicationStatus;
  videoURL?: string;        // URL to application video in Firebase Storage
  videoDuration?: number;   // Video duration in seconds
  videoThumbnailURL?: string; // URL to video thumbnail
  transcript?: string;      // Video transcript
  createdAt: string;       // When application was started
  updatedAt: string;       // Last update timestamp
  submittedAt?: string;    // When application was submitted
  notes?: string;          // Internal notes for recruiters
}

export interface JobApplicationCreate extends Omit<JobApplication, 'id' | 'createdAt' | 'updatedAt'> {
  candidateId: string;
  jobId: string;
  status: 'draft';
}

// For updating application status and adding notes
export interface JobApplicationUpdate extends Partial<Omit<JobApplication, 'id' | 'createdAt' | 'jobId' | 'candidateId'>> {
  updatedAt: string;
}

export interface Application {
  id: string;
  userId: string;
  jobId: string;
  jobTitle: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  updatedAt: string;
}
