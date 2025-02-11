import { useState, useCallback, useRef, useEffect } from 'react';
import { useBaseRealtimeConnection } from './useBaseRealtimeConnection';
import type { CVSchema, JobDescriptionSchema } from '../services/OpenAIService';

export type InterviewStage = 'intro' | 'technical' | 'behavioral' | 'problemSolving' | 'cultureFit' | 'closing';

interface InterviewCoachState {
  currentStage: InterviewStage;
  progress: number;
  stageTitle: string;
  feedback: {
    type: 'positive' | 'improvement' | 'neutral';
    message: string;
    details: {
      strengths: string[];
      improvements: string[];
    };
  } | null;
}

interface InterviewFeedback {
  feedbackType: 'positive' | 'improvement' | 'neutral';
  message: string;
  details: {
    strengths: string[];
    improvements: string[];
  };
}

interface ProgressUpdate {
  currentStage: InterviewStage;
  progress: number;
  stageTitle: string;
}

interface UseInterviewCoachProps {
  resumeData: CVSchema;
  jobDescription: JobDescriptionSchema;
  onProgressUpdate: (stage: InterviewStage, progress: number, title: string) => void;
  onFeedback: (feedback: InterviewCoachState['feedback']) => void;
}

interface ServerEvent {
  type: string;
  item?: {
    content: any[];
  };
}

