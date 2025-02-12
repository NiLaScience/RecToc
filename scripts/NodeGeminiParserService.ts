import { GoogleGenerativeAI } from "@google/generative-ai";
import type { JobDescriptionSchema } from '../src/services/OpenAIService';
import { JobDescriptionSchemaObj } from '../src/services/OpenAIService';

function cleanJsonResponse(text: string): string {
  // Remove markdown code block markers and any language identifier
  text = text.replace(/```(?:json)?\n/g, '').replace(/\n```$/g, '');
  // Remove any leading/trailing whitespace
  text = text.trim();
  return text;
}

class NodeGeminiParserService {
  private genAI: any;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.0-pro' });
  }

  async parseJobDescription(text: string): Promise<JobDescriptionSchema> {
    try {
      const structuringPrompt = `Analyze this job description and structure it according to the schema below. Return ONLY a JSON object, with no markdown formatting or additional text.

Schema:
${JSON.stringify(JobDescriptionSchemaObj, null, 2)}

Instructions:
This is a job description. For the salary, only include it if specific numbers are mentioned. If any field is not found in the text, omit it from the response.

Text Content:
${text}

Important: Return ONLY the JSON object, no markdown, no explanations.`;

      const structuringResult = await this.model.generateContent(structuringPrompt);
      const responseText = structuringResult.response.text();
      const cleanedJson = cleanJsonResponse(responseText);
      
      try {
        const structuredData = JSON.parse(cleanedJson) as JobDescriptionSchema;
        return structuredData;
      } catch (parseError) {
        console.error('Failed to parse JSON response. Raw response:', responseText);
        throw parseError;
      }
    } catch (error) {
      console.error('Error processing job description:', error);
      throw error;
    }
  }
}

module.exports = NodeGeminiParserService; 