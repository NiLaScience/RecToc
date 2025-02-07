import { GoogleGenerativeAI } from "@google/generative-ai";
import type { CVSchema, JobDescriptionSchema } from './OpenAIService';
import { CVSchemaObj, JobDescriptionSchemaObj } from './OpenAIService';

function cleanJsonResponse(text: string): string {
  // Remove markdown code block markers and any language identifier
  text = text.replace(/```(?:json)?\n/g, '').replace(/\n```$/g, '');
  // Remove any leading/trailing whitespace
  text = text.trim();
  return text;
}

export class GeminiParserService {
  private genAI: any;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'models/gemini-1.5-flash' });
  }

  private async extractTextFromBase64PDF(base64String: string): Promise<string> {
    const extractionResult = await this.model.generateContent([
      {
        inlineData: {
          data: base64String,
          mimeType: "application/pdf",
        },
      },
      'Extract all text content from this document and maintain its structure. Include all text content without any formatting or interpretation.',
    ]);

    return extractionResult.response.text();
  }

  async parseWithSchema<T>(base64String: string, schema: typeof CVSchemaObj | typeof JobDescriptionSchemaObj, parseInstructions: string): Promise<T> {
    try {
      const extractedText = await this.extractTextFromBase64PDF(base64String);

      const structuringPrompt = `Analyze this text and structure it according to the schema below. Return ONLY a JSON object, with no markdown formatting or additional text.

Schema:
${JSON.stringify(schema, null, 2)}

${parseInstructions}

Text Content:
${extractedText}

Important: Return ONLY the JSON object, no markdown, no explanations.`;

      const structuringResult = await this.model.generateContent(structuringPrompt);
      const responseText = structuringResult.response.text();
      const cleanedJson = cleanJsonResponse(responseText);
      
      try {
        const structuredData = JSON.parse(cleanedJson) as T;
        return structuredData;
      } catch (parseError) {
        console.error('Failed to parse JSON response. Raw response:', responseText);
        throw parseError;
      }
    } catch (error) {
      console.error('Error processing PDF:', error);
      throw error;
    }
  }

  async parseCV(base64String: string): Promise<CVSchema> {
    const instructions = 'This is a CV/resume. Try to categorize skills into logical groups. If any field is not found in the text, omit it from the response.';
    return this.parseWithSchema<CVSchema>(base64String, CVSchemaObj, instructions);
  }

  async parseJobDescription(base64String: string): Promise<JobDescriptionSchema> {
    const instructions = 'This is a job description. For the salary, only include it if specific numbers are mentioned. If any field is not found in the text, omit it from the response.';
    return this.parseWithSchema<JobDescriptionSchema>(base64String, JobDescriptionSchemaObj, instructions);
  }
}
