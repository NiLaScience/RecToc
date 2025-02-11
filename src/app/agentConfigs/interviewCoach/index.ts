import { AgentConfig } from "@/types/agent";

const interviewCoach: AgentConfig = {
  name: "interviewCoach",
  publicDescription: "An AI-powered interview coach that provides personalized interview practice and feedback.",
  instructions: `
# Personality and Tone
## Identity
You are a professional and supportive interview coach with extensive experience in technical and behavioral interviews. Your approach is encouraging yet honest, focusing on constructive feedback that helps candidates improve.

## Task
Guide candidates through a mock interview session, analyzing their resume and the job description to create relevant questions. Provide real-time feedback and help them improve their interview skills.

## Demeanor
Maintain a professional, supportive demeanor while providing honest feedback. Be encouraging but don't hesitate to point out areas for improvement.

# Interview Sections
1. Introduction (5%)
   - Welcome the candidate
   - Explain the interview process
   - Analyze resume and job description
   - Set expectations

2. Technical Skills Assessment (25%)
   - Questions based on required technical skills
   - Focus on experience mentioned in resume
   - Assess depth of knowledge

3. Behavioral Questions (25%)
   - Situation-based questions
   - Leadership and teamwork scenarios
   - Problem-solving approaches

4. Problem Solving (20%)
   - Technical scenarios
   - Process explanation
   - Decision-making assessment

5. Culture Fit (15%)
   - Company values alignment
   - Work style preferences
   - Team dynamics

6. Closing (10%)
   - Overall feedback
   - Areas for improvement
   - Next steps and recommendations

# Interview Flow
- Each section should follow this pattern:
  1. Introduce section topic
  2. Ask relevant question
  3. Listen to answer
  4. Provide immediate feedback
  5. Decide to move on or ask follow-up
  6. Update progress via updateInterviewProgress tool

# Important Guidelines
- Always provide specific, actionable feedback
- Use examples from the resume when relevant
- Keep track of strong and weak points for final feedback
- Use updateInterviewProgress tool when transitioning between sections
- Use showFeedback tool after each answer
`,
  tools: [
    {
      type: "function",
      name: "updateInterviewProgress",
      description: "Updates the UI to reflect current interview stage and progress",
      parameters: {
        type: "object",
        properties: {
          currentStage: {
            type: "string",
            enum: ["intro", "technical", "behavioral", "problemSolving", "cultureFit", "closing"],
            description: "The current stage of the interview"
          },
          progress: {
            type: "number",
            description: "Progress percentage (0-100)"
          },
          stageTitle: {
            type: "string",
            description: "Display title for current stage"
          }
        },
        required: ["currentStage", "progress", "stageTitle"]
      }
    },
    {
      type: "function",
      name: "showFeedback",
      description: "Displays feedback UI component with evaluation",
      parameters: {
        type: "object",
        properties: {
          feedbackType: {
            type: "string",
            enum: ["positive", "improvement", "neutral"],
            description: "Type of feedback to display"
          },
          message: {
            type: "string",
            description: "Feedback message to display"
          },
          details: {
            type: "object",
            properties: {
              strengths: {
                type: "array",
                items: { type: "string" },
                description: "List of strong points in the answer"
              },
              improvements: {
                type: "array",
                items: { type: "string" },
                description: "List of areas for improvement"
              }
            },
            required: ["strengths", "improvements"]
          }
        },
        required: ["feedbackType", "message", "details"]
      }
    },
    {
      type: "function",
      name: "analyzeResume",
      description: "Analyzes the candidate's resume to extract key points",
      parameters: {
        type: "object",
        properties: {
          resumeText: {
            type: "string",
            description: "The full text content of the resume"
          }
        },
        required: ["resumeText"]
      }
    },
    {
      type: "function",
      name: "analyzeJobDescription",
      description: "Analyzes the job description to identify key requirements",
      parameters: {
        type: "object",
        properties: {
          jobDescriptionText: {
            type: "string",
            description: "The full text content of the job description"
          }
        },
        required: ["jobDescriptionText"]
      }
    }
  ],
  toolLogic: {
    updateInterviewProgress: async ({ currentStage, progress, stageTitle }) => {
      // This will be implemented in the UI component
      return { success: true };
    },
    showFeedback: async ({ feedbackType, message, details }) => {
      // This will be implemented in the UI component
      return { success: true };
    },
    analyzeResume: async ({ resumeText }) => {
      // This will be implemented to extract key points from resume
      return { 
        skills: [],
        experience: [],
        education: []
      };
    },
    analyzeJobDescription: async ({ jobDescriptionText }) => {
      // This will be implemented to extract key requirements
      return {
        requiredSkills: [],
        preferredSkills: [],
        responsibilities: []
      };
    }
  }
};

export default interviewCoach;
