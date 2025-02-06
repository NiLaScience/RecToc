import type { CVSchema } from '../services/OpenAIService';

export interface UserProfile {
  id: string;
  displayName: string;
  username: string;
  email: string;
  photoURL?: string;
  description?: string;
  cv?: CVSchema;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileUpdate extends Partial<Omit<UserProfile, 'id' | 'createdAt'>> {
  updatedAt: string;
}