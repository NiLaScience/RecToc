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
  IonAlert,
  IonIcon,
  IonAccordionGroup,
  IonAccordion,
  IonToggle,
} from '@ionic/react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { useRouter } from 'next/navigation';
import type { UserProfile } from '../types/user';
import { 
  uploadFile, 
  addSnapshotListener, 
  updateDocument, 
  removeSnapshotListener, 
  signOut,
  getRejectedJobs,
  unrejectJob,
  rejectJob,
} from '../config/firebase';
import CVParserService from '../services/CVParserService';
import { GeminiParserService } from '../services/GeminiParserService';
import AppHeader from './AppHeader';
import { pencilOutline } from 'ionicons/icons';
import AccordionGroup from './shared/AccordionGroup';
import AccordionSection from './shared/AccordionSection';
import { ListContent, ChipsContent, ExperienceContent, EducationContent } from './shared/AccordionContent';
import '../styles/accordion.css';

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
  const [showResetAlert, setShowResetAlert] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [useGemini, setUseGemini] = useState(true);

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
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));

      // Automatically save the photo
      try {
        let photoURL;
        
        if (Capacitor.isNativePlatform()) {
          // Convert File to base64 for filesystem
          const arrayBuffer = await file.arrayBuffer();
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
          photoURL = await uploadFile(
            `users/${user!.uid}/profile.jpg`,
            fileInfo.uri,
            { contentType: 'image/jpeg' }
          );

          // Clean up temp file
          await Filesystem.deleteFile({
            path: tempFileName,
            directory: Directory.Cache
          });
        } else {
          // For web platform, convert file to blob and base64
          const blob = new Blob([await file.arrayBuffer()], { type: file.type });
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = reader.result as string;
              // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
              const base64Data = base64.split(',')[1];
              resolve(base64Data);
            };
            reader.readAsDataURL(blob);
          });
          
          photoURL = await uploadFile(
            `users/${user!.uid}/profile.jpg`,
            base64,
            { 
              contentType: file.type,
              blob 
            }
          );
        }

        // Update the profile document with the new photo URL
        await updateDocument(`users/${user!.uid}`, {
          photoURL,
          updatedAt: new Date().toISOString()
        });

        presentToast({
          message: 'Profile photo updated successfully',
          duration: 3000,
          color: 'success'
        });
      } catch (error) {
        console.error('Error uploading photo:', error);
        presentToast({
          message: 'Failed to upload photo',
          duration: 3000,
          color: 'warning'
        });
        // Reset preview on error
        setPhotoPreview(profile?.photoURL || '');
      }
    }
  };

  // Helper function to write files in chunks (copied from Upload component)
  const writeFileInChunks = async (path: string, blob: Blob, chunkSize: number = 5 * 1024 * 1024) => {
    const totalSize = blob.size;
    let offset = 0;
    
    while (offset < totalSize) {
      const chunk = blob.slice(offset, offset + chunkSize);
      const chunkArrayBuffer = await chunk.arrayBuffer();
      const base64chunk = Buffer.from(chunkArrayBuffer).toString('base64');
      
      await Filesystem.appendFile({
        path,
        data: base64chunk,
        directory: Directory.Cache
      });
      
      offset += chunkSize;
    }
  };

  const handleCVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCVUploading(true);
    try {
      let parsedData;
      
      if (useGemini) {
        const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
        if (!geminiApiKey) {
          throw new Error('NEXT_PUBLIC_GEMINI_API_KEY is not configured in your environment');
        }
        const geminiParser = new GeminiParserService(geminiApiKey);
        // Convert File to base64 for Gemini
        const fileBuffer = await file.arrayBuffer();
        const base64String = Buffer.from(fileBuffer).toString('base64');
        parsedData = await geminiParser.parseCV(base64String);
      } else {
        parsedData = await CVParserService.parseCV(file);
      }
      
      // Update user profile with CV data
      await updateDocument(`users/${user!.uid}`, {
        cv: parsedData,
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
          let photoURL;
          
          if (Capacitor.isNativePlatform()) {
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
            photoURL = await uploadFile(
              `users/${user.uid}/profile.jpg`,
              fileInfo.uri,
              { contentType: 'image/jpeg' }
            );

            // Clean up temp file
            await Filesystem.deleteFile({
              path: tempFileName,
              directory: Directory.Cache
            });
          } else {
            // For web platform, convert file to blob and base64
            const blob = new Blob([await photoFile.arrayBuffer()], { type: photoFile.type });
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64 = reader.result as string;
                // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
                const base64Data = base64.split(',')[1];
                resolve(base64Data);
              };
              reader.readAsDataURL(blob);
            });
            
            photoURL = await uploadFile(
              `users/${user!.uid}/profile.jpg`,
              base64,
              { 
                contentType: photoFile.type,
                blob 
              }
            );
          }

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

  const handleResetRejections = async () => {
    if (!user) return;
    
    setResetting(true);
    try {
      const rejected = await getRejectedJobs();
      await Promise.all(rejected.map(r => unrejectJob(r.id)));
      presentToast({
        message: 'Successfully reset all job rejections',
        duration: 2000,
        color: 'success'
      });
    } catch (error) {
      console.error('Error resetting rejections:', error);
      presentToast({
        message: 'Failed to reset rejections. Please try again.',
        duration: 3000,
        color: 'danger'
      });
    } finally {
      setResetting(false);
      setShowResetAlert(false);
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
      <AppHeader
        title="Profile"
        mode="details"
        rightContent={
          <IonButton
            fill="clear"
            color="light"
            onClick={() => signOut().catch(console.error)}
          >
            Sign Out
          </IonButton>
        }
      />
      <IonContent>
        <div style={{ padding: '1rem', paddingTop: '56px' }}>
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                style={{ display: 'none' }}
                id="photo-upload"
                disabled={!editMode}
              />
              <label htmlFor="photo-upload" style={{ 
                cursor: editMode ? 'pointer' : 'default', 
                display: 'block', 
                position: 'relative' 
              }}>
                <IonAvatar style={{ 
                  width: '150px', 
                  height: '150px', 
                  margin: '0 auto',
                }}>
                  <img
                    src={photoPreview || 'https://ionicframework.com/docs/img/demos/avatar.svg'}
                    alt={displayName || 'User'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </IonAvatar>
                {editMode && (
                  <div style={{
                    position: 'absolute',
                    bottom: '0',
                    right: '0',
                    background: '#0055ff',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #1a1a1a'
                  }}>
                    <IonIcon 
                      icon={pencilOutline} 
                      style={{ 
                        color: '#fff',
                        fontSize: '20px'
                      }} 
                    />
                  </div>
                )}
              </label>
            </div>
          </div>

          <div className="input-container">
            <label className="input-label">Display Name</label>
            <IonInput
              value={displayName}
              onIonInput={e => handleFieldChange('displayName', e.detail.value!)}
              placeholder="Enter your display name"
              className={displayName ? 'has-value' : ''}
              disabled={!editMode}
            />
          </div>

          <div className="input-container">
            <label className="input-label">Username</label>
            <IonInput
              value={username}
              onIonInput={e => handleFieldChange('username', e.detail.value!)}
              placeholder="Enter your username"
              className={username ? 'has-value' : ''}
              disabled={!editMode}
            />
          </div>

          <div className="input-container">
            <label className="input-label">Bio</label>
            <IonTextarea
              value={description}
              onIonInput={e => handleFieldChange('description', e.detail.value!)}
              placeholder="Tell us about yourself"
              rows={4}
              className={description ? 'has-value' : ''}
              disabled={!editMode}
            />
          </div>

          <div className="input-container">

          <IonItem lines="none">
              <IonLabel>Use Gemini for parsing</IonLabel>
              <IonToggle 
                checked={useGemini}
                onIonChange={e => setUseGemini(e.detail.checked)}
                style={{ '--background': 'black', '--background-checked': 'black', '--handle-background': 'white', '--handle-background-checked': 'white' }}
              />
            </IonItem>

          </div>

          <div style={{ 
            display: 'flex', 
            gap: '1rem', 
            marginBottom: '2rem',
            marginTop: '2rem'
          }}>
            <IonButton
              expand="block"
              style={{ flex: 1 }}
              onClick={async () => {
                if (editMode) {
                  await handleSave();
                  setEditMode(false);
                } else {
                  setEditMode(true);
                }
              }}
              disabled={saving}
            >
              {saving ? (
                <IonSpinner name="dots" />
              ) : editMode ? (
                'Save Changes'
              ) : (
                'Edit Profile'
              )}
            </IonButton>



            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt,.rtf,.odt"
              onChange={handleCVUpload}
              style={{ display: 'none' }}
              id="cv-upload"
              disabled={cvUploading}
            />
            <IonButton
              expand="block"
              style={{ flex: 1 }}
              onClick={() => document.getElementById('cv-upload')?.click()}
              disabled={cvUploading}
            >
              {cvUploading ? (
                <>
                  <IonSpinner name="dots" style={{ marginRight: '0.5rem' }} />
                  <span>Processing...</span>
                </>
              ) : (
                'Upload Resume'
              )}
            </IonButton>


          </div>

          {profile?.cv && (
            <div style={{ margin: '1rem 0' }}>
              <h3 style={{ color: '#fff', marginBottom: '1rem' }}>Your CV Information</h3>
              
              <AccordionGroup>
                {profile?.cv?.personalInfo?.summary && (
                  <AccordionSection value="summary" label="Professional Summary">
                    {profile?.cv?.personalInfo?.summary}
                  </AccordionSection>
                )}

                {profile?.cv?.experience && profile?.cv?.experience?.length > 0 && (
                  <AccordionSection value="experience" label="Experience">
                    {profile?.cv?.experience?.map((exp, index) => (
                      <ExperienceContent
                        key={index}
                        title={exp.title}
                        company={exp.company}
                        startDate={exp.startDate}
                        endDate={exp.endDate}
                        current={exp.current}
                        location={exp.location}
                        highlights={exp.highlights}
                      />
                    ))}
                  </AccordionSection>
                )}

                {profile?.cv?.education && profile?.cv?.education?.length > 0 && (
                  <AccordionSection value="education" label="Education">
                    {profile?.cv?.education?.map((edu, index) => (
                      <EducationContent
                        key={index}
                        degree={edu.degree}
                        field={edu.field}
                        institution={edu.institution}
                        graduationDate={edu.graduationDate}
                        gpa={edu.gpa?.toString()}
                      />
                    ))}
                  </AccordionSection>
                )}

                {profile?.cv?.skills && profile?.cv?.skills?.length > 0 && (
                  <AccordionSection value="skills" label="Skills">
                    {profile?.cv?.skills?.map((skillGroup, index) => (
                      <div key={index} style={{ marginBottom: index < (profile?.cv?.skills?.length || 0) - 1 ? '1rem' : 0 }}>
                        <h4 style={{ color: '#fff', marginBottom: '0.5rem' }}>{skillGroup.category}</h4>
                        <ChipsContent items={skillGroup.items} />
                      </div>
                    ))}
                  </AccordionSection>
                )}

                {profile?.cv?.certifications && profile?.cv?.certifications?.length > 0 && (
                  <AccordionSection value="certifications" label="Certifications">
                    {profile?.cv?.certifications?.map((cert, index) => (
                      <div key={index} style={{ marginBottom: index < (profile?.cv?.certifications?.length || 0) - 1 ? '1rem' : 0 }}>
                        <h4 style={{ color: '#fff', marginBottom: '0.5rem' }}>{cert.name}</h4>
                        <p style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                          {cert.issuer}
                          {cert.date && ` • ${cert.date}`}
                        </p>
                      </div>
                    ))}
                  </AccordionSection>
                )}

                {profile?.cv?.languages && profile?.cv?.languages?.length > 0 && (
                  <AccordionSection value="languages" label="Languages">
                    <ChipsContent 
                      items={profile.cv.languages.map(lang => `${lang.language} - ${lang.proficiency}`)} 
                    />
                  </AccordionSection>
                )}
              </AccordionGroup>
            </div>
          )}

          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Danger Zone</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonButton
                color="danger"
                expand="block"
                onClick={() => setShowResetAlert(true)}
                disabled={resetting}
              >
                {resetting ? <IonSpinner /> : 'Reset All Job Rejections'}
              </IonButton>
            </IonCardContent>
          </IonCard>

          <IonAlert
            isOpen={showResetAlert}
            onDidDismiss={() => setShowResetAlert(false)}
            header="Reset Job Rejections"
            message="Are you sure you want to reset all your job rejections? This action cannot be undone."
            buttons={[
              {
                text: 'Cancel',
                role: 'cancel',
              },
              {
                text: 'Reset',
                role: 'destructive',
                handler: handleResetRejections,
              },
            ]}
          />
        </div>

        <style>{`
          ion-content {
            --background: #1a1a1a;
          }

          .input-container {
            margin: 24px 0;
          }

          ion-input, ion-textarea {
            --background: transparent !important;
            --color: #fff !important;
            --placeholder-color: rgba(255, 255, 255, 0.5);
            --padding-start: 16px !important;
            --padding-end: 16px !important;
            --border-radius: 8px;
            --highlight-color: #0055ff;
            min-height: 52px;
            border: 2px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
          }

          ion-input::part(wrapper),
          ion-textarea::part(wrapper) {
            padding-left: 12px;
          }

          ion-input::part(native),
          ion-textarea::part(native) {
            color: #fff !important;
          }

          ion-input:focus-within,
          ion-textarea:focus-within {
            border-color: #0055ff;
            border-width: 2px;
          }

          ion-input.has-value,
          ion-textarea.has-value {
            border-color: rgba(255, 255, 255, 0.3);
          }

          .file-input-label {
            display: block;
            color: rgba(255, 255, 255, 0.7);
            font-size: 0.875rem;
            margin-bottom: 8px;
            margin-left: 4px;
          }

          .file-input {
            width: 100%;
            padding: 8px;
            border-radius: 8px;
            border: 2px solid rgba(255, 255, 255, 0.2);
            background: transparent;
            color: #fff;
            cursor: pointer;
          }

          .file-input:hover {
            border-color: rgba(255, 255, 255, 0.3);
          }

          .file-input:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          ion-card {
            --background: #2a2a2a;
            --color: #fff;
            margin: 16px 0;
          }

          ion-card-header {
            --background: #333;
          }

          ion-card-title {
            --color: #fff;
          }

          ion-card-content {
            color: #fff;
          }

          ion-chip {
            --background: #333;
            --color: #fff;
          }

          h3, h4 {
            color: #fff;
          }

          p {
            color: rgba(255, 255, 255, 0.7);
          }

          ul {
            color: rgba(255, 255, 255, 0.7);
          }

          .input-label {
            display: block;
            color: rgba(255, 255, 255, 0.7);
            font-size: 0.875rem;
            margin-bottom: 8px;
            margin-left: 4px;
          }

          .cv-accordion {
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          }

          .cv-accordion:last-child {
            border-bottom: none;
          }

          ion-accordion-group {
            background: #2a2a2a;
            border: 2px solid rgba(255, 255, 255, 0.2);
          }

          ion-item::part(native) {
            border-radius: 0 !important;
            --border-color: rgba(255, 255, 255, 0.05) !important;
            --inner-border-width: 0;
          }

          .accordion-content {
            background: #2a2a2a;
            color: #fff;
          }

          ion-accordion.cv-accordion::part(header) {
            background: #2a2a2a;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          }

          ion-accordion.cv-accordion:last-child::part(header) {
            border-bottom: none;
          }

          ion-input[disabled], ion-textarea[disabled] {
            opacity: 1 !important;
            --placeholder-opacity: 0;
          }

          ion-input.has-value[disabled], ion-textarea.has-value[disabled] {
            border-color: rgba(255, 255, 255, 0.1);
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default Profile;