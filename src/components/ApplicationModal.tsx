import { useEffect, useState } from 'react';
import {
  IonContent,
  IonSpinner,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonButton,
  IonIcon,
  IonChip,
  useIonToast,
  IonModal,
  IonProgressBar,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
} from '@ionic/react';
import { videocamOutline, cameraOutline, closeOutline } from 'ionicons/icons';
import { useAuth } from '../context/AuthContext';
import VideoRecorder from './VideoRecorder';
import type { JobApplication } from '../types/application';
import type { VideoItem } from '../types/video';
import type { UserProfile } from '../types/user';
import ApplicationService from '../services/ApplicationService';
import { addSnapshotListener, removeSnapshotListener } from '../config/firebase';
import { Capacitor } from '@capacitor/core';
import AccordionGroup from './shared/AccordionGroup';
import AccordionSection from './shared/AccordionSection';
import { ListContent, ChipsContent, ExperienceContent, EducationContent } from './shared/AccordionContent';
import type { CVSchema, JobDescriptionSchema } from '../services/OpenAIService';

interface ApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
}

const ApplicationModal: React.FC<ApplicationModalProps> = ({ isOpen, onClose, jobId }) => {
  const { user } = useAuth();
  const [presentToast] = useIonToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [jobPost, setJobPost] = useState<VideoItem | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [application, setApplication] = useState<JobApplication | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMode, setUploadMode] = useState<'record' | 'file'>('record');

  const defaultJobDescription: JobDescriptionSchema = {
    title: 'Untitled Position',
    company: 'Unknown Company',
    location: 'Remote',
    employmentType: 'Full-time',
    experienceLevel: 'Not specified',
    skills: [],
    responsibilities: [],
    requirements: [],
    benefits: [],
  };

  useEffect(() => {
    let jobUnsubscribeId: string | null = null;
    let profileUnsubscribeId: string | null = null;

    const loadData = async () => {
      if (!user) return;

      try {
        // Listen to job post updates
        jobUnsubscribeId = await addSnapshotListener(
          `videos/${jobId}`,
          (data) => {
            if (data) {
              setJobPost(data as VideoItem);
              setLoading(false);
            }
          }
        );

        // Listen to user profile updates
        profileUnsubscribeId = await addSnapshotListener(
          `users/${user.uid}`,
          (data) => {
            if (data) {
              setProfile(data as UserProfile);
            }
          }
        );

        // Load existing application if any
        const existingApplication = await ApplicationService.getUserApplications();
        const jobApplication = existingApplication.find(app => app.jobId === jobId);
        if (jobApplication) {
          setApplication(jobApplication);
          if (jobApplication.videoURL) {
            setPreviewUrl(jobApplication.videoURL);
          }
        }
      } catch (error) {
        console.error('Error in loadData:', error);
        presentToast({
          message: 'Error loading application data',
          duration: 3000,
          color: 'danger',
        });
        setLoading(false);
      }
    };

    if (isOpen) {
      loadData();
    }

    return () => {
      if (jobUnsubscribeId) removeSnapshotListener(jobUnsubscribeId);
      if (profileUnsubscribeId) removeSnapshotListener(profileUnsubscribeId);
    };
  }, [user, jobId, isOpen, presentToast]);

  useEffect(() => {
    if (!isOpen) {
      setLoading(true);
    }
  }, [isOpen]);

  const handleVideoRecorded = async (uri: string, format: string) => {
    try {
      if (Capacitor.isNativePlatform()) {
        // For native platforms, convert URI to File
        const response = await fetch(uri);
        const blob = await response.blob();
        const file = new File([blob], `application-video.${format}`, { type: `video/${format}` });
        setVideoFile(file);
        setPreviewUrl(uri);
      } else {
        // For web platform, convert the blob directly
        const response = await fetch(uri);
        const blob = await response.blob();
        // Clean up the format string to remove codecs
        const cleanFormat = format.split(';')[0];
        const cleanMimeType = `video/${cleanFormat}`;
        // Create a clean blob with proper MIME type
        const cleanBlob = new Blob([blob], { type: cleanMimeType });
        const file = new File([cleanBlob], `application-video.${cleanFormat}`, { type: cleanMimeType });
        setVideoFile(file);
        setPreviewUrl(URL.createObjectURL(cleanBlob));
      }
    } catch (error) {
      console.error('Error handling recorded video:', error);
      presentToast({
        message: 'Error processing recorded video',
        duration: 3000,
        color: 'danger',
      });
    }
  };

  const handleVideoError = (error: string) => {
    presentToast({
      message: error,
      duration: 3000,
      color: 'danger',
    });
  };

  const handleSubmit = async () => {
    if (!user || !videoFile) return;

    setSubmitting(true);
    setUploadProgress(0);
    try {
      let applicationId = application?.id;
      
      // Create application if it doesn't exist
      if (!applicationId) {
        const newApplication = await ApplicationService.createApplication(jobId);
        applicationId = newApplication.id;
        setApplication(newApplication);
      }

      // Upload video with progress tracking
      await ApplicationService.uploadApplicationVideo(
        applicationId, 
        videoFile,
        (progress) => setUploadProgress(progress)
      );
      
      presentToast({
        message: 'Application submitted successfully',
        duration: 3000,
        color: 'success',
      });
      onClose();
    } catch (error) {
      console.error('Error submitting application:', error);
      presentToast({
        message: 'Error submitting application',
        duration: 3000,
        color: 'danger',
      });
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } catch (error) {
      console.error('Error handling file:', error);
      presentToast({
        message: 'Error processing video file',
        duration: 3000,
        color: 'danger',
      });
    }
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} className="application-modal">
      <IonHeader>
        <IonToolbar>
          <IonTitle>Apply for Job</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      
      <IonContent>
        {loading ? (
          <div className="ion-padding ion-text-center">
            <IonSpinner />
          </div>
        ) : (
          <>
            {/* Job Description */}
            <div>
              {jobPost && (
                <IonCard style={{ 
                  '--background': '#2a2a2a',
                  '--color': '#fff',
                  margin: 0,
                  borderRadius: '8px',
                  border: '2px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <IonCardHeader>
                    <IonCardTitle style={{ color: '#fff' }}>{jobPost.title}</IonCardTitle>
                    <IonCardSubtitle style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      {jobPost.jobDescription?.company || 'Company not specified'}
                      {jobPost.jobDescription?.location && ` • ${jobPost.jobDescription.location}`}
                    </IonCardSubtitle>
                  </IonCardHeader>
                  <IonCardContent>
                    {jobPost.jobDescription?.employmentType && (
                      <div style={{ marginBottom: '1rem' }}>
                        <IonChip style={{ '--background': '#333', '--color': '#fff' }}>
                          {jobPost.jobDescription.employmentType}
                        </IonChip>
                        {jobPost.jobDescription.experienceLevel && (
                          <IonChip style={{ '--background': '#333', '--color': '#fff' }}>
                            {jobPost.jobDescription.experienceLevel}
                          </IonChip>
                        )}
                      </div>
                    )}

                    <div style={{ marginBottom: '2rem' }}>
                      <h3 style={{ color: '#fff', marginBottom: '1rem' }}>Job Details</h3>
                      <AccordionGroup>
                        {jobPost.jobDescription?.responsibilities && jobPost.jobDescription.responsibilities.length > 0 && (
                          <AccordionSection value="responsibilities" label="Responsibilities">
                            <ListContent items={jobPost.jobDescription.responsibilities} />
                          </AccordionSection>
                        )}
                        
                        {jobPost.jobDescription?.requirements && jobPost.jobDescription.requirements.length > 0 && (
                          <AccordionSection value="requirements" label="Requirements">
                            <ListContent items={jobPost.jobDescription.requirements} />
                          </AccordionSection>
                        )}
                        
                        {jobPost.jobDescription?.skills && jobPost.jobDescription.skills.length > 0 && (
                          <AccordionSection value="skills" label="Required Skills">
                            <ChipsContent items={jobPost.jobDescription.skills} />
                          </AccordionSection>
                        )}

                        {jobPost.jobDescription?.benefits && jobPost.jobDescription.benefits.length > 0 && (
                          <AccordionSection value="benefits" label="Benefits">
                            <ListContent items={jobPost.jobDescription.benefits} />
                          </AccordionSection>
                        )}
                      </AccordionGroup>
                    </div>
                  </IonCardContent>
                </IonCard>
              )}
            </div>

            {/* User CV */}
            <div>
              <IonCard style={{ 
                '--background': '#2a2a2a',
                '--color': '#fff',
                margin: 0,
                borderRadius: '8px',
                border: '2px solid rgba(255, 255, 255, 0.1)'
              }}>
                <IonCardHeader>
                  <IonCardTitle style={{ color: '#fff' }}>Your Profile</IonCardTitle>
                  {profile && (
                    <IonCardSubtitle style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      {profile.displayName}
                      {profile.cv?.personalInfo.location && ` • ${profile.cv.personalInfo.location}`}
                    </IonCardSubtitle>
                  )}
                </IonCardHeader>
                <IonCardContent>
                  {profile?.cv ? (
                    <div>
                      <h3 style={{ color: '#fff', marginBottom: '1rem' }}>Candidate Details</h3>
                      <AccordionGroup>
                        {profile.cv.experience && profile.cv.experience.length > 0 && (
                          <AccordionSection value="experience" label="Experience">
                            {profile.cv.experience.map((exp: { title: string; company: string; location?: string; startDate: string; endDate?: string; current?: boolean; highlights: string[] }, index: number) => (
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

                        {profile.cv.education && profile.cv.education.length > 0 && (
                          <AccordionSection value="education" label="Education">
                            {profile.cv.education.map((edu: { institution: string; degree: string; field: string; graduationDate?: string; gpa?: number }, index: number) => (
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

                        {profile.cv?.skills && profile.cv.skills.length > 0 && (
                          <AccordionSection value="skills" label="Skills">
                            {profile.cv.skills.map((skillGroup: { category: string; items: string[] }, index: number) => (
                              <div key={index} style={{ marginBottom: index < (profile.cv?.skills?.length || 0) - 1 ? '1rem' : 0 }}>
                                <h4 style={{ color: '#fff', marginBottom: '0.5rem' }}>{skillGroup.category}</h4>
                                <ChipsContent items={skillGroup.items} />
                              </div>
                            ))}
                          </AccordionSection>
                        )}
                      </AccordionGroup>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                      <p>CV not available</p>
                    </div>
                  )}
                </IonCardContent>
              </IonCard>
            </div>

            {/* Video Recording Section */}
            <div style={{ maxWidth: '600px', margin: '1.5rem auto' }}>
              <h2 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1.25rem' }}>
                Pitch yourself!
              </h2>
              {!previewUrl ? (
                <>
                  {(uploadMode === 'file' || Capacitor.isNativePlatform()) ? (
                    <div className="ion-padding-vertical">
                      {/* Input for camera recording */}
                      <input
                        type="file"
                        accept="video/*"
                        capture="environment"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                        id="video-record"
                      />
                      
                      {/* Input for file selection */}
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                        id="video-select"
                      />

                      <div style={{ 
                        display: 'flex', 
                        flexDirection: Capacitor.isNativePlatform() ? 'column' : 'row',
                        gap: '1rem', 
                        justifyContent: 'center',
                        width: '100%'
                      }}>
                        {Capacitor.isNativePlatform() && (
                          <IonButton
                            expand="block"
                            style={{
                              '--background': '#0055ff',
                              '--color': '#fff',
                              '--border-radius': '8px'
                            }}
                            onClick={() => {
                              const input = document.getElementById('video-record');
                              input?.click();
                            }}
                          >
                            <IonIcon slot="start" icon={cameraOutline} />
                            Record Pitch
                          </IonButton>
                        )}
                        <IonButton
                          expand="block"
                          style={{
                            '--background': '#0055ff',
                            '--color': '#fff',
                            '--border-radius': '8px'
                          }}
                          onClick={() => {
                            const input = document.getElementById('video-select');
                            input?.click();
                          }}
                        >
                          <IonIcon slot="start" icon={videocamOutline} />
                          Select Video
                        </IonButton>
                      </div>
                    </div>
                  ) : (
                    <div style={{ maxWidth: '100%', margin: '0 auto' }}>
                      <VideoRecorder
                        onVideoRecorded={handleVideoRecorded}
                        onError={handleVideoError}
                      />
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'center',
                        marginTop: '1rem' 
                      }}>
                        <IonButton
                          fill="clear"
                          style={{ '--color': '#fff' }}
                          onClick={() => setUploadMode('file')}
                        >
                          <IonIcon slot="start" icon={videocamOutline} />
                          Or select a video file
                        </IonButton>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ 
                  width: '100%',
                  maxWidth: '600px',
                  margin: '0 auto'
                }}>
                  <div style={{
                    width: '100%',
                    paddingTop: '56.25%',
                    position: 'relative',
                    backgroundColor: '#000',
                    borderRadius: '8px',
                    overflow: 'hidden'
                  }}>
                    <video
                      src={previewUrl}
                      controls
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain'
                      }}
                    />
                  </div>
                  <IonButton
                    expand="block"
                    fill="clear"
                    style={{ '--color': '#fff' }}
                    className="mt-4"
                    onClick={() => {
                      setVideoFile(null);
                      if (previewUrl) {
                        URL.revokeObjectURL(previewUrl);
                        setPreviewUrl(null);
                      }
                      setUploadMode('record');
                    }}
                  >
                    Record Again
                  </IonButton>
                </div>
              )}
            </div>

            {videoFile && !submitting && (
              <IonButton
                expand="block"
                style={{ 
                  maxWidth: '600px', 
                  margin: '1.5rem auto',
                  '--background': '#0055ff',
                  '--color': '#fff',
                  '--border-radius': '8px',
                  '--padding-top': '1rem',
                  '--padding-bottom': '1rem'
                }}
                onClick={handleSubmit}
              >
                Submit Application
              </IonButton>
            )}

            {submitting && (
              <div style={{ maxWidth: '600px', margin: '1.5rem auto' }}>
                <IonProgressBar 
                  value={uploadProgress / 100}
                  style={{ '--progress-background': '#0055ff' }}
                />
                <p style={{ 
                  textAlign: 'center', 
                  marginTop: '0.5rem',
                  color: 'rgba(255, 255, 255, 0.7)'
                }}>
                  Uploading... {Math.round(uploadProgress)}%
                </p>
              </div>
            )}
          </>
        )}
      </IonContent>
    </IonModal>
  );
};

export default ApplicationModal;
