import { GoogleGenerativeAI } from "@google/generative-ai";
import type { JobDescriptionSchema } from '../src/services/OpenAIService';
import { JobDescriptionSchemaObj } from '../src/services/OpenAIService';

function cleanJsonResponse(text: string): string {
  // Remove markdown code block markers and any language identifier
  text = text.replace(/```(?:json)?\s*/g, '');
  // Remove any trailing backticks
  text = text.replace(/\s*```\s*$/g, '');
  // Normalize line breaks and whitespace
  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/\n\s+/g, '\n');
  // Remove any non-printable characters
  text = text.replace(/[^\x20-\x7E\n]/g, '');
  // Remove any leading/trailing whitespace
  text = text.trim();
  return text;
}

export class NodeGeminiParserService {
  private genAI: any;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.0-pro' });
  }

  async parseJobDescription(text: string): Promise<JobDescriptionSchema> {
    try {
      const model = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!).getGenerativeModel({ model: "gemini-pro" });

      const structuringPrompt = [
        "Given the following job description text, extract and structure the information into a JSON object with the following fields:",
        "- title: string | null",
        "- company: string | null",
        "- location: string | null",
        "- employmentType: string | null",
        "- experienceLevel: string | null",
        "- skills: string[]",
        "- responsibilities: string[]",
        "- requirements: string[]",
        "- benefits: string[]",
        "- salary: { min: number | null, max: number | null, currency: string | null, period: string | null } | null",
        "",
        "IMPORTANT: Return ONLY the raw JSON object. Do not wrap it in code block markers (```). Do not add any explanations or additional text.",
        "The response should start with { and end with } with no other characters before or after.",
        "Do not use special quotes or characters in the JSON - use only standard ASCII characters.",
        "",
        "Job description text:",
        text
      ].join('\n');

      const result = await model.generateContent(structuringPrompt);
      const response = result.response;
      let jsonText = response.text();
      
      // Remove code block markers if present
      jsonText = jsonText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
      
      // Clean the JSON text before parsing
      const cleanedJson = jsonText
        .replace(/[""]/g, '"') // Replace curly quotes with straight quotes
        .replace(/[']/g, "'") // Replace curly single quotes with straight single quotes
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces
        .replace(/\r\n/g, '\n') // Normalize line endings
        .replace(/[^\x20-\x7E\n]/g, '') // Remove all non-ASCII characters except newlines
        .trim(); // Remove leading/trailing whitespace

      console.log('Attempting to parse JSON:', cleanedJson);
      
      try {
        return JSON.parse(cleanedJson);
      } catch (parseError) {
        // If parsing fails, try to clean the JSON further by removing any problematic characters
        const furtherCleanedJson = cleanedJson
          .replace(/[\u2018\u2019]/g, "'") // Replace smart single quotes
          .replace(/[\u201C\u201D]/g, '"') // Replace smart double quotes
          .replace(/[\u2013\u2014]/g, '-') // Replace em/en dashes
          .replace(/\s+/g, ' ') // Normalize whitespace
          .replace(/\\/g, '\\\\'); // Escape backslashes
        
        console.log('Attempting to parse cleaned JSON:', furtherCleanedJson);
        return JSON.parse(furtherCleanedJson);
      }
    } catch (error) {
      console.log('Failed to parse JSON response. Raw response:', text);
      throw error;
    }
  }
} 