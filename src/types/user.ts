/**
 * Type definitions for CV/Resume data
 */
export type CVSchema = {
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
  certifications?: Array<{
    name: string;
    issuer: string;
    date?: string;
  }>;
  languages?: Array<{
    language: string;
    proficiency: string;
  }>;
};

/**
 * Schema object for use in prompts/parsing
 */
export const CVSchemaObj = {
  personalInfo: {
    name: "Full name",
    email: "Email address (if provided)",
    phone: "Phone number (if provided)",
    location: "Location (if provided)",
    summary: "Professional summary/objective"
  },
  experience: [{
    company: "Company name",
    title: "Job title",
    location: "Job location",
    startDate: "Start date (YYYY-MM format)",
    endDate: "End date (YYYY-MM format) or null if current",
    current: "true/false",
    highlights: ["Achievement/responsibility 1", "Achievement/responsibility 2"]
  }],
  education: [{
    institution: "School/University name",
    degree: "Degree type (e.g., Bachelor's, Master's)",
    field: "Field of study",
    graduationDate: "YYYY-MM format",
    gpa: "GPA number if provided"
  }],
  skills: [{
    category: "Skill category (e.g., Programming Languages, Tools)",
    items: ["Skill 1", "Skill 2"]
  }],
  certifications: [{
    name: "Certification name",
    issuer: "Issuing organization",
    date: "YYYY-MM format"
  }],
  languages: [{
    language: "Language name",
    proficiency: "Proficiency level"
  }]
} as const;

export interface UserProfile {
  id: string;
  uid: string;
  displayName: string;
  username: string;
  email: string;
  photoURL?: string;  // Keep using photoURL in our database schema
  description?: string;
  cv?: CVSchema;
  cvFileUrl?: string;  // URL to the stored CV PDF file
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileUpdate extends Partial<Omit<UserProfile, 'id' | 'createdAt'>> {
  updatedAt: string;
}