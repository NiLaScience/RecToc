import { useState, useCallback, useRef, useEffect } from 'react';
import { useBaseRealtimeConnection, type ServerEvent as BaseServerEvent } from './useBaseRealtimeConnection';
import type { CVSchema, JobDescriptionSchema } from '../services/OpenAIService';

// Extend the base server event type to include function calls
type ServerEvent = BaseServerEvent | {
  type: 'function_call';
  name: string;
  arguments: {
    currentStage?: InterviewStage;
    progress?: number;
    stageTitle?: string;
    feedbackType?: 'positive' | 'improvement' | 'neutral';
    message?: string;
    details?: {
      strengths: string[];
      improvements: string[];
    };
  };
};

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

export const INTERVIEW_STAGES: InterviewStage[] = [
  'intro',
  'technical',
  'behavioral',
  'problemSolving',
  'cultureFit',
  'closing'
];

export const useInterviewCoach = ({
  resumeData,
  jobDescription,
  onProgressUpdate,
  onFeedback,
}: UseInterviewCoachProps) => {
  const [state, setState] = useState<InterviewCoachState>({
    currentStage: 'intro',
    progress: 0,
    stageTitle: 'Introduction',
    feedback: null,
  });

  const feedbackBuffer = useRef<string | null>(null);

  // Handle stage transitions from agent responses
  const handleServerEvent = useCallback((event: ServerEvent) => {
    if (event.type === 'response.text.delta' && 'delta' in event && event.delta) {
      // Check for stage transition markers
      if (event.delta.includes('[NEXT_STAGE]')) {
        const currentIndex = INTERVIEW_STAGES.indexOf(state.currentStage);
        const nextStage = INTERVIEW_STAGES[currentIndex + 1] || 'closing';
        const progress = ((currentIndex + 1) / INTERVIEW_STAGES.length) * 100;
        
        console.log('🎯 Stage transition:', {
          from: state.currentStage,
          to: nextStage,
          progress: `${progress}%`
        });
        
        setState(prev => ({
          ...prev,
          currentStage: nextStage,
          progress,
          stageTitle: nextStage.charAt(0).toUpperCase() + nextStage.slice(1)
        }));
        
        onProgressUpdate?.(nextStage, progress, nextStage);
      }
      
      // Check for feedback markers
      if (event.delta.includes('[FEEDBACK_START]')) {
        feedbackBuffer.current = '';
      } else if (event.delta.includes('[FEEDBACK_END]')) {
        try {
          if (feedbackBuffer.current !== null) {
            const feedback = JSON.parse(feedbackBuffer.current);
            console.log('💭 Feedback received:', {
              type: feedback.type,
              strengths: feedback.details?.strengths?.length || 0,
              improvements: feedback.details?.improvements?.length || 0
            });
            setState(prev => ({ ...prev, feedback }));
            onFeedback?.(feedback);
          }
        } catch (err) {
          console.error('❌ Failed to parse feedback:', err);
        }
        feedbackBuffer.current = null;
      } else if (feedbackBuffer.current !== null) {
        feedbackBuffer.current += event.delta;
      }
    } else if (event.type === 'function_call' && 'name' in event && 'arguments' in event) {
      // Handle function calls from the LLM
      console.log('🔧 Function call:', {
        name: event.name,
        args: event.arguments
      });

      switch (event.name) {
        case 'updateInterviewProgress':
          const { currentStage, progress, stageTitle } = event.arguments;
          if (currentStage && progress && stageTitle) {
            setState(prev => ({
              ...prev,
              currentStage,
              progress,
              stageTitle
            }));
            onProgressUpdate?.(currentStage, progress, stageTitle);
          }
          break;
          
        case 'showFeedback':
          const { feedbackType, message, details } = event.arguments;
          if (feedbackType && message && details) {
            const feedback = {
              type: feedbackType,
              message,
              details
            };
            setState(prev => ({ ...prev, feedback }));
            onFeedback?.(feedback);
          }
          break;
      }
    }
  }, [state.currentStage, onProgressUpdate, onFeedback]);

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
          threshold: 0.3,
          prefix_padding_ms: 500,
          silence_duration_ms: 800,
          create_response: true
        }
      }
    }),
    onEvent: handleServerEvent,
    onConnect: () => {
      console.log('Interview coach connected, sending initial context...');
      
      // Send initial context to the agent
      sendMessage({
        type: 'conversation.item.create',
        isUser: false,
        item: {
          type: "message",
          role: "system",
          content: [{
            type: "input_text",
            text: `# Personality and Tone
## Identity
You are a professional interview coach with expertise in technical interviews. You have years of experience preparing candidates for software engineering positions.

## Task
Guide candidates through a structured technical interview preparation session for the following position:
Position: ${jobDescription.title}
Company: ${jobDescription.company}
Experience Level: ${jobDescription.experienceLevel}

Required Skills:
${jobDescription.skills.map(skill => `- ${skill}`).join('\n')}

Key Responsibilities:
${jobDescription.responsibilities.map(resp => `- ${resp}`).join('\n')}

## Important Instructions
1. After completing each interview stage, append the marker [NEXT_STAGE] to your response.
2. When providing feedback, wrap it in [FEEDBACK_START] and [FEEDBACK_END] markers, using this format:
{
  "feedbackType": "positive" | "improvement" | "neutral",
  "message": "Main feedback message",
  "details": {
    "strengths": ["strength1", "strength2"],
    "improvements": ["improvement1", "improvement2"]
  }
}

## Interview Flow
1. Start with a warm greeting, introducing yourself and explaining that this is a practice interview for the ${jobDescription.title} position at ${jobDescription.company}.
2. Guide the candidate through these stages:
   - Introduction
   - Technical Skills Assessment
   - Behavioral Questions
   - Problem Solving
   - Culture Fit
   - Closing/Feedback

## Candidate Information
${JSON.stringify(resumeData, null, 2)}

Remember to:
- Be supportive and encouraging
- Provide specific, actionable feedback after each response
- Keep questions relevant to the job requirements
- End each stage with [NEXT_STAGE]
`
          }]
        }
      });

      // Register available tools
      sendMessage({
        type: 'conversation.item.create',
        isUser: false,
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
                        enum: INTERVIEW_STAGES
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

      // Immediately trigger the initial greeting
      sendMessage({
        type: 'response.create',
        isUser: false,
        response: {
          modalities: ["text", "audio"]
        }
      });
    }
  });

  // Start the interview process
  const startInterview = useCallback(async () => {
    if (sessionStatus === "DISCONNECTED") {
      await baseConnect();
    }
  }, [baseConnect, sessionStatus]);

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
  };
};
