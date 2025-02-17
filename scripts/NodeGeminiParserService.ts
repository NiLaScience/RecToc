import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { JobDescription } from '../src/types/job_opening';
import { JobDescriptionSchemaObj } from '../src/types/job_opening';

function cleanJsonResponse(text: string): string {
  // Remove markdown code block markers and any language identifier
  text = text.replace(/```(?:json)?\n/g, '').replace(/\n```$/g, '');
  // Remove any leading/trailing whitespace
  text = text.trim();
  return text;
}

function cleanJobDescription(text: string): string {
  return text
    .replace(/\#.*$/gm, '') // Remove hashtag comments and everything after them
    .replace(/Please (?:send|share) .*@.*\.com/gi, '') // Remove email instructions
    .replace(/[^\x20-\x7E\n]/g, '') // Remove non-ASCII characters
    .replace(/\\/g, '') // Remove backslashes
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

export class NodeGeminiParserService {
  private genAI: any;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    
    const schema = {
      type: SchemaType.OBJECT,
      properties: {
        title: {
          type: SchemaType.STRING,
          description: "Job title",
          nullable: false,
        },
        company: {
          type: SchemaType.STRING,
          description: "Company name",
          nullable: false,
        },
        location: {
          type: SchemaType.STRING,
          description: "Job location",
          nullable: false,
        },
        employmentType: {
          type: SchemaType.STRING,
          description: "Full-time/Part-time/Contract",
          nullable: false,
        },
        experienceLevel: {
          type: SchemaType.STRING,
          description: "Entry/Mid/Senior level",
          nullable: false,
        },
        skills: {
          type: SchemaType.ARRAY,
          description: "Required skills",
          items: {
            type: SchemaType.STRING
          },
          nullable: false,
        },
        responsibilities: {
          type: SchemaType.ARRAY,
          description: "Job responsibilities",
          items: {
            type: SchemaType.STRING
          },
          nullable: false,
        },
        requirements: {
          type: SchemaType.ARRAY,
          description: "Job requirements",
          items: {
            type: SchemaType.STRING
          },
          nullable: false,
        },
        benefits: {
          type: SchemaType.ARRAY,
          description: "Job benefits",
          items: {
            type: SchemaType.STRING
          },
          nullable: true,
        },
        salary: {
          type: SchemaType.OBJECT,
          description: "Salary information",
          properties: {
            min: {
              type: SchemaType.NUMBER,
              description: "Minimum salary",
              nullable: true,
            },
            max: {
              type: SchemaType.NUMBER,
              description: "Maximum salary",
              nullable: true,
            },
            currency: {
              type: SchemaType.STRING,
              description: "Salary currency (e.g., USD)",
              nullable: true,
            },
            period: {
              type: SchemaType.STRING,
              description: "Salary period (yearly/monthly)",
              nullable: true,
            }
          },
          nullable: true,
        }
      },
      required: ["title", "company", "location", "employmentType", "experienceLevel", "skills", "responsibilities", "requirements"]
    };

    this.model = this.genAI.getGenerativeModel({
      model: "gemini-1.5-pro",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });
  }

  async parseJobDescription(text: string): Promise<JobDescription> {
    try {
      const prompt = `Parse the following job description into structured data according to this schema:
${JSON.stringify(JobDescriptionSchemaObj, null, 2)}

If any field is not found in the text, omit it from the response. For the salary, only include it if specific numbers are mentioned.

Job Description:
${text}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response.text();
      
      return JSON.parse(response);
    } catch (error) {
      console.log('Failed to parse job description. Raw text:', text);
      throw error;
    }
  }
}

export default new NodeGeminiParserService(); 