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
} from '@ionic/react';
import { closeOutline, videocamOutline, documentTextOutline } from 'ionicons/icons';
import { useAuth } from '../context/AuthContext';
import VideoRecorder from './VideoRecorder';
import type { JobApplication } from '../types/application';
import type { VideoItem, JobDescription } from '../types/video';
import type { UserProfile } from '../types/user';
import ApplicationService from '../services/ApplicationService';
import { addSnapshotListener, removeSnapshotListener } from '../config/firebase';

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

  useEffect(() => {
    let jobUnsubscribeId: string | null = null;
    let profileUnsubscribeId: string | null = null;

    const loadData = async () => {
      if (!user) return;

      try {
        // Listen to job post updates
        jobUnsubscribeId = await addSnapshotListener(
          'videos',
          jobId,
          (data) => {
            if (data) {
              setJobPost(data as VideoItem);
            }
          },
          (error) => {
            console.error('Error loading job post:', error);
            presentToast({
              message: 'Error loading job post',
              duration: 3000,
              color: 'danger',
            });
          }
        );

        // Listen to profile updates
        profileUnsubscribeId = await addSnapshotListener(
          'users',
          user.uid,
          (data) => {
            if (data) {
              setProfile(data as UserProfile);
            }
          },
          (error) => {
            console.error('Error loading profile:', error);
            presentToast({
              message: 'Error loading profile',
              duration: 3000,
              color: 'danger',
            });
          }
        );

        // Load existing application if any
        const existingApplication = await ApplicationService.getApplicationByJobId(jobId);
        if (existingApplication) {
          setApplication(existingApplication);
          if (existingApplication.videoUrl) {
            setPreviewUrl(existingApplication.videoUrl);
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

  const handleVideoRecorded = async (file: File) => {
    setVideoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!user || !videoFile) return;

    setSubmitting(true);
    try {
      if (!application) {
        await ApplicationService.createApplication(jobId);
      }
      await ApplicationService.uploadVideo(jobId, videoFile, (progress) => {
        setUploadProgress(progress);
      });
      presentToast({
        message: 'Application submitted successfully!',
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

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{jobPost?.title || 'Loading...'}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <IonSpinner />
          </div>
        ) : (
          <div className="p-4">
            {jobPost && (
              <IonCard>
                <IonCardHeader>
                  <IonCardTitle>{jobPost.title}</IonCardTitle>
                  <IonCardSubtitle>
                    Posted by {jobPost.recruiterName}
                  </IonCardSubtitle>
                </IonCardHeader>
                <IonCardContent>
                  <IonAccordionGroup>
                    <IonAccordion value="description">
                      <IonItem slot="header">
                        <IonLabel>Job Description</IonLabel>
                      </IonItem>
                      <div className="p-4" slot="content">
                        {(jobPost.description as JobDescription).sections.map((section, index) => (
                          <div key={index} className="mb-4">
                            <h3 className="font-bold mb-2">{section.title}</h3>
                            <ul className="list-disc pl-6">
                              {section.items.map((item, itemIndex) => (
                                <li key={itemIndex}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </IonAccordion>
                  </IonAccordionGroup>

                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-2">Required Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {jobPost.skills.map((skill, index) => (
                        <IonChip key={index}>{skill}</IonChip>
                      ))}
                    </div>
                  </div>
                </IonCardContent>
              </IonCard>
            )}

            <div className="mt-6">
              <h2 className="text-xl font-bold mb-4">Your Video Application</h2>
              {previewUrl ? (
                <div className="relative aspect-video">
                  <video
                    src={previewUrl}
                    controls
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
              ) : (
                <VideoRecorder onVideoRecorded={handleVideoRecorded} />
              )}
            </div>

            {videoFile && !submitting && (
              <IonButton
                expand="block"
                className="mt-4"
                onClick={handleSubmit}
              >
                Submit Application
              </IonButton>
            )}

            {submitting && (
              <div className="mt-4">
                <IonProgressBar value={uploadProgress / 100} />
                <p className="text-center mt-2">
                  Uploading... {Math.round(uploadProgress)}%
                </p>
              </div>
            )}
          </div>
        )}
      </IonContent>
    </IonModal>
  );
};

export default ApplicationModal;
