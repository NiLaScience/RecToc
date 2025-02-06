import { v4 as uuidv4 } from 'uuid';
import { FirebaseStorage } from '@capacitor-firebase/storage';
import { 
  FirebaseFirestore,
  AddCollectionSnapshotListenerCallback,
  AddCollectionSnapshotListenerCallbackEvent,
  DocumentData
} from '@capacitor-firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import type { JobApplication, JobApplicationCreate, JobApplicationUpdate } from '../types/application';
import TranscriptionService from './TranscriptionService';
import ThumbnailService from './ThumbnailService';

interface FirestoreDocument {
  id: string;
  data: Record<string, any>;
}

class ApplicationService {
  private static readonly COLLECTION = 'applications';
  private static readonly STORAGE_PATH = 'application-videos';

  static async createApplication(jobId: string): Promise<JobApplication> {
    const result = await FirebaseAuthentication.getCurrentUser();
    if (!result.user) {
      throw new Error('User must be authenticated to create an application');
    }

    const application: JobApplicationCreate = {
      jobId,
      candidateId: result.user.uid,
      status: 'draft'
    };

    const doc = await FirebaseFirestore.addDocument({
      reference: this.COLLECTION,
      data: {
        ...application,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });

    // Extract the ID from the reference path
    const parts = doc.reference.toString().split('/');
    const id = parts[parts.length - 1];

    return {
      id,
      ...application,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  static async uploadApplicationVideo(applicationId: string, videoFile: File): Promise<void> {
    const result = await FirebaseAuthentication.getCurrentUser();
    if (!result.user) {
      throw new Error('User must be authenticated to upload application video');
    }

    // Generate video ID and set up paths
    const videoId = uuidv4();
    const fileName = `${videoId}.mp4`;
    const storagePath = `${this.STORAGE_PATH}/${fileName}`;
    
    try {
      // Generate thumbnail first
      const thumbnailFile = await ThumbnailService.generateThumbnail(videoFile);
      const thumbnailPath = `${this.STORAGE_PATH}/thumbnails/${videoId}.jpg`;

      // Upload thumbnail
      if (Capacitor.isNativePlatform()) {
        await this.uploadNativeFile(thumbnailFile, thumbnailPath);
      } else {
        await this.uploadWebFile(thumbnailFile, thumbnailPath);
      }

      // Get thumbnail URL
      const { downloadUrl: thumbnailURL } = await FirebaseStorage.getDownloadUrl({
        path: thumbnailPath
      });

      // Upload video
      if (Capacitor.isNativePlatform()) {
        await this.uploadNativeFile(videoFile, storagePath);
      } else {
        await this.uploadWebFile(videoFile, storagePath);
      }

      // Get video URL
      const { downloadUrl: videoURL } = await FirebaseStorage.getDownloadUrl({
        path: storagePath
      });

      // Generate transcript
      const transcript = await TranscriptionService.transcribeVideo(videoFile);

      // Update application document
      await FirebaseFirestore.updateDocument({
        reference: `${this.COLLECTION}/${applicationId}`,
        data: {
          videoURL,
          videoThumbnailURL: thumbnailURL,
          transcript: transcript.text,
          updatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error uploading application video:', error);
      throw error;
    }
  }

  static async submitApplication(applicationId: string): Promise<void> {
    const result = await FirebaseAuthentication.getCurrentUser();
    if (!result.user) {
      throw new Error('User must be authenticated to submit application');
    }

    await FirebaseFirestore.updateDocument({
      reference: `${this.COLLECTION}/${applicationId}`,
      data: {
        status: 'submitted',
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });
  }

  static async updateApplication(applicationId: string, update: JobApplicationUpdate): Promise<void> {
    const result = await FirebaseAuthentication.getCurrentUser();
    if (!result.user) {
      throw new Error('User must be authenticated to update application');
    }

    await FirebaseFirestore.updateDocument({
      reference: `${this.COLLECTION}/${applicationId}`,
      data: {
        ...update,
        updatedAt: new Date().toISOString()
      }
    });
  }

  static async getApplication(applicationId: string): Promise<JobApplication> {
    const result = await FirebaseFirestore.getDocument({
      reference: `${this.COLLECTION}/${applicationId}`
    });

    if (!result.snapshot?.data) {
      throw new Error('Application not found');
    }

    return {
      id: applicationId,
      ...result.snapshot.data
    } as JobApplication;
  }

  static async getUserApplications(status?: string): Promise<JobApplication[]> {
    const result = await FirebaseAuthentication.getCurrentUser();
    if (!result.user) {
      throw new Error('User must be authenticated to get applications');
    }

    return new Promise((resolve, reject) => {
      let listenerCallbackId: string | undefined;

      const callback: AddCollectionSnapshotListenerCallback<DocumentData> = (event, error) => {
        // Clean up the listener
        if (listenerCallbackId) {
          FirebaseFirestore.removeSnapshotListener({
            callbackId: listenerCallbackId
          });
        }

        if (error) {
          reject(error);
          return;
        }

        if (!event?.snapshots) {
          resolve([]);
          return;
        }

        const applications = event.snapshots
          .map(doc => {
            if (!doc.data) return null;
            return {
              id: doc.id,
              ...doc.data
            } as JobApplication;
          })
          .filter((app): app is JobApplication => 
            app !== null &&
            app.candidateId === result.user!.uid && 
            (!status || app.status === status)
          )
          .sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );

        resolve(applications);
      };

      // Add the listener and store the callback ID
      FirebaseFirestore.addCollectionSnapshotListener(
        { reference: this.COLLECTION },
        callback
      ).then(result => {
        listenerCallbackId = result;
      }).catch(reject);
    });
  }

  private static async uploadWebFile(file: File, path: string): Promise<void> {
    const response = await fetch(URL.createObjectURL(file));
    const blob = await response.blob();
    const base64Data = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });

    // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
    const base64Content = base64Data.split(',')[1];

    await FirebaseStorage.uploadFile({
      path,
      blob: new Blob([Buffer.from(base64Content, 'base64')], { type: file.type }),
      metadata: {
        contentType: file.type
      }
    }, () => {});
  }

  private static async uploadNativeFile(file: File, path: string): Promise<void> {
    const blob = await file.arrayBuffer();
    const fileName = path.split('/').pop()!;
    
    // Write to filesystem
    await Filesystem.writeFile({
      path: fileName,
      data: Buffer.from(blob).toString('base64'),
      directory: Directory.Cache
    });

    // Get the file URI
    const fileInfo = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Cache
    });

    // Upload to Firebase Storage
    await FirebaseStorage.uploadFile({
      path,
      uri: fileInfo.uri,
      metadata: {
        contentType: file.type
      }
    }, () => {});

    // Clean up the temporary file
    await Filesystem.deleteFile({
      path: fileName,
      directory: Directory.Cache
    });
  }
}

export default ApplicationService;
