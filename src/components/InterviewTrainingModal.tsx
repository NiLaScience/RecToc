import { useEffect, useState } from 'react';
import {
  IonContent,
  IonSpinner,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonChip,
  IonProgressBar,
  IonModal,
  IonButton,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonIcon,
} from '@ionic/react';
import { Capacitor } from '@capacitor/core';
import { closeOutline } from 'ionicons/icons';

import { useAuth } from '../context/AuthContext';
import VideoRecorder from './VideoRecorder';
import type { JobApplication } from '../types/application';
import type { VideoItem } from '../types/video';
import type { UserProfile } from '../types/user';
import AccordionGroup from './shared/AccordionGroup';
import AccordionSection from './shared/AccordionSection';
import { ListContent, ChipsContent, ExperienceContent, EducationContent } from './shared/AccordionContent';
import JobDescriptionAccordion from './shared/JobDescriptionAccordion';
import CVAccordion from './shared/CVAccordion';

import ApplicationService from '../services/ApplicationService';
import { addSnapshotListener, removeSnapshotListener } from '../config/firebase';
import { useInterviewCoach, INTERVIEW_STAGES } from '../hooks/useInterviewCoach';
import type { CVSchema, JobDescriptionSchema } from '../services/OpenAIService';

interface InterviewTrainingModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
}

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

