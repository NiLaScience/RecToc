import { v4 as uuidv4 } from 'uuid';
import OpenAIService, { JobDescriptionSchema } from './OpenAIService';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { FirebaseStorage } from '@capacitor-firebase/storage';
import { FirebaseFirestore } from '@capacitor-firebase/firestore';
import { Filesystem, Directory } from '@capacitor/filesystem';

class PDFParserService {
  static async parsePDF(pdfFile: File): Promise<JobDescriptionSchema> {
    try {
      // Check authentication first
      const result = await FirebaseAuthentication.getCurrentUser();
      if (!result.user) {
        throw new Error('User must be authenticated to parse PDFs');
      }

      const jobId = uuidv4();
      const storagePath = `pdfs-to-parse/${jobId}.pdf`;
      let downloadURL: string;

      // Convert File to base64 for filesystem
      const blob = await pdfFile.arrayBuffer();
      const tempFileName = `${jobId}.pdf`;
      
      // Write to filesystem
      await Filesystem.writeFile({
        path: tempFileName,
        data: Buffer.from(blob).toString('base64'),
        directory: Directory.Cache
      });

      // Get the file URI
      const fileInfo = await Filesystem.getUri({
        path: tempFileName,
        directory: Directory.Cache
      });

      // Upload to Firebase Storage
      await new Promise<void>((resolve, reject) => {
        FirebaseStorage.uploadFile(
          {
            path: storagePath,
            uri: fileInfo.uri,
            metadata: {
              contentType: 'application/pdf'
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
      
      // Get download URL
      const urlResult = await FirebaseStorage.getDownloadUrl({
        path: storagePath
      });
      downloadURL = urlResult.downloadUrl;

      // Clean up temp file
      await Filesystem.deleteFile({
        path: tempFileName,
        directory: Directory.Cache
      });

      // Wait for the parsed result in Firestore
      const rawText = await new Promise<string>((resolve, reject) => {
        let callbackId: string;

        FirebaseFirestore.addDocumentSnapshotListener(
          {
            reference: `parsedPDFs/${jobId}`
          },
          (event, error) => {
            if (error) {
              reject(error);
              return;
            }
            
            if (event?.snapshot?.data) {
              const data = event.snapshot.data;
              if (data.status === 'completed' && data.text) {
                if (callbackId) {
                  FirebaseFirestore.removeSnapshotListener({
                    callbackId
                  }).catch(console.error);
                }
                resolve(data.text);
              } else if (data.status === 'error') {
                if (callbackId) {
                  FirebaseFirestore.removeSnapshotListener({
                    callbackId
                  }).catch(console.error);
                }
                reject(new Error(data.error || 'PDF parsing failed'));
              }
            }
          }
        ).then(id => {
          callbackId = id;
        }).catch(reject);

        // Set a timeout for the parsing
        setTimeout(() => {
          if (callbackId) {
            FirebaseFirestore.removeSnapshotListener({
              callbackId
            }).catch(console.error);
          }
          reject(new Error('PDF parsing timed out. Please try again.'));
        }, 30000); // 30 second timeout
      });

      // Structure the raw text using OpenAI
      const structuredData = await OpenAIService.structureJobDescription(rawText);
      return structuredData;

    } catch (error) {
      console.error('Error parsing PDF:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unknown error occurred while parsing the PDF');
    }
  }
}

export default PDFParserService; 