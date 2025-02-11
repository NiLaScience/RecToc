import { v4 as uuidv4 } from 'uuid';
import { FirebaseStorage } from '@capacitor-firebase/storage';
import { 
  FirebaseFirestore,
  AddCollectionSnapshotListenerCallback,
  AddCollectionSnapshotListenerCallbackEvent,
  DocumentData,
  GetDocumentOptions,
  GetDocumentResult,
  AddDocumentOptions,
  AddDocumentResult,
  UpdateDocumentOptions,
  DeleteDocumentOptions,
  SetDocumentOptions
} from '@capacitor-firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import type { JobApplication, JobApplicationCreate, JobApplicationUpdate, ApplicationStatus } from '../types/application';
import TranscriptionService from './TranscriptionService';
import ThumbnailService from './ThumbnailService';

interface FirestoreDocument {
  id: string;
  data: Record<string, any>;
}

class ApplicationService {
  private static readonly COLLECTION = 'applications';
  private static readonly STORAGE_PATH = 'users';

  static async createApplication(jobId: string): Promise<JobApplication> {
    const result = await FirebaseAuthentication.getCurrentUser();
    console.log('Auth result:', result);
    if (!result.user) {
      throw new Error('User must be authenticated to create application');
    }

    const timestamp = new Date().toISOString();
    const applicationData = {
      jobId,
      candidateId: result.user.uid,
      status: 'draft' as ApplicationStatus,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    console.log('Creating application with data:', applicationData);

    try {
      const response = await FirebaseFirestore.addDocument({
        reference: this.COLLECTION,
        data: applicationData
      });

      // Get the document ID from the reference object
      const docId = response.reference.id;
      console.log('Created application with ID:', docId);

      if (!docId) {
        throw new Error('Failed to get application ID from Firebase reference');
      }

      // Return the created application with its ID
      const application: JobApplication = {
        id: docId,
        ...applicationData
      };

      console.log('Returning application:', application);
      return application;
    } catch (error) {
      console.error('Error creating application:', error);
      throw error;
    }
  }

  static async uploadApplicationVideo(
    applicationId: string | { id: string }, 
    videoFile: File,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    // Extract the ID string whether it's passed directly or as an object
    const appId = typeof applicationId === 'string' ? applicationId : applicationId.id;

    // Validate applicationId
    if (!appId || typeof appId !== 'string') {
      console.error('Invalid applicationId:', applicationId);
      throw new Error('Invalid application ID');
    }

    const result = await FirebaseAuthentication.getCurrentUser();
    console.log('Auth result for upload:', result);
    if (!result.user) {
      throw new Error('User must be authenticated to upload application video');
    }

    // Generate video ID and set up paths with user ID included
    const videoId = uuidv4();
    const userId = result.user.uid;
    const fileName = `${Date.now()}-${videoId}.${videoFile.type.split('/')[1].split(';')[0]}`; // Get clean extension with timestamp
    const storagePath = `${this.STORAGE_PATH}/${userId}/application-videos/${fileName}`;
    
    try {
      console.log('Starting video upload for application:', {
        applicationId: appId,
        userId,
        storagePath
      });

      // Upload video first
      let videoURL: string | null = null;
      const cleanMimeType = videoFile.type.split(';')[0];

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
        videoURL = await new Promise<string>((resolve, reject) => {
          FirebaseStorage.uploadFile({
            path: storagePath,
            uri: fileInfo.uri,
            metadata: { contentType: cleanMimeType }
          }, (progress, error) => {
            if (error) {
              reject(error);
            } else if (progress) {
              if (onProgress && progress.progress) {
                onProgress(progress.progress * 100);
              }
              if (progress.completed) {
                FirebaseStorage.getDownloadUrl({ path: storagePath })
                  .then(result => resolve(result.downloadUrl))
                  .catch(reject);
              }
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
        videoURL = await new Promise<string>((resolve, reject) => {
          FirebaseStorage.uploadFile({
            path: storagePath,
            blob: videoFile,
            metadata: { contentType: cleanMimeType }
          }, (progress, error) => {
            if (error) {
              reject(error);
            } else if (progress) {
              if (onProgress && progress.progress) {
                onProgress(progress.progress * 100);
              }
              if (progress.completed) {
                FirebaseStorage.getDownloadUrl({ path: storagePath })
                  .then(result => resolve(result.downloadUrl))
                  .catch(reject);
              }
            }
          });
        });
      }

      if (!videoURL) {
        throw new Error('Failed to get download URL');
      }

      // Update application with URL
      const updateData = {
        videoURL,
        status: 'submitted',
        updatedAt: new Date().toISOString(),
        candidateId: result.user.uid,
        submittedAt: new Date().toISOString()
      };

      console.log('Updating application with data:', {
        applicationId: appId,
        reference: `${this.COLLECTION}/${appId}`,
        data: updateData
      });

      // First get the existing application to verify ownership
      const existingApp = await FirebaseFirestore.getDocument({
        reference: `${this.COLLECTION}/${appId}`
      });

      if (!existingApp.snapshot?.data) {
        throw new Error('Application not found');
      }

      const appData = existingApp.snapshot.data;
      if (appData.candidateId !== result.user.uid) {
        throw new Error('You do not have permission to update this application');
      }

      // Now update the application
      await FirebaseFirestore.updateDocument({
        reference: `${this.COLLECTION}/${appId}`,
        data: updateData
      });
    } catch (error) {
      console.error('Detailed error:', error);
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

  static async updateApplicationDraft(
    applicationId: string | { id: string }, 
    videoFile: File,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    // Extract the ID string whether it's passed directly or as an object
    const appId = typeof applicationId === 'string' ? applicationId : applicationId.id;

    // Validate applicationId
    if (!appId || typeof appId !== 'string') {
      console.error('Invalid applicationId:', applicationId);
      throw new Error('Invalid application ID');
    }

    const result = await FirebaseAuthentication.getCurrentUser();
    console.log('Auth result for draft update:', result);
    if (!result.user) {
      throw new Error('User must be authenticated to update application draft');
    }

    // Generate video ID and set up paths with user ID included
    const videoId = uuidv4();
    const userId = result.user.uid;
    const fileName = `${Date.now()}-${videoId}.${videoFile.type.split('/')[1].split(';')[0]}`; // Get clean extension with timestamp
    const storagePath = `${this.STORAGE_PATH}/${userId}/application-videos/${fileName}`;
    
    try {
      console.log('Starting video upload for draft:', {
        applicationId: appId,
        userId,
        storagePath
      });

      // Upload video first
      let videoURL: string | null = null;
      const cleanMimeType = videoFile.type.split(';')[0];

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
        videoURL = await new Promise<string>((resolve, reject) => {
          FirebaseStorage.uploadFile({
            path: storagePath,
            uri: fileInfo.uri,
            metadata: { contentType: cleanMimeType }
          }, (progress, error) => {
            if (error) {
              reject(error);
            } else if (progress) {
              if (onProgress && progress.progress) {
                onProgress(progress.progress * 100);
              }
              if (progress.completed) {
                FirebaseStorage.getDownloadUrl({ path: storagePath })
                  .then(result => resolve(result.downloadUrl))
                  .catch(reject);
              }
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
        videoURL = await new Promise<string>((resolve, reject) => {
          FirebaseStorage.uploadFile({
            path: storagePath,
            blob: videoFile,
            metadata: { contentType: cleanMimeType }
          }, (progress, error) => {
            if (error) {
              reject(error);
            } else if (progress) {
              if (onProgress && progress.progress) {
                onProgress(progress.progress * 100);
              }
              if (progress.completed) {
                FirebaseStorage.getDownloadUrl({ path: storagePath })
                  .then(result => resolve(result.downloadUrl))
                  .catch(reject);
              }
            }
          });
        });
      }

      if (!videoURL) {
        throw new Error('Failed to get download URL');
      }

      // Update application with URL but keep draft status
      const updateData = {
        videoURL,
        updatedAt: new Date().toISOString(),
        candidateId: result.user.uid
      };

      console.log('Updating draft application with data:', {
        applicationId: appId,
        reference: `${this.COLLECTION}/${appId}`,
        data: updateData
      });

      // First get the existing application to verify ownership
      const existingApp = await FirebaseFirestore.getDocument({
        reference: `${this.COLLECTION}/${appId}`
      });

      if (!existingApp.snapshot?.data) {
        throw new Error('Application not found');
      }

      const appData = existingApp.snapshot.data;
      if (appData.candidateId !== result.user.uid) {
        throw new Error('You do not have permission to update this application');
      }

      // Now update the application
      await FirebaseFirestore.updateDocument({
        reference: `${this.COLLECTION}/${appId}`,
        data: updateData
      });
    } catch (error) {
      console.error('Detailed error:', error);
      console.error('Error updating application draft:', error);
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
      const callback: AddCollectionSnapshotListenerCallback<DocumentData> = (event, error) => {
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

      // Add the listener but don't remove it immediately
      FirebaseFirestore.addCollectionSnapshotListener(
        { reference: this.COLLECTION },
        callback
      ).catch(reject);
    });
  }

  static async addSnapshotListener(
    callback: (data: any) => void,
    options?: {
      where?: [string, string, any][];
    }
  ): Promise<string> {
    let query = `${this.COLLECTION}`;
    if (options?.where) {
      // Add where clauses to the query
      query = options.where.reduce((q, [field, op, value]) => {
        return `${q}?where=${field}${op}${value}`;
      }, query);
    }

    // Use real-time listeners for both web and native platforms
    return new Promise((resolve, reject) => {
      FirebaseFirestore.addCollectionSnapshotListener(
        { reference: query },
        (event, error) => {
          if (error) {
            console.error('Snapshot listener error:', error);
            return;
          }
          if (event?.snapshots?.[0]?.data) {
            callback(event.snapshots[0].data);
          }
        }
      ).then(resolve).catch(reject);
    });
  }

  static async removeSnapshotListener(id: string): Promise<void> {
    if (!id) return;
    
    try {
      await FirebaseFirestore.removeSnapshotListener({
        callbackId: id
      });
    } catch (error) {
      console.error('Error removing snapshot listener:', error);
    }
  }

  static async refreshApplications(): Promise<void> {
    const result = await FirebaseAuthentication.getCurrentUser();
    if (!result.user) {
      throw new Error('User must be authenticated to refresh applications');
    }

    await FirebaseFirestore.getDocument({
      reference: this.COLLECTION
    });
  }

  static async deleteAllApplications(): Promise<void> {
    const result = await FirebaseAuthentication.getCurrentUser();
    if (!result.user) {
      throw new Error('User must be authenticated to delete applications');
    }

    const applications = await this.getUserApplications();
    
    // Delete each application
    await Promise.all(applications.map(async (app) => {
      await FirebaseFirestore.deleteDocument({
        reference: `${this.COLLECTION}/${app.id}`
      });
    }));
  }

  static async listenToApplications(callback: (applications: JobApplication[]) => void): Promise<string> {
    const result = await FirebaseAuthentication.getCurrentUser();
    if (!result.user) {
      throw new Error('User must be authenticated to listen to applications');
    }

    const response = await FirebaseFirestore.getDocument({
      reference: this.COLLECTION
    });

    if (response.snapshot?.data) {
      const applications = Object.entries(response.snapshot.data).map(([id, data]) => ({
        id,
        ...data
      })) as JobApplication[];
      callback(applications);
    }

    return this.COLLECTION;
  }

  static async removeApplicationListener(id: string): Promise<void> {
    // No-op since we're not using real-time listeners
  }
}

export default ApplicationService;
