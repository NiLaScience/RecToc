import { v4 as uuidv4 } from 'uuid';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { FirebaseStorage } from '@capacitor-firebase/storage';
import { FirebaseFirestore } from '@capacitor-firebase/firestore';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import CloudFunctionService from './CloudFunctionService';
import type { CVSchema } from '../types/user';
import type { JobDescription, EmploymentType, ExperienceLevel, SalaryPeriod } from '../types/job_opening';

// Define our Gemini schema type
interface GeminiSchema {
  type: string;
  properties: Record<string, any>;
  required?: string[];
}

// Define the schema for PDF extraction
const pdfExtractionSchema: GeminiSchema = {
  type: "object",
  properties: {
    raw_text: {
      type: "string",
      description: "The raw text content extracted from the PDF"
    }
  },
  required: ["raw_text"]
};

// Define CV parsing schema - matches CVSchema type
const cvParsingSchema: GeminiSchema = {
  type: "object",
  properties: {
    personalInfo: {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        location: { type: "string" },
        summary: { type: "string" }
      },
      required: ["name"]
    },
    experience: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company: { type: "string" },
          title: { type: "string" },
          location: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          current: { type: "boolean" },
          highlights: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["company", "title", "startDate", "highlights"]
      }
    },
    education: {
      type: "array",
      items: {
        type: "object",
        properties: {
          institution: { type: "string" },
          degree: { type: "string" },
          field: { type: "string" },
          graduationDate: { type: "string" },
          gpa: { type: "number" }
        },
        required: ["institution", "degree", "field"]
      }
    },
    skills: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string" },
          items: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["category", "items"]
      }
    },
    certifications: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          issuer: { type: "string" },
          date: { type: "string" }
        },
        required: ["name", "issuer"]
      }
    },
    languages: {
      type: "array",
      items: {
        type: "object",
        properties: {
          language: { type: "string" },
          proficiency: { type: "string" }
        },
        required: ["language", "proficiency"]
      }
    }
  },
  required: ["personalInfo"]
};

// Define job description parsing schema - matches JobDescription type
const jobParsingSchema: GeminiSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    company: { type: "string" },
    location: { type: "string" },
    employmentType: { 
      type: "string",
      enum: ["full-time", "part-time", "contract", "internship", "freelance"]
    },
    experienceLevel: {
      type: "string",
      enum: ["entry", "mid", "senior", "lead", "executive"]
    },
    responsibilities: {
      type: "array",
      items: { type: "string" }
    },
    requirements: {
      type: "array",
      items: { type: "string" }
    },
    skills: {
      type: "array",
      items: { type: "string" }
    },
    benefits: {
      type: "array",
      items: { type: "string" }
    },
    salary: {
      type: "object",
      properties: {
        min: { type: "number" },
        max: { type: "number" },
        currency: { type: "string" },
        period: {
          type: "string",
          enum: ["yearly", "monthly", "weekly", "hourly"]
        }
      },
      required: ["min", "max", "currency", "period"]
    }
  },
  required: ["title"]
};

export class ParserService {
  constructor() {}

  private async fileToBase64(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    // Ensure we're sending raw base64 without data URL prefix
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return base64;
  }

