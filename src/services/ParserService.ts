import { v4 as uuidv4 } from 'uuid';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { FirebaseStorage } from '@capacitor-firebase/storage';
import { FirebaseFirestore } from '@capacitor-firebase/firestore';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import CloudFunctionService from './CloudFunctionService';
import type { CVSchema } from '../types/user';
import { CVSchemaObj } from '../types/user';
import type { JobDescription } from '../types/job_opening';
import { JobDescriptionSchemaObj } from '../types/job_opening';

function cleanJsonResponse(text: string): string {
  // Remove markdown code block markers and any language identifier
  text = text.replace(/```(?:json)?\n/g, '').replace(/\n```$/g, '');
  // Remove any leading/trailing whitespace
  text = text.trim();
  return text;
}

export class ParserService {
  constructor() {}

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // Remove data URL prefix (e.g., "data:application/pdf;base64,")
          const base64 = reader.result.split(',')[1];
          // Check if the base64 string is too large (Gemini has a 4MB limit)
          const sizeInBytes = Math.ceil((base64.length * 3) / 4);
          if (sizeInBytes > 4 * 1024 * 1024) {
            reject(new Error('PDF file is too large. Maximum size is 4MB.'));
            return;
          }
          resolve(base64);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private async parseWithSchema<T extends JobDescription | CVSchema>(
    content: string | File,
    schema: typeof CVSchemaObj | typeof JobDescriptionSchemaObj,
    instructions?: string
  ): Promise<T> {
    try {
      let extractedText: string;
      if (content instanceof File) {
        // Get auth result first
        const authResult = await FirebaseAuthentication.getCurrentUser();
        if (!authResult.user) {
          throw new Error('User must be authenticated to parse documents');
        }

        // Upload the PDF first
        const docId = uuidv4();
        const isCV = schema === CVSchemaObj;
        const storagePath = isCV 
          ? `users/${authResult.user.uid}/cv-uploads/${docId}.pdf`
          : `jobs/${authResult.user.uid}/job-descriptions/${docId}.pdf`;

        // Upload to Firebase Storage
        await new Promise<void>((resolve, reject) => {
          FirebaseStorage.uploadFile({
            path: storagePath,
            blob: content,
            metadata: { contentType: 'application/pdf' }
          }, (progress, error) => {
            if (error) reject(error);
            if (progress?.completed) resolve();
          });
        });

        // Get the download URL
        const downloadUrlResult = await FirebaseStorage.getDownloadUrl({
          path: storagePath
        });
        
        // Call Cloud Function to extract text from PDF using the URL
        const extractionResult = await CloudFunctionService.callFunction<
          {
            payload: {
              contents: Array<{
                parts: Array<{
                  inlineData?: {
                    data: string;
                    mimeType: string;
                  };
                  text?: string;
                }>;
              }>;
            };
          },
          {
            candidates: Array<{
              content: {
                parts: Array<{
                  text: string;
                }>;
              };
            }>;
          }
        >('callGeminiAPI', {
          payload: {
            contents: [{
              parts: [{
                inlineData: {
                  data: downloadUrlResult.downloadUrl,
                  mimeType: "application/pdf",
                },
              }, {
                text: 'Extract all text content from this document. Include all text content without any formatting or interpretation.',
              }],
            }],
          },
        });
        
        extractedText = extractionResult.candidates[0].content.parts[0].text;
      } else {
        extractedText = content;
      }

      // Then parse the text according to the schema
      const parseResult = await CloudFunctionService.callFunction<
        {
          payload: {
            contents: Array<{
              parts: Array<{
                text: string;
              }>;
            }>;
          };
        },
        {
          candidates: Array<{
            content: {
              parts: Array<{
                text: string;
              }>;
            };
          }>;
        }
      >('callGeminiAPI', {
        payload: {
          contents: [{
            parts: [{
              text: `${instructions}\n\nSchema:\n${JSON.stringify(schema, null, 2)}\n\nDocument text:\n${extractedText}`,
            }],
          }],
        },
      });

      const response = parseResult.candidates[0].content.parts[0].text;
      const cleanedResponse = cleanJsonResponse(response);
      const parsed = JSON.parse(cleanedResponse);
      
      // Validate that the parsed result matches the expected type
      if (schema === JobDescriptionSchemaObj) {
        return parsed as JobDescription as T;
      } else {
        return parsed as CVSchema as T;
      }
    } catch (error) {
      console.error('Error parsing document:', error);
      throw error;
    }
  }

