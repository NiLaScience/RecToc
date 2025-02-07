import { v4 as uuidv4 } from 'uuid';
import { OpenAIService, type CVSchema } from './OpenAIService';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { FirebaseStorage } from '@capacitor-firebase/storage';
import { FirebaseFirestore } from '@capacitor-firebase/firestore';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

class CVParserService {
  static async parseCV(cvFile: File): Promise<CVSchema> {
    try {
      // Check authentication first
      const result = await FirebaseAuthentication.getCurrentUser();
      if (!result.user) {
        throw new Error('User must be authenticated to parse CVs');
      }

      const cvId = uuidv4();
      const fileExtension = cvFile.name.split('.').pop()?.toLowerCase() || 'pdf';
      const fileName = `${cvId}.${fileExtension}`;
      const storagePath = `cvs-to-parse/${fileName}`;
      let downloadURL: string;

      if (Capacitor.isNativePlatform()) {
        // Convert File to base64 for filesystem
        const blob = await cvFile.arrayBuffer();
        
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
        await new Promise<void>((resolve, reject) => {
          FirebaseStorage.uploadFile(
            {
              path: storagePath,
              uri: fileInfo.uri,
              metadata: {
                contentType: cvFile.type
              }
            },
            (event, error) => {
              if (error) {
                reject(error);
              } else if (event?.completed) {
                resolve();
              }
            }
          );
        });
      } else {
        // Web platform - use base64
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(cvFile);
        });

        // Write to filesystem
        await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache
        });

        // Get file URI
        const fileInfo = await Filesystem.getUri({
          path: fileName,
          directory: Directory.Cache
        });

        // Upload to Firebase Storage
        await new Promise<void>((resolve, reject) => {
          FirebaseStorage.uploadFile(
            {
              path: storagePath,
              uri: fileInfo.uri,
              metadata: {
                contentType: cvFile.type
              }
            },
            (event, error) => {
              if (error) {
                reject(error);
              } else if (event?.completed) {
                resolve();
              }
            }
          );
        });
      }
      
      // Get download URL
      const urlResult = await FirebaseStorage.getDownloadUrl({
        path: storagePath
      });
      downloadURL = urlResult.downloadUrl;

      // Clean up temp file
      await Filesystem.deleteFile({
        path: fileName,
        directory: Directory.Cache
      });

      // Wait for the parsed result in Firestore
      const rawText = await new Promise<string>((resolve, reject) => {
        let callbackId: string;

        // Add snapshot listener and store the callback ID
        FirebaseFirestore.addDocumentSnapshotListener(
          {
            reference: `parsedCVs/${cvId}`
          },
          async (event, error) => {
            if (error) {
              if (callbackId) {
                await FirebaseFirestore.removeSnapshotListener({
                  callbackId
                }).catch(console.error);
              }
              reject(error);
              return;
            }
            
            if (event?.snapshot?.data) {
              const data = event.snapshot.data;
              if (data.status === 'completed' && data.text) {
                try {
                  if (callbackId) {
                    await FirebaseFirestore.removeSnapshotListener({
                      callbackId
                    });
                  }
                  resolve(data.text);
                } catch (error) {
                  console.error('Error removing snapshot listener:', error);
                  resolve(data.text); // Still resolve even if listener removal fails
                }
              } else if (data.status === 'error') {
                try {
                  if (callbackId) {
                    await FirebaseFirestore.removeSnapshotListener({
                      callbackId
                    });
                  }
                  reject(new Error(data.error || 'CV parsing failed'));
                } catch (error) {
                  console.error('Error removing snapshot listener:', error);
                  reject(new Error(data.error || 'CV parsing failed'));
                }
              }
            }
          }
        ).then(id => {
          callbackId = id;
        }).catch(error => {
          console.error('Error setting up snapshot listener:', error);
          reject(error);
        });
      });

      // Structure the CV using OpenAI
      const structuredCV = await OpenAIService.structureCV(rawText);
      return structuredCV;
    } catch (error) {
      console.error('Error parsing CV:', error);
      throw error;
    }
  }
}

export default CVParserService;
