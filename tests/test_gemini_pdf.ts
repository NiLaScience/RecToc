const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const dotenv = require('dotenv');
const OpenAIService = require('../src/services/OpenAIService');

// Load environment variables
dotenv.config();

function cleanJsonResponse(text: string): string {
  // Remove markdown code block markers and any language identifier
  text = text.replace(/```(?:json)?\n/g, '').replace(/\n```$/g, '');
  // Remove any leading/trailing whitespace
  text = text.trim();
  return text;
}

class GeminiPDFParser {
  private genAI: any;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'models/gemini-1.5-flash' });
  }

  private async extractTextFromPDF(pdfPath: string): Promise<string> {
    const pdfContent = fs.readFileSync(pdfPath);
    const pdfBase64 = Buffer.from(pdfContent).toString('base64');

    const extractionResult = await this.model.generateContent([
      {
        inlineData: {
          data: pdfBase64,
          mimeType: "application/pdf",
        },
      },
      'Extract all text content from this document and maintain its structure. Include all text content without any formatting or interpretation.',
    ]);

    return extractionResult.response.text();
  }

  async parseWithSchema<T>(pdfPath: string, schema: any, parseInstructions: string): Promise<T> {
    try {
      const extractedText = await this.extractTextFromPDF(pdfPath);

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

  async parseCV(pdfPath: string): Promise<typeof OpenAIService.CVSchema> {
    const instructions = 'This is a CV/resume. Try to categorize skills into logical groups. If any field is not found in the text, omit it from the response.';
    return this.parseWithSchema<typeof OpenAIService.CVSchema>(pdfPath, OpenAIService.CVSchemaObj, instructions);
  }

  async parseJobDescription(pdfPath: string): Promise<typeof OpenAIService.JobDescriptionSchema> {
    const instructions = 'This is a job description. For the salary, only include it if specific numbers are mentioned. If any field is not found in the text, omit it from the response.';
    return this.parseWithSchema<typeof OpenAIService.JobDescriptionSchema>(pdfPath, OpenAIService.JobDescriptionSchemaObj, instructions);
  }
}

async function main(): Promise<void> {
  try {
    // Get PDF path and type from command line arguments
    const [pdfPath, documentType = 'cv'] = process.argv.slice(2);
    
    if (!pdfPath) {
      console.error('Please provide a PDF path as an argument');
      console.error('Usage: ts-node test_gemini_pdf.ts <path-to-pdf> [cv|job]');
      process.exit(1);
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY environment variable is not set');
      process.exit(1);
    }

    const parser = new GeminiPDFParser(process.env.GEMINI_API_KEY);

    console.log(`Processing PDF: ${pdfPath}`);
    let result;
    
    if (documentType === 'job') {
      result = await parser.parseJobDescription(pdfPath);
    } else {
      result = await parser.parseCV(pdfPath);
    }

    console.log('Structured Data:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the script
main();