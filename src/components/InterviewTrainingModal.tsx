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
import { closeOutline } from 'ionicons/icons';
import { FirebaseFirestore } from '@capacitor-firebase/firestore';

import { useAuth } from '../context/AuthContext';
import type { JobApplication } from '../types/application';
import type { UserProfile } from '../types/user';
import type { JobOpening } from '../types/job_opening';
import AccordionGroup from './shared/AccordionGroup';
import AccordionSection from './shared/AccordionSection';
import { ListContent, ChipsContent } from './shared/AccordionContent';
import JobDescriptionAccordion from './shared/JobDescriptionAccordion';
import CVAccordion from './shared/CVAccordion';

import ApplicationService from '../services/ApplicationService';
import { addSnapshotListener, removeSnapshotListener } from '../config/firebase';
import { useInterviewCoach } from '../hooks/useInterviewCoach';
import type { JobDescriptionSchema } from '../types/parser';
import '../styles/chat.css';

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
  const [jobPost, setJobPost] = useState<JobOpening | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Set up the interview coach
  const {
    state: interviewState,
    sessionStatus,
    error: interviewError,
    messages: interviewMessages,
    stopInterview,
    connect,
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

  // Handle data loading
  useEffect(() => {
    let jobUnsubscribeId: string | null = null;
    let profileUnsubscribeId: string | null = null;

    const loadData = async () => {
      if (!user) return;

      try {
        jobUnsubscribeId = await addSnapshotListener(`job_openings/${jobId}`, (data) => {
          if (data) {
            setJobPost(data as JobOpening);
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

  useEffect(() => {
    const fetchJobPost = async () => {
      try {
        const response = await FirebaseFirestore.getDocument({
          reference: `job_openings/${jobId}`
        });

        if (!response.snapshot?.data) {
          throw new Error('Job post not found');
        }

        setJobPost({ id: jobId, ...response.snapshot.data } as JobOpening);
      } catch (error) {
        console.error('Error fetching job post:', error);
        setError('Failed to load job post');
      }
    };

    if (jobId) {
      fetchJobPost();
    }
  }, [jobId]);

  // Handle cleanup when modal closes
  useEffect(() => {
    if (!isOpen) {
      stopInterview();
    }
  }, [isOpen, stopInterview]);

  if (!isOpen) return null;

  return (
    <IonModal 
      isOpen={isOpen} 
      onDidDismiss={onClose}
      className="interview-training-modal"
    >
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
      
      <IonContent scrollY={true}>
        {loading ? (
          <div className="ion-padding ion-text-center">
            <IonSpinner />
          </div>
        ) : (
          <>
            <div style={{ padding: '1rem' }}>
              {/* Controls */}
              <div style={{ 
                display: 'flex',
                justifyContent: 'center',
                width: '100%',
                gap: '1rem',
                marginBottom: '1.5rem'
              }}>
                <IonButton 
                  onClick={connect}
                  disabled={sessionStatus !== 'DISCONNECTED'}
                >
                  Start Interview
                </IonButton>
                <IonButton 
                  color="danger" 
                  onClick={stopInterview}
                  disabled={sessionStatus !== 'CONNECTED'}
                >
                  End Interview
                </IonButton>
              </div>

              {/* Interview progress bar */}
              <IonProgressBar
                value={interviewState.progress / 100}
                color="primary"
                style={{ height: '6px', marginBottom: '1.5rem' }}
              ></IonProgressBar>

              {/* Stage information */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, marginBottom: '0.5rem' }}>
                  Stage: {interviewState.stageTitle} ({Math.round(interviewState.progress)}%)
                </h3>
                {sessionStatus === 'CONNECTING' && <p>Connecting to AI Interview Coach...</p>}
                {sessionStatus === 'CONNECTED' && interviewState.progress === 0 && (
                  <IonChip color="success">Interview ready to begin, say hello!</IonChip>
                )}
                {sessionStatus === 'CONNECTED' && interviewState.progress > 0 && (
                  <IonChip color="primary">Interview in progress</IonChip>
                )}
              </div>

              {/* Interview feedback */}
              {interviewState.feedback && interviewState.progress > 0 && (
                <AccordionGroup>
                  <AccordionSection 
                    value="feedback" 
                    label={`Current Feedback: ${interviewState.feedback.feedbackType}`}
                  >
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
          </>
        )}
      </IonContent>
    </IonModal>
  );
};

export default InterviewTrainingModal;
