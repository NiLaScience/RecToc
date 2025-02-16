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

export interface JobOpening {
  id: string;
  title: string;
  jobDescription?: JobDescription;
  userId: string;
  createdAt: string;
}

export interface CVSchema {
  personalInfo: {
    name: string;
    email?: string;
    phone?: string;
    location?: string;
    summary?: string;
  };
  experience: Array<{
    company: string;
    title: string;
    location?: string;
    startDate: string;
    endDate?: string;
    current?: boolean;
    highlights: string[];
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field: string;
    graduationDate?: string;
    gpa?: number;
  }>;
  skills: Array<{
    category: string;
    items: string[];
  }>;
}

export interface UserProfile {
  id: string;
  uid: string;
  displayName: string;
  username: string;
  email: string;
  photoURL?: string;
  description?: string;
  cv?: CVSchema;
  cvFileUrl?: string;
  createdAt: string;
  updatedAt: string;
}