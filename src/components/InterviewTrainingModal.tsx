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

import { useAuth } from '../context/AuthContext';
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
import { useInterviewCoach } from '../hooks/useInterviewCoach';
import type { JobDescriptionSchema } from '../services/OpenAIService';

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