  async parseJobDescription(content: string | File): Promise<JobDescription> {
    const instructions = `
      Parse the text into a job description with the following schema.
      Return ONLY the JSON object, no markdown formatting or explanation.
      
      If a field is not found in the text, omit it from the output.
      Do not make up or infer missing information.
    `;
    
    return this.parseWithSchema<JobDescription>(content, JobDescriptionSchemaObj, instructions);
  }

  async parseCV(content: string | File): Promise<CVSchema> {
    const instructions = `
      Parse the text into a CV/resume with the following schema.
      Return ONLY the JSON object, no markdown formatting or explanation.
      
      If a field is not found in the text, omit it from the output.
      Do not make up or infer missing information.
      Convert all dates to YYYY-MM format (use YYYY-01 if only year is provided).
    `;

    return this.parseWithSchema<CVSchema>(content, CVSchemaObj, instructions);
  }

  // Firebase integration methods
  async uploadAndParsePDF<T extends JobDescription | CVSchema>(
    file: File,
    storageFolder: string,
    instructions?: string
  ): Promise<T> {
    try {
      // Check authentication first
      const result = await FirebaseAuthentication.getCurrentUser();
      if (!result.user) {
        throw new Error('User must be authenticated to parse documents');
      }

      const docId = uuidv4();
      const isCV = storageFolder === 'cvs-to-parse';
      const storagePath = isCV 
        ? `users/${result.user.uid}/cv-uploads/${docId}.pdf`
        : `jobs/${result.user.uid}/job-descriptions/${docId}.pdf`;

      // Upload file to Firebase Storage
      if (Capacitor.isNativePlatform()) {
        // For native platforms, we need to write to filesystem first
        const blob = await file.arrayBuffer();
        await Filesystem.writeFile({
          path: `${docId}.pdf`,
          data: Buffer.from(blob).toString('base64'),
          directory: Directory.Cache
        });

        // Get the file URI
        const fileInfo = await Filesystem.getUri({
          path: `${docId}.pdf`,
          directory: Directory.Cache
        });

        // Upload to Firebase Storage
        await new Promise<void>((resolve, reject) => {
          FirebaseStorage.uploadFile({
            path: storagePath,
            uri: fileInfo.uri,
            metadata: { contentType: 'application/pdf' }
          }, (progress, error) => {
            if (error) reject(error);
            if (progress?.completed) resolve();
          });
        });

        // Clean up temp file
        await Filesystem.deleteFile({
          path: `${docId}.pdf`,
          directory: Directory.Cache
        });
      } else {
        // For web, upload directly
        await new Promise<void>((resolve, reject) => {
          FirebaseStorage.uploadFile({
            path: storagePath,
            blob: file,
            metadata: { contentType: 'application/pdf' }
          }, (progress, error) => {
            if (error) reject(error);
            if (progress?.completed) resolve();
          });
        });
      }

      // Get the download URL for the PDF
      const downloadUrlResult = await FirebaseStorage.getDownloadUrl({
        path: storagePath
      });

      // Parse the file based on collection type and ensure correct type
      let parsed: T;
      const firestoreCollection = isCV ? 'parsedCVs' : 'parsedPDFs';
      
      if (isCV) {
        parsed = await this.parseCV(file) as T;
      } else {
        parsed = await this.parseJobDescription(file) as T;
      }

      // Store the parsed result in the correct collection
      await FirebaseFirestore.setDocument({
        reference: `${firestoreCollection}/${docId}`,
        data: {
          parsed,
          pdfUrl: downloadUrlResult.downloadUrl,
          status: 'completed',
          createdAt: new Date().toISOString(),
          userId: result.user.uid
        }
      });

      return parsed;
    } catch (error) {
      console.error('Error uploading and parsing document:', error);
      throw error;
    }
  }
}

export default new ParserService();