  static async extractTextFromPDF(pdfBase64: string): Promise<string> {
    console.log('Sending PDF data to Gemini, length:', pdfBase64.length);
    const response = await CloudFunctionService.callFunction('callGeminiAPI', {
      payload: {
        contents: [{
          role: "user",
          parts: [{
            inlineData: {
              data: pdfBase64,
              mimeType: "application/pdf"
            }
          }, {
            text: "Extract all text from this document. Return the raw text only, no markdown formatting."
          }]
        }],
        schema: pdfExtractionSchema
      }
    });

    if (!response.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('No text extracted from PDF');
    }

    // Clean any markdown formatting from the extracted text
    const text = response.candidates[0].content.parts[0].text
      .replace(/\*\*/g, '')  // Remove bold markers
      .replace(/\*/g, '')    // Remove italic markers
      .replace(/#{1,6} /g, '') // Remove heading markers
      .replace(/\n\s*[-*+] /g, '\n') // Remove list markers
      .trim();

    return text;
  }

  static async parseTextToCV(text: string): Promise<CVSchema> {
    console.log('Starting CV parsing...');
    
    const response = await CloudFunctionService.callFunction('callGeminiAPI', {
      payload: {
        contents: [{
          role: "user",
          parts: [{
            text
          }, {
            text: `You are a CV parser. Parse this CV text into a structured JSON format.

The CV text contains standard sections like EDUCATION, EXPERIENCE, etc.
Extract the information exactly as written and return it in this JSON structure:

{
  "personalInfo": {
    "name": "Full name from the CV",
    "email": "Email if present",
    "phone": "Phone if present",
    "location": "Location if present"
  },
  "experience": [
    {
      "company": "Company name",
      "title": "Job title",
      "startDate": "Start date",
      "endDate": "End date if not current",
      "current": true/false,
      "highlights": ["Achievement 1", "Achievement 2"]
    }
  ],
  "education": [
    {
      "institution": "School name",
      "degree": "Degree name",
      "field": "Field of study",
      "graduationDate": "Graduation date"
    }
  ]
}

Important:
1. Keep all text exactly as written in the CV
2. Include all experiences and education entries
3. Preserve dates exactly as they appear
4. Return valid JSON only, no markdown formatting`
          }]
        }],
        schema: cvParsingSchema
      }
    });

    console.log('Received response from Gemini');

    if (!response.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.error('No content in Gemini response');
      throw new Error('Failed to get parsing result from Gemini');
    }

    const rawResponse = response.candidates[0].content.parts[0].text;
    console.log('Raw Gemini response:', rawResponse);

    try {
      // Clean the response text of any markdown formatting
      const cleanedText = rawResponse
        .replace(/```json\n?/, '')
        .replace(/```javascript\n?/, '')
        .replace(/```typescript\n?/, '')
        .replace(/\n?```$/, '')
        .trim();

      console.log('Cleaned response text:', cleanedText);

      const parsed = JSON.parse(cleanedText);
      
      // Validate the parsed result
      if (!parsed.personalInfo?.name) {
        console.error('Missing name in parsed result:', parsed);
        throw new Error('Could not extract name from CV');
      }

      if (!Array.isArray(parsed.experience)) {
        console.error('Experience is not an array:', parsed);
        throw new Error('Could not parse experience section');
      }

      if (!Array.isArray(parsed.education)) {
        console.error('Education is not an array:', parsed);
        throw new Error('Could not parse education section');
      }

      return parsed;
    } catch (error) {
      console.error('CV Parsing error:', error);
      console.error('Raw text from CV:', text);
      console.error('Raw response from Gemini:', rawResponse);
      throw new Error('Could not parse CV properly. Please try again or contact support if the issue persists.');
    }
  }

  static async parseJobDescription(text: string): Promise<JobDescription> {
    console.log('Starting job description parsing...');
    
    const response = await CloudFunctionService.callFunction('callGeminiAPI', {
      payload: {
        contents: [{
          role: "user",
          parts: [{
            text
          }, {
            text: `You are a job description parser. Parse this text into a structured JSON format.

Look for these key sections:
- Job title (usually after "role as:" or similar phrases)
- Company name (usually at the start or in the header)
- Location (usually near the title)
- Employment type (look for terms like "intern", "full-time", etc.)
- Duration/timing information
- Sections like "Your Mission", "Your Profile", "Your Benefits", etc.

Return a JSON object with these fields:
{
  "title": "Job title exactly as written",
  "company": "Company name",
  "location": "Job location",
  "employmentType": "full-time/part-time/contract/internship",
  "experienceLevel": "entry/mid/senior/lead/executive",
  "responsibilities": [
    "Each responsibility as a separate item",
    "Break down paragraphs into bullet points"
  ],
  "requirements": [
    "Each requirement/qualification as a separate item",
    "Include education, experience, skills requirements"
  ],
  "skills": [
    "Specific technical or soft skills required",
    "Include language requirements, tools, etc."
  ],
  "benefits": [
    "Each benefit as a separate item"
  ]
}

Important:
1. Keep the exact job title as written in the text
2. For internships, use "internship" as employmentType
3. For entry-level/student roles, use "entry" as experienceLevel
4. Split paragraphs into clear, concise bullet points
5. Return valid JSON only, no markdown
6. Include salary information if specified in the text`
          }]
        }],
        schema: jobParsingSchema
      }
    });

    console.log('Received response from Gemini');

    if (!response.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.error('No content in Gemini response');
      throw new Error('Failed to get parsing result from Gemini');
    }

    const rawResponse = response.candidates[0].content.parts[0].text;
    console.log('Raw Gemini response:', rawResponse);

    try {
      // Clean the response text of any markdown formatting
      const cleanedText = rawResponse
        .replace(/```json\n?/, '')
        .replace(/```javascript\n?/, '')
        .replace(/```typescript\n?/, '')
        .replace(/\n?```$/, '')
        .trim();

      console.log('Cleaned response text:', cleanedText);

      const parsed = JSON.parse(cleanedText);
      
      // Validate the parsed result
      if (!parsed.title) {
        console.error('Missing title in parsed result:', parsed);
        throw new Error('Could not extract job title');
      }

      // Clean and normalize fields
      parsed.title = parsed.title.trim();
      parsed.company = parsed.company?.trim() || 'Redalpine';
      parsed.location = parsed.location?.trim() || 'Zurich';
      parsed.employmentType = parsed.employmentType?.toLowerCase() || 'internship';
      parsed.experienceLevel = parsed.experienceLevel?.toLowerCase() || 'entry';
      
      // Ensure arrays are properly formatted
      parsed.responsibilities = Array.isArray(parsed.responsibilities) ? parsed.responsibilities : [];
      parsed.requirements = Array.isArray(parsed.requirements) ? parsed.requirements : [];
      parsed.skills = Array.isArray(parsed.skills) ? parsed.skills : [];
      parsed.benefits = Array.isArray(parsed.benefits) ? parsed.benefits : [];

      return parsed;
    } catch (error) {
      console.error('Job Description Parsing error:', error);
      console.error('Raw text from job description:', text);
      console.error('Raw response from Gemini:', rawResponse);
      throw new Error('Could not parse job description properly. Please try again or contact support if the issue persists.');
    }
  }

  async uploadAndParsePDF(
    file: File,
    storageFolder: string
  ): Promise<CVSchema | JobDescription> {
    try {
      // Check authentication first
      const result = await FirebaseAuthentication.getCurrentUser();
      if (!result.user) {
        throw new Error('User must be authenticated to parse documents');
      }

      const isCV = storageFolder === 'cvs-to-parse';
      const docId = uuidv4();
      const storagePath = isCV 
        ? `users/${result.user.uid}/cv-uploads/${docId}.pdf`
        : `jobs/${result.user.uid}/job-descriptions/${docId}.pdf`;

      // First extract text from PDF
      const pdfBase64 = await this.fileToBase64(file);
      const extractedText = await ParserService.extractTextFromPDF(pdfBase64);
      console.log('Extracted text:', extractedText);

      // Then parse the text according to the schema
      let parsed: CVSchema | JobDescription;
      try {
        if (isCV) {
          parsed = await ParserService.parseTextToCV(extractedText);
        } else {
          parsed = await ParserService.parseJobDescription(extractedText);
        }
      } catch (parseError) {
        console.error('Parsing error:', parseError);
        console.error('Extracted text:', extractedText);
        if (isCV) {
          throw new Error('Failed to parse CV. Please ensure your CV is in a standard format and try again.');
        } else {
          throw new Error('Failed to parse job description. Please ensure the file contains valid job details.');
        }
      }

      // Store the parsed result
      const firestoreCollection = isCV ? 'parsedCVs' : 'parsedPDFs';
      await FirebaseFirestore.setDocument({
        reference: `${firestoreCollection}/${docId}`,
        data: {
          parsed,
          raw_text: extractedText,
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
