export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  description: string;
  username: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileUpdate extends Partial<Omit<UserProfile, 'uid' | 'createdAt'>> {
  updatedAt: string;
} 