export const useInterviewCoach = ({
  resumeData,
  jobDescription,
  onProgressUpdate,
  onFeedback,
}: UseInterviewCoachProps) => {
  const [state, setState] = useState<InterviewCoachState>({
    currentStage: 'intro',
    progress: 0,
    stageTitle: 'Getting Started',
    feedback: null,
  });

  // Tool implementation functions
  const handleUpdateProgress = useCallback(({ currentStage, progress, stageTitle }: ProgressUpdate) => {
    setState(prev => ({
      ...prev,
      currentStage,
      progress,
      stageTitle,
    }));
    onProgressUpdate(currentStage, progress, stageTitle);
  }, [onProgressUpdate]);

  const handleFeedback = useCallback(({ feedbackType, message, details }: InterviewFeedback) => {
    const feedback = {
      type: feedbackType,
      message,
      details,
    };
    setState(prev => ({
      ...prev,
      feedback,
    }));
    onFeedback(feedback);
  }, [onFeedback]);

  // Handle tool calls from the agent
  const handleServerEvent = useCallback((event: ServerEvent) => {
    if (event.type === 'tool.call') {
      const toolCall = event.item?.content?.[0];
      if (!toolCall) return;

      const { name, parameters } = toolCall;
      switch (name) {
        case 'updateInterviewProgress':
          handleUpdateProgress(parameters as ProgressUpdate);
          break;
        case 'showFeedback':
          handleFeedback(parameters as InterviewFeedback);
          break;
      }
    }
  }, [handleUpdateProgress, handleFeedback]);

  // Use base realtime connection
  const {
    sessionStatus,
    error,
    messages,
    connect: baseConnect,
    disconnect: baseDisconnect,
    sendMessage,
  } = useBaseRealtimeConnection({
    onSessionConfig: () => ({
      type: "session.update",
      session: {
        modalities: ["audio", "text"],
        input_audio_transcription: {
          model: "whisper-1",
          language: "en",
          prompt: "This is a technical job interview."
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.3,           // Lower threshold for better speech detection
          prefix_padding_ms: 500,   // More padding before speech
          silence_duration_ms: 800, // Longer silence duration to avoid premature cuts
          create_response: true
        }
      }
    }),
    onEvent: handleServerEvent,
    onConnect: () => {
      // Send initial context to the agent
      sendMessage({
        type: 'conversation.item.create',
        item: {
          type: "message",
          role: "system",
          content: [{
            type: "input_text",
            text: `# Personality and Tone
## Identity
You are a professional interview coach with expertise in technical interviews. You have years of experience preparing candidates for software engineering positions and understand both the technical and behavioral aspects of the interview process.

## Task
Guide candidates through a structured technical interview preparation session, providing constructive feedback and helping them improve their interview skills.

## Demeanor
Professional yet approachable, maintaining a supportive and encouraging atmosphere while providing honest feedback.

## Interview Context
Position: ${jobDescription.title}
Company: ${jobDescription.company}
Experience Level: ${jobDescription.experienceLevel}

Required Skills:
${jobDescription.skills.map(skill => `- ${skill}`).join('\n')}

Key Responsibilities:
${jobDescription.responsibilities.map(resp => `- ${resp}`).join('\n')}

## Tools
You have access to the following tools to manage the interview process:

1. updateInterviewProgress - Updates the UI to reflect current interview stage and progress
   - Use this when transitioning between interview sections
   - Update progress percentage based on completed sections

2. showFeedback - Displays feedback UI component with evaluation
   - Use after each response to provide immediate feedback
   - Include specific strengths and areas for improvement

## Interview Structure
The interview is divided into the following sections:

1. Introduction (5%)
   - Welcome the candidate
   - Explain the interview process
   - Set expectations

2. Technical Skills (25%)
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

## Interview Flow
1. Start each section by calling updateInterviewProgress with the current stage and progress
2. Ask clear, focused questions one at a time
3. Listen to the candidate's response
4. IMMEDIATELY after each response:
   a. Call showFeedback with specific feedback about their answer
   b. Include both strengths and areas for improvement
5. Then decide whether to:
   - Ask a follow-up question in the current section
   - Move to the next section
   - End the interview

## Feedback Guidelines
- Provide immediate feedback after EVERY response
- Structure feedback with:
  - Overall assessment (positive/improvement/neutral)
  - Main message summarizing the evaluation
  - Specific strengths demonstrated
  - Concrete areas for improvement
- Keep feedback constructive and actionable
- Focus on both content and delivery
- Reference specific examples from their response

Example feedback:
{
  "feedbackType": "positive",
  "message": "Strong technical explanation with good structure",
  "details": {
    "strengths": [
      "Clear problem-solving approach",
      "Used specific examples",
      "Logical flow of ideas"
    ],
    "improvements": [
      "Could add more context about scalability",
      "Consider mentioning alternative approaches"
    ]
  }
}

## Candidate Information
${JSON.stringify({
  resume: resumeData,
  jobDescription
}, null, 2)}

Begin by calling updateInterviewProgress to start the introduction phase, then welcome the candidate, introduce yourself as their interview coach, mention the specific position they're interviewing for, and explain the interview process.
`
          }]
        }
      });

      // Register available tools
      sendMessage({
        type: 'conversation.item.create',
        item: {
          type: "message",
          role: "system",
          content: [{
            type: "input_text",
            text: JSON.stringify({
              type: 'tool_registration',
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
                        enum: ["intro", "technical", "behavioral", "problemSolving", "cultureFit", "closing"]
                      },
                      progress: {
                        type: "number",
                        description: "Progress percentage (0-100)"
                      },
                      stageTitle: {
                        type: "string",
                        description: "Display title for current stage"
                      }
                    }
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
                        enum: ["positive", "improvement", "neutral"]
                      },
                      message: {
                        type: "string",
                        description: "Main feedback message"
                      },
                      details: {
                        type: "object",
                        properties: {
                          strengths: {
                            type: "array",
                            items: { type: "string" },
                            description: "List of specific strengths in the response"
                          },
                          improvements: {
                            type: "array",
                            items: { type: "string" },
                            description: "List of specific areas for improvement"
                          }
                        }
                      }
                    }
                  }
                }
              ]
            })
          }]
        }
      });

      // Add a small delay to ensure session is fully configured
      setTimeout(() => {
        // Send first message
        sendMessage({
          type: 'conversation.item.create',
          item: {
            type: "message",
            role: "user",
            content: [{
              type: "input_text",
              text: "Hello, I'm here for the interview."
            }]
          }
        });

        // Send second message after a short delay
        setTimeout(() => {
          sendMessage({
            type: 'conversation.item.create',
            item: {
              type: "message",
              role: "user",
              content: [{
                type: "input_text",
                text: "I'm excited to learn more about this opportunity."
              }]
            }
          });

          // Finally trigger the agent to respond
          setTimeout(() => {
            sendMessage({
              type: 'response.create',
              response: {
                modalities: ["text", "audio"]
              }
            });
          }, 500);
        }, 500);
      }, 1000);
    }
  });

  // Start the interview process
  const startInterview = useCallback(async () => {
    try {
      await baseConnect();
    } catch (err) {
      console.error('Failed to start interview:', err);
    }
  }, [baseConnect]);

  // Stop the interview
  const stopInterview = useCallback(() => {
    baseDisconnect();
  }, [baseDisconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      baseDisconnect();
    };
  }, [baseDisconnect]);

  return {
    state,
    sessionStatus,
    error,
    messages,
    startInterview,
    stopInterview,
    updateProgress: handleUpdateProgress,
    showFeedback: handleFeedback,
  };
};
