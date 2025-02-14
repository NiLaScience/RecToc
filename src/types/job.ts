export interface JobDescriptionSchema {
  title: string;
  company: string;
  location: string;
  salary_range?: string;
  requirements: string[];
  responsibilities: string[];
  benefits?: string[];
  skills: string[];
  employmentType?: string;
  experienceLevel?: string;
  applicationUrl?: string;  // URL for the job application page
} 