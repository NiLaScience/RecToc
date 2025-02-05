interface JobDescriptionSchema {
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
}

class OpenAIService {
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
{
  "title": "Job title",
  "company": "Company name",
  "location": "Job location",
  "employmentType": "Full-time/Part-time/Contract",
  "experienceLevel": "Entry/Mid/Senior level",
  "skills": ["Required skill 1", "Required skill 2"],
  "responsibilities": ["Responsibility 1", "Responsibility 2"],
  "requirements": ["Requirement 1", "Requirement 2"],
  "benefits": ["Benefit 1", "Benefit 2"],
  "salary": {
    "min": minimum salary (number),
    "max": maximum salary (number),
    "currency": "USD/EUR/etc",
    "period": "yearly/monthly"
  }
}

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
}

export type { JobDescriptionSchema };
export default OpenAIService; 