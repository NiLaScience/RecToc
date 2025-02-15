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
import JobDescriptionAccordion from './shared/JobDescriptionAccordion';
import CVAccordion from './shared/CVAccordion';

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
      let videoFile: File;
      if (Capacitor.isNativePlatform()) {
        // For native platforms, convert URI to File
        const response = await fetch(uri);
        const blob = await response.blob();
        videoFile = new File([blob], `application-video.${format}`, { type: `video/${format}` });
      } else {
        // For web platform, convert the blob directly
        const response = await fetch(uri);
        const blob = await response.blob();
        // Clean up the format string to remove codecs
        const cleanFormat = format.split(';')[0];
        const cleanMimeType = `video/${cleanFormat}`;
        // Create a clean blob with proper MIME type
        const cleanBlob = new Blob([blob], { type: cleanMimeType });
        videoFile = new File([cleanBlob], `application-video.${cleanFormat}`, { type: cleanMimeType });
      }

      // Create draft application when video is recorded
      if (!application?.id) {
        const newApplication = await ApplicationService.createApplication(jobId);
        console.log('Created new application:', newApplication);
        setApplication(newApplication);
      }

      setVideoFile(videoFile);
      setPreviewUrl(Capacitor.isNativePlatform() ? uri : URL.createObjectURL(videoFile));
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

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Create draft application when video is uploaded
      if (!application?.id) {
        const newApplication = await ApplicationService.createApplication(jobId);
        console.log('Created new application:', newApplication);
        setApplication(newApplication);
      }

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

  const handleRecordedVideo = async (file: File) => {
    try {
      // Create draft application when video is recorded
      if (!application?.id) {
        const newApplication = await ApplicationService.createApplication(jobId);
        console.log('Created new application:', newApplication);
        setApplication(newApplication);
      }

      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } catch (error) {
      console.error('Error handling recorded video:', error);
      presentToast({
        message: 'Error processing video file',
        duration: 3000,
        color: 'danger',
      });
    }
  };

  useEffect(() => {
    // Cleanup preview URL when component unmounts or when previewUrl changes
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleSubmit = async () => {
    if (!user || (!videoFile && !application?.videoURL) || !application?.id) {
      console.log('Missing required data:', { 
        user: !!user, 
        video: !!(videoFile || application?.videoURL), 
        applicationId: application?.id 
      });
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);
    try {
      // If we have a new video file, upload it first
      if (videoFile) {
        await ApplicationService.uploadApplicationVideo(
          application.id,
          videoFile,
          (progress) => setUploadProgress(progress)
        );
      }
      
      // Submit the application
      await ApplicationService.submitApplication(application.id);

      // Submit to AI agent if the job has an application URL
      if (jobPost?.applicationUrl) {
        await ApplicationService.submitApplicationToAIAgent(application.id);
      } else {
        presentToast({
          message: 'Application submitted successfully',
          duration: 3000,
          color: 'success',
        });
      }
      
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

  const handleSaveDraft = async () => {
    if (!user || (!videoFile && !application?.videoURL) || !application?.id) {
      console.log('Missing required data:', { 
        user: !!user, 
        video: !!(videoFile || application?.videoURL), 
        applicationId: application?.id 
      });
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);
    try {
      // Only call updateApplicationDraft if we have a new video file
      if (videoFile) {
        await ApplicationService.updateApplicationDraft(
          application.id,
          videoFile,
          (progress) => setUploadProgress(progress)
        );
      }
      
      presentToast({
        message: 'Draft saved successfully',
        duration: 3000,
        color: 'success',
      });
      onClose();
    } catch (error) {
      console.error('Error saving draft:', error);
      presentToast({
        message: 'Error saving draft',
        duration: 3000,
        color: 'danger',
      });
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
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
          <div className="ion-padding">
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
                      <JobDescriptionAccordion
                        responsibilities={jobPost.jobDescription?.responsibilities}
                        requirements={jobPost.jobDescription?.requirements}
                        skills={jobPost.jobDescription?.skills}
                        benefits={jobPost.jobDescription?.benefits}
                        transcript={jobPost.transcript}
                      />
                      
                      {/* Debug Info */}
                      {jobPost.applicationUrl && (
                        <div style={{ 
                          marginTop: '1rem', 
                          padding: '0.5rem',
                          background: '#333',
                          borderRadius: '4px',
                          fontSize: '0.8rem'
                        }}>
                          <p style={{ 
                            color: '#888',
                            margin: 0,
                            wordBreak: 'break-all'
                          }}>
                            🔗 Application URL: {jobPost.applicationUrl}
                          </p>
                        </div>
                      )}
                    </div>
                  </IonCardContent>
                </IonCard>
              )}
            </div>

            {/* User CV */}
            <div>
              {profile?.cv ? (
                <CVAccordion
                  personalInfo={profile.cv.personalInfo}
                  experience={profile.cv.experience}
                  education={profile.cv.education}
                  skills={profile.cv.skills}
                  certifications={profile.cv.certifications}
                  languages={profile.cv.languages}
                  displayName={profile.displayName}
                />
              ) : (
                <IonCard style={{ 
                  '--background': '#2a2a2a',
                  '--color': '#fff',
                  margin: 0,
                  borderRadius: '8px',
                  border: '2px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <IonCardContent>
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                      <p>CV not available</p>
                    </div>
                  </IonCardContent>
                </IonCard>
              )}
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

            <div className="ion-padding-top ion-text-center">
              {submitting ? (
                <>
                  <IonSpinner name="dots" />
                  {uploadProgress > 0 && (
                    <IonProgressBar 
                      value={uploadProgress / 100} 
                      className="ion-margin-top"
                    />
                  )}
                </>
              ) : (
                <div className="ion-margin-top ion-justify-content-between" 
                     style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <IonButton 
                      expand="block"
                      fill="outline"
                      onClick={handleSaveDraft}
                      disabled={!videoFile && !application?.videoURL}
                    >
                      Save Draft
                    </IonButton>
                    <IonButton 
                      expand="block"
                      onClick={handleSubmit}
                      disabled={!videoFile && !application?.videoURL}
                    >
                      Submit Application
                    </IonButton>
                  </div>
                  
                  {jobPost?.applicationUrl && (
                    <IonButton
                      expand="block"
                      color="tertiary"
                      onClick={() => {
                        if (application?.id) {
                          ApplicationService.submitApplicationToAIAgent(application.id);
                        }
                      }}
                      disabled={!application?.id || !application?.videoURL}
                    >
                      🤖 Submit to AI Agent
                    </IonButton>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </IonContent>
    </IonModal>
  );
};

export default ApplicationModal;
