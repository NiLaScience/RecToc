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

        // Check for existing application
        const existingApps = await ApplicationService.getUserApplications();
        const found = existingApps.find((app) => app.jobId === jobId);
        if (found) {
          setApplication(found);
          if (found.videoURL) {
            setPreviewUrl(found.videoURL);
          }
        }
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

            {/* Feedback display */}
            {interviewState.feedback && (
              <div
                style={{
                  margin: '1rem',
                  border: '1px solid #666',
                  padding: '1rem',
                  borderRadius: '8px',
                }}
              >
                <h4>Feedback: {interviewState.feedback.feedbackType}</h4>
                <p>{interviewState.feedback.message}</p>
                {interviewState.feedback.details && (
                  <>
                    <p>Strengths:</p>
                    <ul>
                      {interviewState.feedback.details.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                    <p>Improvements:</p>
                    <ul>
                      {interviewState.feedback.details.improvements.map((imp, i) => (
                        <li key={i}>{imp}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            {/* Job Posting Info */}
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
                  </AccordionGroup>
                </IonCardContent>
              </IonCard>
            )}

            {/* User's CV data */}
            {profile && profile.cv && (
              <IonCard>
                <IonCardHeader>
                  <IonCardTitle>Your CV</IonCardTitle>
                  <IonCardSubtitle>{profile.displayName}</IonCardSubtitle>
                </IonCardHeader>
                <IonCardContent>
                  {/* Show user CV in Accordions */}
                  <AccordionGroup>
                    {profile.cv.experience?.length > 0 && (
                      <AccordionSection value="experience" label="Experience">
                        {profile.cv.experience.map((exp, i) => (
                          <ExperienceContent
                            key={i}
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
                    {/* Education, Skills, etc. */}
                  </AccordionGroup>
                </IonCardContent>
              </IonCard>
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