const InterviewTrainingModal: React.FC<InterviewTrainingModalProps> = ({ isOpen, onClose, jobId }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [jobPost, setJobPost] = useState<VideoItem | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [application, setApplication] = useState<JobApplication | null>(null);

  // For video
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [uploadMode, setUploadMode] = useState<'record' | 'file'>('record');

  // Set up the interview coach
  const {
    state: interviewState,
    sessionStatus,
    error: interviewError,
    messages: interviewMessages,
    startInterview,
    stopInterview,
  } = useInterviewCoach({
    resumeData: profile?.cv || {
      personalInfo: { name: 'Anonymous' },
      experience: [],
      education: [],
      skills: [],
    },
    jobDescription: jobPost?.jobDescription
      ? { ...defaultJobDescription, ...jobPost.jobDescription }
      : defaultJobDescription,
    onProgressUpdate: (stage, progress, title) => {
      console.log('Interview progress updated:', { stage, progress, title });
    },
    onFeedback: (feedback) => {
      console.log('Feedback from agent:', feedback);
    },
  });

  useEffect(() => {
    let jobUnsubscribeId: string | null = null;
    let profileUnsubscribeId: string | null = null;

    const loadData = async () => {
      if (!user) return;

      try {
        jobUnsubscribeId = await addSnapshotListener(`videos/${jobId}`, (data) => {
          if (data) {
            setJobPost(data as VideoItem);
            setLoading(false);
          }
        });

        profileUnsubscribeId = await addSnapshotListener(`users/${user.uid}`, (data) => {
          if (data) {
            setProfile(data as UserProfile);
          }
        });
      } catch (err) {
        console.error('Error loading data:', err);
      }
    };

    if (isOpen) {
      loadData();
    }
    return () => {
      if (jobUnsubscribeId) removeSnapshotListener(jobUnsubscribeId);
      if (profileUnsubscribeId) removeSnapshotListener(profileUnsubscribeId);
    };
  }, [user, jobId, isOpen]);

  // Kick off the interview once we have job + profile
  useEffect(() => {
    if (jobPost && profile && sessionStatus === 'DISCONNECTED') {
      // Start interview once the Realtime connection is offline and we have data
      startInterview();
    }
  }, [jobPost, profile, sessionStatus, startInterview]);

  const handleSubmit = async () => {
    if (!videoFile || !user) return;
    setSubmitting(true);
    setUploadProgress(0);
    try {
      let applicationId = application?.id;
      if (!applicationId) {
        const newApp = await ApplicationService.createApplication(jobId);
        applicationId = newApp.id;
        setApplication(newApp);
      }
      await ApplicationService.uploadApplicationVideo(applicationId, videoFile, (prog) =>
        setUploadProgress(prog)
      );
      onClose();
    } catch (err) {
      console.error('Error uploading video:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Example handleVideoRecorded
  const handleVideoRecorded = async (uri: string, format: string) => {
    try {
      if (Capacitor.isNativePlatform()) {
        // Native
        const response = await fetch(uri);
        const blob = await response.blob();
        const file = new File([blob], `application-video.${format}`, { type: `video/${format}` });
        setVideoFile(file);
        setPreviewUrl(uri);
      } else {
        // Web
        const response = await fetch(uri);
        const blob = await response.blob();
        const cleanFormat = format.split(';')[0].replace('video/', '') || 'mp4';
        const cleanBlob = new Blob([blob], { type: `video/${cleanFormat}` });
        const file = new File([cleanBlob], `application-video.${cleanFormat}`, {
          type: `video/${cleanFormat}`,
        });
        setVideoFile(file);
        setPreviewUrl(URL.createObjectURL(cleanBlob));
      }
    } catch (error) {
      console.error('Error handling recorded video:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Interview Practice</IonTitle>
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
            {/* Interview progress bar */}
            <IonProgressBar
              value={interviewState.progress / 100}
              color="primary"
              style={{ height: '6px' }}
            ></IonProgressBar>

            {/* Stage display */}
            <div className="ion-padding-horizontal">
              <h3>
                Stage: {interviewState.stageTitle} ({Math.round(interviewState.progress)}%)
              </h3>
              {sessionStatus === 'CONNECTING' && <p>Connecting to AI Interview Coach...</p>}
              {sessionStatus === 'CONNECTED' && (
                <IonChip color="success">Connected</IonChip>
              )}
            </div>

            {/* Job Posting Info */}
            {jobPost && (
              <div className="ion-padding">
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

                    <JobDescriptionAccordion
                      responsibilities={jobPost.jobDescription?.responsibilities}
                      requirements={jobPost.jobDescription?.requirements}
                      skills={jobPost.jobDescription?.skills}
                      benefits={jobPost.jobDescription?.benefits}
                      transcript={jobPost.transcript}
                    />
                  </IonCardContent>
                </IonCard>
              </div>
            )}

            {/* User's CV data */}
            {profile?.cv && (
              <div style={{ margin: '1rem 0' }}>
                <CVAccordion
                  personalInfo={profile.cv.personalInfo}
                  experience={profile.cv.experience}
                  education={profile.cv.education}
                  skills={profile.cv.skills}
                  certifications={profile.cv.certifications}
                  languages={profile.cv.languages}
                  displayName={profile.displayName}
                />
              </div>
            )}

            {/* Interview feedback */}
            {interviewState.feedback && (
              <AccordionGroup>
                <AccordionSection value="feedback" label={`Feedback: ${interviewState.feedback.feedbackType}`}>
                  <div className="ion-padding">
                    <p>{interviewState.feedback.message}</p>
                    {interviewState.feedback.details && (
                      <>
                        <h4>Strengths:</h4>
                        <ul>
                          {interviewState.feedback.details.strengths.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                        <h4>Areas for Improvement:</h4>
                        <ul>
                          {interviewState.feedback.details.improvements.map((imp, i) => (
                            <li key={i}>{imp}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </AccordionSection>
              </AccordionGroup>
            )}

            {/* Video section */}
            <div className="ion-padding">
              {!previewUrl ? (
                uploadMode === 'file' ? (
                  <>
                    <input
                      type="file"
                      id="videoSelect"
                      style={{ display: 'none' }}
                      accept="video/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setVideoFile(f);
                          setPreviewUrl(URL.createObjectURL(f));
                        }
                      }}
                    />
                    <IonButton
                      onClick={() => {
                        const sel = document.getElementById('videoSelect');
                        sel?.click();
                      }}
                    >
                      Select a Video
                    </IonButton>
                  </>
                ) : (
                  <VideoRecorder
                    onVideoRecorded={handleVideoRecorded}
                    onError={(err) => console.error('Recorder error:', err)}
                  />
                )
              ) : (
                <div style={{ marginTop: '1rem' }}>
                  <video
                    src={previewUrl}
                    style={{ width: '100%', maxHeight: '300px' }}
                    controls
                  ></video>
                  <IonButton
                    fill="clear"
                    onClick={() => {
                      setVideoFile(null);
                      if (previewUrl) {
                        URL.revokeObjectURL(previewUrl);
                        setPreviewUrl(null);
                      }
                    }}
                  >
                    Record Again
                  </IonButton>
                </div>
              )}

              {videoFile && !submitting && (
                <IonButton expand="block" onClick={handleSubmit}>
                  Submit Application
                </IonButton>
              )}
              {submitting && (
                <>
                  <IonProgressBar value={uploadProgress / 100}></IonProgressBar>
                  <p>Uploading: {Math.round(uploadProgress)}%</p>
                </>
              )}
            </div>

            {/* End Interview */}
            {sessionStatus === 'CONNECTED' && (
              <div className="ion-padding">
                <IonButton color="danger" onClick={stopInterview}>
                  End Interview
                </IonButton>
              </div>
            )}
          </>
        )}
      </IonContent>
    </IonModal>
  );
};

export default InterviewTrainingModal;
