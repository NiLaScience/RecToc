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

    // Generate video ID and set up paths with user ID included
    const videoId = uuidv4();
    const userId = result.user.uid;
    const fileName = `${videoId}.mp4`;
    const storagePath = `users/${userId}/application-videos/${fileName}`;
    
    try {
      // Upload video first
      if (Capacitor.isNativePlatform()) {
        // For native platforms, we need to write to filesystem first
        const blob = await videoFile.arrayBuffer();
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

        // Upload to Firebase Storage with progress tracking
        await new Promise<void>((resolve, reject) => {
          FirebaseStorage.uploadFile({
            path: storagePath,
            uri: fileInfo.uri,
            metadata: {
              contentType: videoFile.type
            }
          }, (progress, error) => {
            if (error) {
              reject(error);
            } else if (progress?.completed) {
              resolve();
            }
          });
        });

        // Clean up the temporary file
        await Filesystem.deleteFile({
          path: fileName,
          directory: Directory.Cache
        });
      } else {
        // For web, use the blob directly
        const base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(videoFile);
        });

        // Remove data URL prefix
        const base64Content = base64Data.split(',')[1];

        await FirebaseStorage.uploadFile({
          path: storagePath,
          blob: new Blob([Buffer.from(base64Content, 'base64')], { type: videoFile.type }),
          metadata: {
            contentType: videoFile.type
          }
        }, () => {});
      }

      // Try to get the download URL with retries
      let videoURL: string | null = null;
      let attempts = 0;
      const maxAttempts = 5;
      const delay = 1000; // 1 second between attempts

      while (!videoURL && attempts < maxAttempts) {
        try {
          const result = await FirebaseStorage.getDownloadUrl({
            path: storagePath
          });
          videoURL = result.downloadUrl;
        } catch (error) {
          attempts++;
          if (attempts === maxAttempts) {
            throw new Error('Failed to get download URL after multiple attempts');
          }
          // Wait before next attempt
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      if (!videoURL) {
        throw new Error('Failed to get download URL');
      }

      // Update application with URL
      await FirebaseFirestore.updateDocument({
        reference: `${this.COLLECTION}/${applicationId}`,
        data: {
          videoURL,
          status: 'submitted',
          updatedAt: new Date().toISOString(),
          candidateId: result.user.uid
        }
      });
    } catch (error) {
      console.error('Error uploading application video:', error);
      // If we fail, we should try to clean up the uploaded file
      try {
        await FirebaseStorage.deleteFile({
          path: storagePath
        });
      } catch (cleanupError) {
        console.error('Error cleaning up failed upload:', cleanupError);
      }
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
    const base64Data = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
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
