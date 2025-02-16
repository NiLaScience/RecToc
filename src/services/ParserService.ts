import { v4 as uuidv4 } from 'uuid';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { FirebaseStorage } from '@capacitor-firebase/storage';
import { FirebaseFirestore } from '@capacitor-firebase/firestore';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import CloudFunctionService from './CloudFunctionService';
import type { CVSchema, JobDescriptionSchema } from '../types/parser';
import { CVSchemaObj, JobDescriptionSchemaObj } from '../types/parser';

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
          resolve(base64);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private async parseWithSchema<T>(content: string | File, schema: typeof CVSchemaObj | typeof JobDescriptionSchemaObj, parseInstructions: string): Promise<T> {
    try {
      // First get the text content
      let extractedText: string;
      if (content instanceof File) {
        const base64 = await this.fileToBase64(content);
        
        // Call Cloud Function to extract text from PDF
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
                  data: base64,
                  mimeType: "application/pdf",
                },
              }, {
                text: 'Extract all text content from this document and maintain its structure. Include all text content without any formatting or interpretation.',
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
              text: `${parseInstructions}\n\nSchema:\n${JSON.stringify(schema, null, 2)}\n\nDocument text:\n${extractedText}`,
            }],
          }],
        },
      });

      const response = parseResult.candidates[0].content.parts[0].text;
      const cleanedResponse = cleanJsonResponse(response);
      return JSON.parse(cleanedResponse);
    } catch (error) {
      console.error('Error parsing document:', error);
      throw error;
    }
  }

  async parseJobDescription(content: string | File): Promise<JobDescriptionSchema> {
    const instructions = `This is a job description. Please analyze it carefully and structure it according to the schema. Return ONLY a valid JSON object matching the schema exactly, with no additional text or markdown formatting.

Key points to extract:
- Title should be the main job title/role
- Company name and location should be extracted if mentioned
- Employment type (e.g., Full-time, Part-time, Contract)
- Experience level (e.g., Entry, Mid, Senior)
- Skills should be a list of technical and soft skills required
- Responsibilities should be key duties and tasks
- Requirements should be must-have qualifications
- Benefits should include perks and compensation details
- For salary, ONLY include if specific numbers are mentioned with currency and period (e.g., "$100,000-$120,000 USD/year")

Rules:
1. If any field is not explicitly mentioned in the text, omit it from the JSON response
2. Do not add any explanatory text or markdown formatting
3. Ensure the response is a single, valid JSON object
4. All array fields (skills, responsibilities, etc.) should be string arrays
5. Follow the schema types exactly (strings for text, arrays for lists, etc.)`;

    return this.parseWithSchema<JobDescriptionSchema>(content, JobDescriptionSchemaObj, instructions);
  }

  async parseCV(content: string | File): Promise<CVSchema> {
    const instructions = `This is a CV/resume. Please analyze it carefully and structure it according to the schema. Return ONLY a valid JSON object matching the schema exactly, with no additional text or markdown formatting.

Key points to extract:
- Personal info should include name and contact details if provided
- Experience entries should be in reverse chronological order
- For each experience:
  * Extract company name, title, and dates
  * Convert dates to YYYY-MM format
  * Highlight key achievements and responsibilities
- Education should include degree, field, and institution
- Skills should be grouped into logical categories like:
  * Programming Languages
  * Frameworks & Tools
  * Soft Skills
  * Domain Knowledge
- Languages should include proficiency level if mentioned
- Certifications should include issuing organization and date

Rules:
1. If any field is not explicitly mentioned in the text, omit it from the JSON response
2. Do not add any explanatory text or markdown formatting
3. Ensure the response is a single, valid JSON object
4. All array fields should contain properly structured objects as per schema
5. Dates must be in YYYY-MM format (use YYYY-01 if only year is provided)
6. Follow the schema types exactly (strings for text, arrays for lists, objects for structured data)`;

    return this.parseWithSchema<CVSchema>(content, CVSchemaObj, instructions);
  }

  // Firebase integration methods
  async uploadAndParsePDF<T extends JobDescriptionSchema | CVSchema>(
    file: File,
    collection: 'parsedPDFs' | 'parsedCVs'
  ): Promise<T> {
    try {
      // Check authentication first
      const result = await FirebaseAuthentication.getCurrentUser();
      if (!result.user) {
        throw new Error('User must be authenticated to parse documents');
      }

      const docId = uuidv4();
      const storagePath = `${collection}/${docId}.pdf`;

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

      // Parse the file based on collection type
      const parsed = collection === 'parsedCVs' 
        ? await this.parseCV(file)
        : await this.parseJobDescription(file);

      // Store the parsed result
      await FirebaseFirestore.setDocument({
        reference: `${collection}/${docId}`,
        data: {
          parsed,
          status: 'completed',
          createdAt: new Date().toISOString(),
          userId: result.user.uid
        }
      });

      return parsed as T;
    } catch (error) {
      console.error('Error uploading and parsing document:', error);
      throw error;
    }
  }
}
