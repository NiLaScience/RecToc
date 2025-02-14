import type { CVSchema } from '../services/OpenAIService';

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