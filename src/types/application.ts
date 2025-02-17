import type { CVSchema } from './cv';

export type ApplicationStatus = 'draft' | 'submitted' | 'withdrawn' | 'rejected' | 'accepted';
export type AgentStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface JobApplication {
  id: string;
  jobId?: string;
  job_id?: string;
  candidateId?: string;
  candidate_id?: string;
  status: ApplicationStatus;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  videoURL?: string;
  video_url?: string;
  agentStatus?: AgentStatus;
  agent_status?: AgentStatus;
  agentGifUrl?: string;
  agent_gif_url?: string;
  agentError?: string;
  agent_error?: string;
  position_in_queue?: number;
  positionInQueue?: number;
  queued_at?: string;
  queuedAt?: string;
  started_at?: string;
  startedAt?: string;
  completed_at?: string;
  completedAt?: string;
  job_url?: string;
  jobUrl?: string;
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
