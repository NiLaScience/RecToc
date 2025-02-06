'use client';

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonButton,
  IonSpinner,
  IonAvatar,
  useIonToast,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonChip,
} from '@ionic/react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { useRouter } from 'next/navigation';
import type { UserProfile } from '../types/user';
import { uploadFile, addSnapshotListener, updateDocument, removeSnapshotListener, signOut } from '../config/firebase';
import CVParserService from '../services/CVParserService';

const Profile = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [description, setDescription] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [cvFile, setCVFile] = useState<File | null>(null);
  const [cvUploading, setCVUploading] = useState(false);
  const [presentToast] = useIonToast();
  const pendingChangesRef = useRef<Set<string>>(new Set());

  // Helper function to update all profile-related state
  const updateProfileState = (profileData: UserProfile) => {
    setProfile(profileData);
    
    // Only update fields that don't have pending changes
    if (!pendingChangesRef.current.has('displayName')) {
      setDisplayName(profileData.displayName || '');
    }
    if (!pendingChangesRef.current.has('username')) {
      setUsername(profileData.username || '');
    }
    if (!pendingChangesRef.current.has('description')) {
      setDescription(profileData.description || '');
    }
    if (!pendingChangesRef.current.has('photoURL')) {
      setPhotoPreview(profileData.photoURL || '');
    }
  };

  // Track field changes
  const handleFieldChange = (field: string, value: string) => {
    pendingChangesRef.current.add(field);
    switch (field) {
      case 'displayName':
        setDisplayName(value);
        break;
      case 'username':
        setUsername(value);
        break;
      case 'description':
        setDescription(value);
        break;
    }
  };

  // Track photo changes
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      pendingChangesRef.current.add('photoURL');
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleCVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const fileType = file.type;
      
      // Check if file type is supported
      const supportedTypes = [
        'application/pdf',                     // PDF
        'application/msword',                  // DOC
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
        'text/plain',                         // TXT
        'application/rtf',                    // RTF
        'application/vnd.oasis.opendocument.text' // ODT
      ];
      
      if (!supportedTypes.includes(fileType)) {
        presentToast({
          message: 'Unsupported file type. Please upload a PDF, DOC, DOCX, TXT, RTF, or ODT file.',
          duration: 3000,
          color: 'danger'
        });
        return;
      }

      setCVFile(file);
      setCVUploading(true);
      
      try {
        const structuredCV = await CVParserService.parseCV(file);
        
        // Update user profile with CV data
        await updateDocument(`users/${user!.uid}`, {
          cv: structuredCV,
          updatedAt: new Date().toISOString()
        });

        presentToast({
          message: 'CV uploaded and parsed successfully',
          duration: 2000,
          color: 'success'
        });
      } catch (error) {
        console.error('Error uploading CV:', error);
        presentToast({
          message: 'Failed to upload CV. Please try again.',
          duration: 2000,
          color: 'danger'
        });
      } finally {
        setCVUploading(false);
        setCVFile(null);
      }
    }
  };

  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }

    let callbackId: string;

    const setupProfileListener = async () => {
      try {
        callbackId = await addSnapshotListener(`users/${user.uid}`, (profileData) => {
          updateProfileState(profileData as UserProfile);
          setLoading(false);
        });
      } catch (error) {
        console.error('Error setting up profile listener:', error);
        presentToast({
          message: 'Failed to set up profile updates',
          duration: 3000,
          color: 'danger'
        });
        setLoading(false);
      }
    };

    setupProfileListener();

    return () => {
      if (callbackId) {
        removeSnapshotListener(callbackId).catch(console.error);
      }
    };
  }, [user, router]);

  const handleSave = async () => {
    if (!user) {
      presentToast({
        message: 'You must be logged in to save profile',
        duration: 3000,
        color: 'warning'
      });
      return;
    }

    // Validate required fields
    if (!displayName.trim() || !username.trim()) {
      presentToast({
        message: 'Display name and username are required',
        duration: 3000,
        color: 'warning'
      });
      return;
    }

    setSaving(true);

    try {
      const timestamp = new Date().toISOString();
      const updates: Partial<UserProfile> = {};
      let hasChanges = false;

      // Only include fields that have actually changed
      if (displayName.trim() !== profile?.displayName) {
        updates.displayName = displayName.trim();
        hasChanges = true;
      }
      
      if (username.trim() !== profile?.username) {
        updates.username = username.trim();
        hasChanges = true;
      }
      
      if (description.trim() !== profile?.description) {
        updates.description = description.trim();
        hasChanges = true;
      }

      // Handle photo upload
      if (photoFile) {
        try {
          // Convert File to base64 for filesystem
          const arrayBuffer = await photoFile.arrayBuffer();
          const base64Data = Buffer.from(arrayBuffer).toString('base64');
          
          // Save to filesystem temporarily
          const tempFileName = `profile_${Date.now()}.jpg`;
          await Filesystem.writeFile({
            path: tempFileName,
            data: base64Data,
            directory: Directory.Cache
          });

          // Get the file URI
          const fileInfo = await Filesystem.getUri({
            path: tempFileName,
            directory: Directory.Cache
          });

          // Upload to Firebase Storage
          const photoURL = await uploadFile(
            `users/${user.uid}/profile.jpg`,
            fileInfo.uri,
            { contentType: 'image/jpeg' }
          );

          // Clean up temp file
          await Filesystem.deleteFile({
            path: tempFileName,
            directory: Directory.Cache
          });

          updates.photoURL = photoURL;
          hasChanges = true;
        } catch (error) {
          console.error('Error uploading photo:', error);
          presentToast({
            message: 'Failed to upload photo',
            duration: 3000,
            color: 'warning'
          });
        }
      }

      if (!hasChanges) {
        presentToast({
          message: 'No changes to save',
          duration: 3000,
          color: 'success'
        });
        setSaving(false);
        return;
      }

      // Add metadata
      updates.updatedAt = timestamp;

      // Update document
      await updateDocument(`users/${user.uid}`, updates);

      presentToast({
        message: 'Profile updated successfully',
        duration: 3000,
        color: 'success'
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      presentToast({
        message: 'Failed to save profile',
        duration: 3000,
        color: 'danger'
      });
    } finally {
      setSaving(false);
      pendingChangesRef.current.clear();
    }
  };

  if (loading) {
    return (
      <IonPage>
        <IonContent className="ion-padding">
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <IonSpinner />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Profile</IonTitle>
        </IonToolbar>
      </IonHeader>
      
      <IonContent>
        <div style={{ padding: '1rem' }}>
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                style={{ display: 'none' }}
                id="photo-upload"
              />
              <label htmlFor="photo-upload">
                <IonAvatar style={{ width: '100px', height: '100px', cursor: 'pointer' }}>
                  <img
                    src={photoPreview || 'https://ionicframework.com/docs/img/demos/avatar.svg'}
                    alt={displayName || 'User'}
                  />
                </IonAvatar>
              </label>
            </div>
          </div>

          <IonItem>
            <IonLabel position="stacked">Display Name</IonLabel>
            <IonInput
              value={displayName}
              onIonInput={e => handleFieldChange('displayName', e.detail.value!)}
              placeholder="Enter your display name"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Username</IonLabel>
            <IonInput
              value={username}
              onIonInput={e => handleFieldChange('username', e.detail.value!)}
              placeholder="Enter your username"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Bio</IonLabel>
            <IonTextarea
              value={description}
              onIonInput={e => handleFieldChange('description', e.detail.value!)}
              placeholder="Tell us about yourself"
              rows={4}
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">CV/Resume</IonLabel>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt,.rtf,.odt"
              onChange={handleCVUpload}
              style={{ marginTop: '0.5rem' }}
              disabled={cvUploading}
            />
            {cvUploading && (
              <div style={{ display: 'flex', alignItems: 'center', marginTop: '0.5rem' }}>
                <IonSpinner name="dots" style={{ marginRight: '0.5rem' }} />
                <span>Processing CV...</span>
              </div>
            )}
          </IonItem>

          {profile?.cv && (
            <div style={{ margin: '1rem 0' }}>
              <h3>Your CV Information</h3>
              
              {profile.cv.personalInfo.summary && (
                <IonCard>
                  <IonCardHeader>
                    <IonCardTitle>Professional Summary</IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    <p>{profile.cv.personalInfo.summary}</p>
                  </IonCardContent>
                </IonCard>
              )}

              {profile.cv.experience && profile.cv.experience.length > 0 && (
                <IonCard>
                  <IonCardHeader>
                    <IonCardTitle>Experience</IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    {profile.cv.experience.map((exp, index) => (
                      <div key={index} style={{ marginBottom: '1rem' }}>
                        <h4>{exp.title} at {exp.company}</h4>
                        <p style={{ color: 'var(--ion-color-medium)' }}>
                          {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                          {exp.location && ` • ${exp.location}`}
                        </p>
                        <ul>
                          {exp.highlights.map((highlight, i) => (
                            <li key={i}>{highlight}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </IonCardContent>
                </IonCard>
              )}

              {profile.cv.education && profile.cv.education.length > 0 && (
                <IonCard>
                  <IonCardHeader>
                    <IonCardTitle>Education</IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    {profile.cv.education.map((edu, index) => (
                      <div key={index} style={{ marginBottom: '1rem' }}>
                        <h4>{edu.degree} in {edu.field}</h4>
                        <p>{edu.institution}</p>
                        {edu.graduationDate && (
                          <p style={{ color: 'var(--ion-color-medium)' }}>
                            Graduated: {edu.graduationDate}
                            {edu.gpa && ` • GPA: ${edu.gpa}`}
                          </p>
                        )}
                      </div>
                    ))}
                  </IonCardContent>
                </IonCard>
              )}

              {profile.cv.skills && profile.cv.skills.length > 0 && (
                <IonCard>
                  <IonCardHeader>
                    <IonCardTitle>Skills</IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    {profile.cv.skills.map((skillGroup, index) => (
                      <div key={index} style={{ marginBottom: '1rem' }}>
                        <h4>{skillGroup.category}</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {skillGroup.items.map((skill, i) => (
                            <IonChip key={i}>{skill}</IonChip>
                          ))}
                        </div>
                      </div>
                    ))}
                  </IonCardContent>
                </IonCard>
              )}

              {profile.cv.certifications && profile.cv.certifications.length > 0 && (
                <IonCard>
                  <IonCardHeader>
                    <IonCardTitle>Certifications</IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    {profile.cv.certifications.map((cert, index) => (
                      <div key={index}>
                        <h4>{cert.name}</h4>
                        <p>
                          {cert.issuer}
                          {cert.date && ` • ${cert.date}`}
                        </p>
                      </div>
                    ))}
                  </IonCardContent>
                </IonCard>
              )}

              {profile.cv.languages && profile.cv.languages.length > 0 && (
                <IonCard>
                  <IonCardHeader>
                    <IonCardTitle>Languages</IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    {profile.cv.languages.map((lang, index) => (
                      <IonChip key={index}>
                        {lang.language} - {lang.proficiency}
                      </IonChip>
                    ))}
                  </IonCardContent>
                </IonCard>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
            <IonButton
              expand="block"
              onClick={handleSave}
              disabled={saving}
              className="ion-margin-top"
            >
              {saving ? <IonSpinner name="dots" /> : 'Save Changes'}
            </IonButton>

            <IonButton
              expand="block"
              color="danger"
              className="ion-margin-top"
              onClick={() => signOut().catch(console.error)}
            >
              Sign Out
            </IonButton>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Profile;