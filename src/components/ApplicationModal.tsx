import { useEffect, useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonSpinner,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonChip,
  IonList,
  IonItem,
  IonLabel,
  IonAccordionGroup,
  IonAccordion,
  useIonToast,
  IonModal,
  IonProgressBar,
} from '@ionic/react';
import { closeOutline, videocamOutline, documentTextOutline, cameraOutline } from 'ionicons/icons';
import { useAuth } from '../context/AuthContext';
import VideoRecorder from './VideoRecorder';
import type { JobApplication } from '../types/application';
import type { VideoItem, JobDescription } from '../types/video';
import type { UserProfile } from '../types/user';
import ApplicationService from '../services/ApplicationService';
import { addSnapshotListener, removeSnapshotListener } from '../config/firebase';
import { Capacitor } from '@capacitor/core';
import AppHeader from './AppHeader';

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

        setLoading(false);
      } catch (error) {
        console.error('Error in loadData:', error);
        presentToast({
          message: 'Error loading application data',
          duration: 3000,
          color: 'danger',
        });
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

  const handleVideoRecorded = async (uri: string, format: string) => {
    try {
      // Convert the URI to a File object
      const response = await fetch(uri);
      const blob = await response.blob();
      const file = new File([blob], `application-video.${format}`, { type: `video/${format}` });
      setVideoFile(file);
      setPreviewUrl(uri);
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
    try {
      let applicationId = application?.id;
      
      // Create application if it doesn't exist
      if (!applicationId) {
        const newApplication = await ApplicationService.createApplication(jobId);
        applicationId = newApplication.id;
        setApplication(newApplication);
      }

      // Upload video
      await ApplicationService.uploadApplicationVideo(applicationId, videoFile);
      
      presentToast({
        message: 'Video uploaded successfully',
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
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    });
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
    <IonModal 
      isOpen={isOpen} 
      onDidDismiss={onClose}
      style={{ '--height': '100%' }}
    >
      <IonContent scrollY={true} style={{ '--overflow': 'hidden' }}>
        <AppHeader
          title="Apply for Position"
          mode="apply"
          onClose={onClose}
        />

        <div style={{ 
          height: '100%', 
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <IonSpinner />
            </div>
          ) : (
            <div className="p-4" style={{ touchAction: 'pan-y' }}>
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: '1rem',
                maxWidth: '100%'
              }}>
                {/* Job Description */}
                <div>
                  {jobPost && (
                    <IonCard>
                      <IonCardHeader>
                        <IonCardTitle>{jobPost.title}</IonCardTitle>
                        <IonCardSubtitle>
                          {jobPost.jobDescription?.company || 'Company not specified'}
                          {jobPost.jobDescription?.location && ` • ${jobPost.jobDescription.location}`}
                        </IonCardSubtitle>
                      </IonCardHeader>
                      <IonCardContent>
                        {jobPost.jobDescription?.employmentType && (
                          <div className="mb-4">
                            <IonChip>{jobPost.jobDescription.employmentType}</IonChip>
                            {jobPost.jobDescription.experienceLevel && (
                              <IonChip>{jobPost.jobDescription.experienceLevel}</IonChip>
                            )}
                          </div>
                        )}

                        <IonAccordionGroup>
                          {jobPost.jobDescription?.responsibilities && jobPost.jobDescription.responsibilities.length > 0 && (
                            <IonAccordion value="responsibilities">
                              <IonItem slot="header">
                                <IonLabel>Responsibilities</IonLabel>
                              </IonItem>
                              <div className="p-4" slot="content">
                                <ul className="list-disc pl-6">
                                  {jobPost.jobDescription.responsibilities.map((item, index) => (
                                    <li key={index} className="mb-2">{item}</li>
                                  ))}
                                </ul>
                              </div>
                            </IonAccordion>
                          )}
                          
                          {jobPost.jobDescription?.requirements && jobPost.jobDescription.requirements.length > 0 && (
                            <IonAccordion value="requirements">
                              <IonItem slot="header">
                                <IonLabel>Requirements</IonLabel>
                              </IonItem>
                              <div className="p-4" slot="content">
                                <ul className="list-disc pl-6">
                                  {jobPost.jobDescription.requirements.map((item, index) => (
                                    <li key={index} className="mb-2">{item}</li>
                                  ))}
                                </ul>
                              </div>
                            </IonAccordion>
                          )}
                          
                          {jobPost.jobDescription?.skills && jobPost.jobDescription.skills.length > 0 && (
                            <IonAccordion value="skills">
                              <IonItem slot="header">
                                <IonLabel>Required Skills</IonLabel>
                              </IonItem>
                              <div className="p-4" slot="content">
                                <div className="flex flex-wrap gap-2">
                                  {jobPost.jobDescription.skills.map((skill, index) => (
                                    <IonChip key={index}>{skill}</IonChip>
                                  ))}
                                </div>
                              </div>
                            </IonAccordion>
                          )}

                          {jobPost.jobDescription?.benefits && jobPost.jobDescription.benefits.length > 0 && (
                            <IonAccordion value="benefits">
                              <IonItem slot="header">
                                <IonLabel>Benefits</IonLabel>
                              </IonItem>
                              <div className="p-4" slot="content">
                                <ul className="list-disc pl-6">
                                  {jobPost.jobDescription.benefits.map((item, index) => (
                                    <li key={index} className="mb-2">{item}</li>
                                  ))}
                                </ul>
                              </div>
                            </IonAccordion>
                          )}
                        </IonAccordionGroup>
                      </IonCardContent>
                    </IonCard>
                  )}
                </div>

                {/* User CV */}
                <div>
                  <IonCard>
                    <IonCardHeader>
                      <IonCardTitle>Your Profile</IonCardTitle>
                      {profile && (
                        <IonCardSubtitle>
                          {profile.displayName}
                          {profile.cv?.personalInfo.location && ` • ${profile.cv.personalInfo.location}`}
                        </IonCardSubtitle>
                      )}
                    </IonCardHeader>
                    <IonCardContent>
                      {profile?.cv ? (
                        <IonAccordionGroup>
                          {profile.cv.personalInfo.summary && (
                            <div className="mb-4 text-gray-600">
                              {profile.cv.personalInfo.summary}
                            </div>
                          )}

                          <IonAccordion value="experience">
                            <IonItem slot="header">
                              <IonLabel>Experience</IonLabel>
                            </IonItem>
                            <div className="p-4" slot="content">
                              {profile.cv.experience.length > 0 ? (
                                <div>
                                  {profile.cv.experience.map((exp, index) => (
                                    <div key={index} className="mb-4">
                                      <h3 className="font-bold">{exp.title}</h3>
                                      <p className="text-sm text-gray-600">
                                        {exp.company}
                                        {exp.location && ` • ${exp.location}`}
                                      </p>
                                      <p className="text-sm text-gray-600">
                                        {formatDate(exp.startDate)} - {exp.current ? 'Present' : exp.endDate && formatDate(exp.endDate)}
                                      </p>
                                      <ul className="mt-2 list-disc pl-6">
                                        {exp.highlights.map((highlight, i) => (
                                          <li key={i} className="text-sm">{highlight}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-gray-500">No experience listed</p>
                              )}
                            </div>
                          </IonAccordion>

                          <IonAccordion value="education">
                            <IonItem slot="header">
                              <IonLabel>Education</IonLabel>
                            </IonItem>
                            <div className="p-4" slot="content">
                              {profile.cv.education.length > 0 ? (
                                <div>
                                  {profile.cv.education.map((edu, index) => (
                                    <div key={index} className="mb-4">
                                      <h3 className="font-bold">{edu.degree} in {edu.field}</h3>
                                      <p className="text-sm text-gray-600">{edu.institution}</p>
                                      {edu.graduationDate && (
                                        <p className="text-sm text-gray-600">
                                          Graduated {formatDate(edu.graduationDate)}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-gray-500">No education listed</p>
                              )}
                            </div>
                          </IonAccordion>

                          <IonAccordion value="skills">
                            <IonItem slot="header">
                              <IonLabel>Skills</IonLabel>
                            </IonItem>
                            <div className="p-4" slot="content">
                              {profile.cv.skills.length > 0 ? (
                                <div>
                                  {profile.cv.skills.map((skillGroup, index) => (
                                    <div key={index} className="mb-4">
                                      <h3 className="font-bold mb-2">{skillGroup.category}</h3>
                                      <div className="flex flex-wrap gap-2">
                                        {skillGroup.items.map((skill, i) => (
                                          <IonChip key={i}>{skill}</IonChip>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-gray-500">No skills listed</p>
                              )}
                            </div>
                          </IonAccordion>
                        </IonAccordionGroup>
                      ) : (
                        <div className="text-center p-4">
                          <p className="text-gray-500">CV not available</p>
                        </div>
                      )}
                    </IonCardContent>
                  </IonCard>
                </div>
              </div>

              {/* Video Recording Section */}
              <div className="mt-6" style={{ maxWidth: '600px', margin: '1.5rem auto' }}>
                <h2 className="text-xl font-bold mb-4">Your Video Application</h2>
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
                              onClick={() => {
                                const input = document.getElementById('video-record');
                                input?.click();
                              }}
                            >
                              <IonIcon slot="start" icon={cameraOutline} />
                              Record Video
                            </IonButton>
                          )}
                          <IonButton
                            expand="block"
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
                      paddingTop: '56.25%', // 16:9 aspect ratio
                      position: 'relative'
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
                          objectFit: 'contain',
                          backgroundColor: '#000',
                          borderRadius: '8px'
                        }}
                      />
                    </div>
                    <IonButton
                      expand="block"
                      fill="clear"
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
                  className="mt-4"
                  style={{ maxWidth: '600px', margin: '1.5rem auto' }}
                  onClick={handleSubmit}
                >
                  Submit Application
                </IonButton>
              )}

              {submitting && (
                <div className="mt-4" style={{ maxWidth: '600px', margin: '0 auto' }}>
                  <IonProgressBar value={uploadProgress / 100} />
                  <p className="text-center mt-2">
                    Uploading... {Math.round(uploadProgress)}%
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </IonContent>
    </IonModal>
  );
};

export default ApplicationModal;
