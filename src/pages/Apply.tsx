import { useEffect, useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
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
} from '@ionic/react';
import { closeOutline, videocamOutline, documentTextOutline } from 'ionicons/icons';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import VideoRecorder from '../components/VideoRecorder';
import type { JobApplication } from '../types/application';
import type { VideoItem, JobDescription } from '../types/video';
import type { UserProfile } from '../types/user';
import ApplicationService from '../services/ApplicationService';
import { addSnapshotListener, removeSnapshotListener } from '../config/firebase';

const Apply: React.FC = () => {
  const router = useRouter();
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

  useEffect(() => {
    let jobUnsubscribeId: string | null = null;
    let profileUnsubscribeId: string | null = null;

    // Load job post and user profile
    const loadData = async () => {
      try {
        // Get job ID from URL
        const jobId = new URLSearchParams(window.location.search).get('jobId');
        if (!jobId) {
          router.push('/feed');
          return;
        }

        // Set up listeners for job post and profile
        jobUnsubscribeId = await addSnapshotListener(
          `videos/${jobId}`,
          (doc) => {
            if (doc.exists) {
              setJobPost({ id: doc.id, ...doc.data() } as VideoItem);
            }
          }
        );

        profileUnsubscribeId = await addSnapshotListener(
          `users/${user!.uid}`,
          (doc) => {
            if (doc.exists) {
              setProfile({ id: doc.id, ...doc.data() } as UserProfile);
            }
          }
        );

        // Create draft application
        const newApplication = await ApplicationService.createApplication(jobId);
        setApplication(newApplication);
        setLoading(false);
      } catch (error) {
        console.error('Error loading application data:', error);
        presentToast({
          message: 'Error loading application data. Please try again.',
          duration: 3000,
          color: 'danger'
        });
        router.push('/feed');
      }
    };

    loadData();

    return () => {
      if (jobUnsubscribeId) removeSnapshotListener(jobUnsubscribeId);
      if (profileUnsubscribeId) removeSnapshotListener(profileUnsubscribeId);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [user]);

  const handleVideoRecorded = async (uri: string, format: string) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const file = new File([blob], `application-video.${format}`, { type: `video/${format}` });
      
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } catch (error) {
      console.error('Error handling recorded video:', error);
      presentToast({
        message: 'Error processing recorded video. Please try again.',
        duration: 3000,
        color: 'danger'
      });
    }
  };

  const handleSubmit = async () => {
    if (!application || !videoFile) {
      presentToast({
        message: 'Please record a video before submitting.',
        duration: 3000,
        color: 'warning'
      });
      return;
    }

    setSubmitting(true);
    try {
      // Upload video and submit application
      await ApplicationService.uploadApplicationVideo(application.id, videoFile);
      await ApplicationService.submitApplication(application.id);
      
      presentToast({
        message: 'Application submitted successfully!',
        duration: 3000,
        color: 'success'
      });
      router.push('/applications');
    } catch (error) {
      console.error('Error submitting application:', error);
      presentToast({
        message: 'Error submitting application. Please try again.',
        duration: 3000,
        color: 'danger'
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !jobPost || !profile) {
    return (
      <IonPage>
        <IonContent>
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
          <IonTitle>Apply for Position</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => router.push('/feed')}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div style={{ padding: '1rem', paddingBottom: '80px' }}>
          <IonAccordionGroup value="video">
            {/* Job Description Accordion */}
            <IonAccordion value="job">
              <IonItem slot="header">
                <IonIcon icon={documentTextOutline} slot="start" />
                <IonLabel>Job Description</IonLabel>
              </IonItem>
              
              <IonCard slot="content">
                <IonCardHeader>
                  <IonCardTitle>{jobPost.jobDescription?.title || 'Job Description'}</IonCardTitle>
                  {jobPost.jobDescription?.company && (
                    <IonCardSubtitle>
                      {jobPost.jobDescription.company}
                      {jobPost.jobDescription.location && ` • ${jobPost.jobDescription.location}`}
                    </IonCardSubtitle>
                  )}
                </IonCardHeader>
                <IonCardContent>
                  <div style={{ marginBottom: '1rem' }}>
                    {jobPost.jobDescription?.employmentType && (
                      <IonChip>{jobPost.jobDescription.employmentType}</IonChip>
                    )}
                    {jobPost.jobDescription?.experienceLevel && (
                      <IonChip>{jobPost.jobDescription.experienceLevel}</IonChip>
                    )}
                  </div>

                  {jobPost.jobDescription?.responsibilities && (
                    <div style={{ marginBottom: '1rem' }}>
                      <h4>Responsibilities</h4>
                      <IonList>
                        {jobPost.jobDescription.responsibilities.map((item, index) => (
                          <IonItem key={index}>
                            <IonLabel className="ion-text-wrap">{item}</IonLabel>
                          </IonItem>
                        ))}
                      </IonList>
                    </div>
                  )}

                  {jobPost.jobDescription?.requirements && (
                    <div style={{ marginBottom: '1rem' }}>
                      <h4>Requirements</h4>
                      <IonList>
                        {jobPost.jobDescription.requirements.map((item, index) => (
                          <IonItem key={index}>
                            <IonLabel className="ion-text-wrap">{item}</IonLabel>
                          </IonItem>
                        ))}
                      </IonList>
                    </div>
                  )}

                  {jobPost.jobDescription?.skills && (
                    <div style={{ marginBottom: '1rem' }}>
                      <h4>Required Skills</h4>
                      <div>
                        {jobPost.jobDescription.skills.map((skill, index) => (
                          <IonChip key={index}>{skill}</IonChip>
                        ))}
                      </div>
                    </div>
                  )}

                  {jobPost.jobDescription?.benefits && (
                    <div>
                      <h4>Benefits</h4>
                      <IonList>
                        {jobPost.jobDescription.benefits.map((item, index) => (
                          <IonItem key={index}>
                            <IonLabel className="ion-text-wrap">{item}</IonLabel>
                          </IonItem>
                        ))}
                      </IonList>
                    </div>
                  )}
                </IonCardContent>
              </IonCard>
            </IonAccordion>

            {/* CV Accordion */}
            <IonAccordion value="cv">
              <IonItem slot="header">
                <IonIcon icon={documentTextOutline} slot="start" />
                <IonLabel>Your CV</IonLabel>
              </IonItem>
              
              <IonCard slot="content">
                <IonCardContent>
                  {profile.cv ? (
                    <>
                      {profile.cv.personalInfo.summary && (
                        <div style={{ marginBottom: '1rem' }}>
                          <h4>Professional Summary</h4>
                          <p>{profile.cv.personalInfo.summary}</p>
                        </div>
                      )}

                      {profile.cv.experience && profile.cv.experience.length > 0 && (
                        <div style={{ marginBottom: '1rem' }}>
                          <h4>Experience</h4>
                          {profile.cv.experience.map((exp, index) => (
                            <div key={index} style={{ marginBottom: '1rem' }}>
                              <h5>{exp.title} at {exp.company}</h5>
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
                        </div>
                      )}

                      {profile.cv.skills && profile.cv.skills.length > 0 && (
                        <div style={{ marginBottom: '1rem' }}>
                          <h4>Skills</h4>
                          {profile.cv.skills.map((skillGroup, index) => (
                            <div key={index} style={{ marginBottom: '0.5rem' }}>
                              <h5>{skillGroup.category}</h5>
                              <div>
                                {skillGroup.items.map((skill, i) => (
                                  <IonChip key={i}>{skill}</IonChip>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                      <p>No CV uploaded yet. Please upload your CV in your profile before applying.</p>
                      <IonButton routerLink="/profile">Go to Profile</IonButton>
                    </div>
                  )}
                </IonCardContent>
              </IonCard>
            </IonAccordion>

            {/* Video Recording Accordion */}
            <IonAccordion value="video">
              <IonItem slot="header">
                <IonIcon icon={videocamOutline} slot="start" />
                <IonLabel>Record Application Video</IonLabel>
              </IonItem>
              
              <div slot="content" style={{ padding: '1rem' }}>
                {!previewUrl ? (
                  <VideoRecorder
                    onVideoRecorded={handleVideoRecorded}
                    onError={(error) => {
                      presentToast({
                        message: error,
                        duration: 3000,
                        color: 'danger'
                      });
                    }}
                  />
                ) : (
                  <div>
                    <video
                      src={previewUrl}
                      controls
                      style={{ width: '100%', borderRadius: '8px' }}
                    />
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                      <IonButton
                        expand="block"
                        onClick={() => {
                          URL.revokeObjectURL(previewUrl);
                          setPreviewUrl(null);
                          setVideoFile(null);
                        }}
                      >
                        Record Again
                      </IonButton>
                    </div>
                  </div>
                )}
              </div>
            </IonAccordion>
          </IonAccordionGroup>

          <div style={{ 
            position: 'fixed', 
            bottom: 0, 
            left: 0, 
            right: 0, 
            padding: '1rem',
            background: 'var(--ion-background-color)',
            borderTop: '1px solid var(--ion-border-color)',
            zIndex: 1000
          }}>
            <IonButton
              expand="block"
              onClick={handleSubmit}
              disabled={submitting || !videoFile || !profile.cv}
            >
              {submitting ? <IonSpinner name="dots" /> : 'Submit Application'}
            </IonButton>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Apply;
