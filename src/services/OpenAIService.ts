// Type definitions
export type JobDescriptionSchema = {
  title: string;
  company: string;
  location: string;
  employmentType: string;
  experienceLevel: string;
  skills: string[];
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  salary?: {
    min: number;
    max: number;
    currency: string;
    period: string;
  };
};

export type CVSchema = {
  personalInfo: {
    name: string;
    email?: string;
    phone?: string;
    location?: string;
    summary?: string;
  };
  experience: Array<{
    company: string;
    title: string;
    location?: string;
    startDate: string;
    endDate?: string;
    current?: boolean;
    highlights: string[];
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field: string;
    graduationDate?: string;
    gpa?: number;
  }>;
  skills: Array<{
    category: string;
    items: string[];
  }>;
  certifications?: Array<{
    name: string;
    issuer: string;
    date?: string;
  }>;
  languages?: Array<{
    language: string;
    proficiency: string;
  }>;
};

// Schema definitions as objects for use in prompts
export const JobDescriptionSchemaObj = {
  title: "Job title",
  company: "Company name",
  location: "Job location",
  employmentType: "Full-time/Part-time/Contract",
  experienceLevel: "Entry/Mid/Senior level",
  skills: ["Required skill 1", "Required skill 2"],
  responsibilities: ["Responsibility 1", "Responsibility 2"],
  requirements: ["Requirement 1", "Requirement 2"],
  benefits: ["Benefit 1", "Benefit 2"],
  salary: {
    min: "minimum salary (number)",
    max: "maximum salary (number)",
    currency: "USD/EUR/etc",
    period: "yearly/monthly"
  }
} as const;

export const CVSchemaObj = {
  personalInfo: {
    name: "Full name",
    email: "Email address (if provided)",
    phone: "Phone number (if provided)",
    location: "Location (if provided)",
    summary: "Professional summary/objective"
  },
  experience: [{
    company: "Company name",
    title: "Job title",
    location: "Job location",
    startDate: "Start date (YYYY-MM format)",
    endDate: "End date (YYYY-MM format) or null if current",
    current: "true/false",
    highlights: ["Achievement/responsibility 1", "Achievement/responsibility 2"]
  }],
  education: [{
    institution: "School/University name",
    degree: "Degree type (e.g., Bachelor's, Master's)",
    field: "Field of study",
    graduationDate: "YYYY-MM format",
    gpa: "GPA number if provided"
  }],
  skills: [{
    category: "Skill category (e.g., Programming Languages, Tools)",
    items: ["Skill 1", "Skill 2"]
  }],
  certifications: [{
    name: "Certification name",
    issuer: "Issuing organization",
    date: "YYYY-MM format"
  }],
  languages: [{
    language: "Language name",
    proficiency: "Proficiency level"
  }]
} as const;

export class OpenAIService {
  private static async getApiKey(): Promise<string> {
    const key = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    if (!key) {
      throw new Error('OpenAI API key not found in environment variables');
    }
    return key;
  }

  static async structureJobDescription(text: string): Promise<JobDescriptionSchema> {
    try {
      const apiKey = await this.getApiKey();
      
      const prompt = `Please analyze this job description and structure it according to the following json schema:
${JSON.stringify(JobDescriptionSchemaObj, null, 2)}

If any field is not found in the text, omit it from the response. For the salary, only include it if specific numbers are mentioned.

Job Description:
${text}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{
            role: 'user',
            content: prompt
          }],
          temperature: 0.3,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${error}`);
      }

      const result = await response.json();
      const structuredData = JSON.parse(result.choices[0].message.content);
      
      return structuredData;
    } catch (error) {
      console.error('Error structuring job description:', error);
      throw error;
    }
  }

  static async structureCV(text: string): Promise<CVSchema> {
    try {
      const apiKey = await this.getApiKey();
      
      const prompt = `Please analyze this CV/resume and structure it according to the following json schema:
${JSON.stringify(CVSchemaObj, null, 2)}

If any field is not found in the text, omit it from the response. Try to categorize skills into logical groups.

CV Text:
${text}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{
            role: 'user',
            content: prompt
          }],
          temperature: 0.3,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${error}`);
      }

      const result = await response.json();
      const structuredData = JSON.parse(result.choices[0].message.content);
      
      return structuredData;
    } catch (error) {
      console.error('Error structuring CV:', error);
      throw error;
    }
  }
}