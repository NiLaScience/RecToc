'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { IonContent, IonPage, IonAccordionGroup, IonAccordion, IonItem, IonLabel } from '@ionic/react';
import ApplicationService from '@/services/ApplicationService';
import VideoRecorder from '@/components/VideoRecorder';
import { JobApplication } from '@/types/application';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Filesystem, Directory } from '@capacitor/filesystem';

export default function Apply() {
  const searchParams = useSearchParams();
  const jobId = searchParams?.get('jobId');
  const { user } = useAuth();
  const router = useRouter();
  const accordionGroup = useRef<HTMLIonAccordionGroupElement>(null);
  const [application, setApplication] = useState<JobApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (!jobId) {
      setError('No job ID provided');
      setLoading(false);
      return;
    }

    const initializeApplication = async () => {
      try {
        const app = await ApplicationService.createApplication(jobId);
        setApplication(app);
      } catch (err) {
        console.error('Error creating application:', err);
        setError(err instanceof Error ? err.message : 'Failed to create application');
      } finally {
        setLoading(false);
      }
    };

    initializeApplication();
  }, [jobId, user, router]);

  // Set initial accordion value
  useEffect(() => {
    if (accordionGroup.current) {
      accordionGroup.current.value = 'video';
    }
  }, []);

  const handleVideoRecorded = async (uri: string, format: string) => {
    if (!application) return;

    try {
      // Read the file from the filesystem
      const result = await Filesystem.readFile({
        path: uri,
        directory: Directory.Data
      });

      let file: File;

      if (result.data instanceof Blob) {
        // If we got a Blob directly, create File from it
        file = new File([result.data], `video.${format}`, { type: `video/${format}` });
      } else {
        // If we got a base64 string, convert it to File
        const byteCharacters = atob(result.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: `video/${format}` });
        file = new File([blob], `video.${format}`, { type: `video/${format}` });
      }

      // Upload the file
      await ApplicationService.uploadApplicationVideo(application.id, file);
    } catch (err) {
      console.error('Error handling video:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload video');
    }
  };

  if (loading) {
    return (
      <IonPage>
        <IonContent>
          <div>Loading...</div>
        </IonContent>
      </IonPage>
    );
  }

  if (error) {
    return (
      <IonPage>
        <IonContent>
          <div>{error}</div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonContent>
        <IonAccordionGroup ref={accordionGroup}>
          <IonAccordion value="job">
            <IonItem slot="header">
              <IonLabel>Job Description</IonLabel>
            </IonItem>
            <div slot="content">
              {/* Job description content */}
            </div>
          </IonAccordion>

          <IonAccordion value="cv">
            <IonItem slot="header">
              <IonLabel>Upload CV</IonLabel>
            </IonItem>
            <div slot="content">
              {/* CV upload content */}
            </div>
          </IonAccordion>

          <IonAccordion value="video">
            <IonItem slot="header">
              <IonLabel>Video Application</IonLabel>
            </IonItem>
            <div slot="content">
              <VideoRecorder onVideoRecorded={handleVideoRecorded} onError={setError} />
            </div>
          </IonAccordion>
        </IonAccordionGroup>
      </IonContent>
    </IonPage>
  );
}
