import { useState, useEffect, useRef, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { ensureInitialized, callFunction } from '../config/firebase';
import { Capacitor } from '@capacitor/core';
import { useBaseRealtimeConnection, type SessionStatus } from './useBaseRealtimeConnection';

// Interview stage definitions
export enum InterviewStage {
  INTRODUCTION = 'introduction',
  EXPERIENCE_REVIEW = 'experience_review',
  SKILLS_ASSESSMENT = 'skills_assessment',
  PREFERENCES = 'preferences',
  EXPECTATIONS = 'expectations',
  WRAP_UP = 'wrap_up',
  COMPLETED = 'completed'
}

interface InterviewState {
  stage: InterviewStage;
  completedTopics: string[];
  preferences: {
    jobTypes?: string[];
    locations?: string[];
    salary?: string;
    remote?: boolean;
  };
  keyInsights: string[];
  isCompleting: boolean;
  feedback: InterviewFeedback | null;
  progress: number;
  stageTitle: string;
}

interface InterviewFeedback {
  feedbackType: 'positive' | 'improvement' | 'neutral';
  message: string;
  details: {
    strengths: string[];
    improvements: string[];
  };
}

interface RealtimeMessage {
  type: string;
  timestamp?: string;
  isUser: boolean;
  text?: string;
  transcript?: string;
  stage?: InterviewStage;
  [key: string]: any;
}

interface ResumeData {
  experience: Array<{
    company: string;
    title: string;
    startDate: string;
    endDate?: string;
    description: string;
  }>;
  education: Array<{
    school: string;
    degree: string;
    field: string;
    graduationDate: string;
  }>;
  skills: string[];
  [key: string]: any;
}

// Re-export the SessionStatus type
export type { SessionStatus };

interface ServerEvent {
  type: string;
  event_id?: string;
  item_id?: string;
  transcript?: string;
  delta?: string;
  name?: string;
  arguments?: any;
  session?: {
    id?: string;
    input_audio_transcription?: {
      model?: string;
      language?: string;
      prompt?: string;
    };
  };
  item?: {
    id?: string;
    type?: string;
    role?: "user" | "assistant" | "system";
    content?: Array<{
      type?: string;
      text?: string;
      transcript?: string;
    }>;
  };
  response?: {
    output?: Array<{
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };
  error?: {
    message?: string;
    code?: string;
  };
}

// Add stage names and order
export const INTERVIEW_STAGES = [
  InterviewStage.INTRODUCTION,
  InterviewStage.EXPERIENCE_REVIEW,
  InterviewStage.SKILLS_ASSESSMENT,
  InterviewStage.PREFERENCES,
  InterviewStage.EXPECTATIONS,
  InterviewStage.WRAP_UP
];

export const stageNames: Record<InterviewStage, string> = {
  introduction: 'Introduction',
  experience_review: 'Experience Review',
  skills_assessment: 'Skills Assessment',
  preferences: 'Job Preferences',
  expectations: 'Career Goals',
  wrap_up: 'Wrap Up',
  completed: 'Completed'
};

export const useRealtimeConnection = (resumeData?: ResumeData) => {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("DISCONNECTED");
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<RealtimeMessage[]>([]);
  const [state, setState] = useState<InterviewState>({
    stage: InterviewStage.INTRODUCTION,
    completedTopics: [],
    preferences: {},
    keyInsights: [],
    isCompleting: false,
    feedback: null,
    progress: 0,
    stageTitle: 'Introduction'
  });

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Buffer for accumulating text deltas
  const currentResponseRef = useRef<{
    text: string;
    timestamp: string;
    responseId?: string;
    messageId?: string;
    isComplete: boolean;
  } | null>(null);

  // Add ref for completion timeout
  const completionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = useCallback(() => {
    // Clear completion timeout if exists
    if (completionTimeoutRef.current) {
      clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }

    // Clear all state
    setMessages([]);
    setError(null);
    setSessionStatus("DISCONNECTED");
    setState({
      stage: InterviewStage.INTRODUCTION,
      completedTopics: [],
      preferences: {},
      keyInsights: [],
      isCompleting: false,
      feedback: null,
      progress: 0,
      stageTitle: 'Introduction'
    });

    // Clear refs
    currentResponseRef.current = null;
    
    // Close connections
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (audioElementRef.current) {
      const tracks = audioElementRef.current.srcObject as MediaStream;
      tracks?.getTracks().forEach(track => track.stop());
      audioElementRef.current.srcObject = null;
      audioElementRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const handleFunctionCall = useCallback((name: string, args: any) => {
    switch (name) {
      case 'updateInterviewProgress':
        const { currentStage, progress, stageTitle } = args;
        setState(prev => ({
          ...prev,
          stage: currentStage,
          progress,
          stageTitle,
          completedTopics: [...prev.completedTopics, prev.stage]
        }));
        break;

      case 'showFeedback':
        const { feedbackType, message, details } = args;
        setState(prev => ({
          ...prev,
          feedback: { feedbackType, message, details }
        }));
        break;

      case 'updatePreferences':
        const { preferences } = args;
        setState(prev => ({
          ...prev,
          preferences: { ...prev.preferences, ...preferences }
        }));
        break;

      case 'addKeyInsight':
        const { insight } = args;
        setState(prev => ({
          ...prev,
          keyInsights: [...prev.keyInsights, insight]
        }));
        break;
    }
  }, []);

  // Add helper to process stage transitions
  const processStageTransition = useCallback((text: string) => {
    if (text.includes('[NEXT_STAGE]')) {
      const currentIndex = INTERVIEW_STAGES.indexOf(state.stage);
      if (currentIndex < INTERVIEW_STAGES.length - 1) {
        const nextStage = INTERVIEW_STAGES[currentIndex + 1];
        const progress = ((currentIndex + 2) / INTERVIEW_STAGES.length) * 100;
        handleFunctionCall('updateInterviewProgress', {
          currentStage: nextStage,
          progress,
          stageTitle: stageNames[nextStage]
        });
      }
    }
  }, [state.stage, handleFunctionCall]);

  const handleServerEvent = useCallback((event: ServerEvent) => {
    // Handle function calls
    if (event.type === 'function_call' && event.name && event.arguments) {
      handleFunctionCall(event.name, event.arguments);
      return;
    }
    
    // Handle other events
    switch (event.type) {
      case 'error':
        const errorMessage = event.error?.message || 'Unknown error occurred';
        console.error('OpenAI Realtime error:', errorMessage, event.error);
        setError(errorMessage);
        break;

      case 'conversation.item.input_audio_transcription.completed':
        const userTranscript = {
          type: event.type,
          transcript: event.transcript,
          timestamp: new Date().toISOString(),
          isUser: true
        };
        setMessages(prev => [...prev, userTranscript]);
        break;

      case 'response.created':
        currentResponseRef.current = {
          text: '',
          timestamp: new Date().toISOString(),
          responseId: event.item?.id,
          isComplete: false
        };
        break;

      case 'response.audio_transcript.delta':
        if (currentResponseRef.current && !currentResponseRef.current.isComplete) {
          currentResponseRef.current.text += event.delta || '';
        }
        break;

      case 'response.done':
        if (currentResponseRef.current) {
          currentResponseRef.current.isComplete = true;
          const finalText = event.response?.output?.[0]?.content?.[0]?.text || currentResponseRef.current.text;
          
          // Check for interview completion
          if (finalText.includes('[INTERVIEW_COMPLETE]')) {
            setState(prev => ({
              ...prev,
              stage: InterviewStage.COMPLETED,
              isCompleting: true
            }));
          } else {
            // Process stage transitions
            processStageTransition(finalText);
          }

          const finalResponse = {
            type: 'response.done',
            text: finalText,
            timestamp: currentResponseRef.current.timestamp,
            isUser: false,
            stage: state.stage
          };
          setMessages(prev => [...prev, finalResponse]);
          currentResponseRef.current = null;
        }
        break;
    }
  }, [handleFunctionCall, processStageTransition, state.stage]);

  const sendMessage = useCallback((message: RealtimeMessage) => {
    if (dataChannelRef.current?.readyState === 'open') {
      try {
        // Add message to local state immediately
        setMessages(prev => [...prev, {
          ...message,
          timestamp: new Date().toISOString(),
          isUser: true
        }]);

        // Step 1: Create conversation item
        const conversationItem = {
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: message.text
              }
            ]
          }
        };
        dataChannelRef.current.send(JSON.stringify(conversationItem));

        // Step 2: Create response with specified modalities
        const responseCreate = {
          type: "response.create",
          response: {
            modalities: ["text", "audio"]
          }
        };
        dataChannelRef.current.send(JSON.stringify(responseCreate));
      } catch (error) {
        console.error('Failed to send message:', error);
        setError('Failed to send message');
      }
    } else {
      setError('Connection is not open');
    }
  }, []);

  const {
    sessionStatus: baseSessionStatus,
    error: baseError,
    messages: baseMessages,
    connect: baseConnect,
    disconnect: baseDisconnect,
    sendMessage: baseSendMessage,
  } = useBaseRealtimeConnection({
    onSessionConfig: () => {
      const instructions = `
# Personality and Tone
You are an AI-powered onboarding interview assistant. Your role is to conduct a structured interview to understand the candidate's background, skills, and preferences.

# Interview Structure
You must follow these interview sections:
1) Introduction (10%)
   - Welcome the candidate, mention their background and purpose of the interview
   - Brief overview of the process
   - Initial rapport building

2) Experience Review (25%)
   - Discuss past roles and responsibilities
   - Key achievements
   - Learning experiences

3) Skills Assessment (25%)
   - Technical skills evaluation
   - Soft skills discussion
   - Areas of expertise

4) Job Preferences (20%)
   - Desired role types
   - Location preferences
   - Salary expectations
   - Remote work preferences

5) Career Goals (15%)
   - Short-term objectives
   - Long-term aspirations
   - Growth areas

6) Wrap Up (5%)
   - Summary of key points
   - Next steps
   - Final questions

The candidate's resume data is:
${JSON.stringify(resumeData, null, 2)}

# Important Guidelines
1. Keep responses concise and focused
2. Ask one question at a time
3. Use updateInterviewProgress to track progress through stages
4. Use showFeedback to provide feedback after responses
5. Use updatePreferences to record job preferences
6. Use addKeyInsight to note important points
7. Include [NEXT_STAGE] when ready to move stages
8. Include [INTERVIEW_COMPLETE] when finished

Remember to:
- Be professional but friendly
- Focus on gathering specific, actionable information
- Provide constructive feedback
- Help identify candidate's strengths and areas for improvement
`;

      return {
        type: "session.update",
        session: {
          modalities: ["audio", "text"],
          instructions,
          voice: "coral",
          input_audio_transcription: {
            model: "whisper-1",
            language: "en",
            prompt: "This is an onboarding interview conversation."
          },
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 200,
            create_response: true
          },
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
                    enum: Object.values(InterviewStage),
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
              name: "updatePreferences",
              description: "Updates the candidate's job preferences",
              parameters: {
                type: "object",
                properties: {
                  preferences: {
                    type: "object",
                    properties: {
                      jobTypes: {
                        type: "array",
                        items: { type: "string" },
                        description: "Types of jobs the candidate is interested in"
                      },
                      locations: {
                        type: "array",
                        items: { type: "string" },
                        description: "Preferred work locations"
                      },
                      salary: {
                        type: "string",
                        description: "Salary expectations"
                      },
                      remote: {
                        type: "boolean",
                        description: "Whether the candidate prefers remote work"
                      }
                    }
                  }
                },
                required: ["preferences"]
              }
            },
            {
              type: "function",
              name: "addKeyInsight",
              description: "Adds a key insight about the candidate",
              parameters: {
                type: "object",
                properties: {
                  insight: {
                    type: "string",
                    description: "Important insight about the candidate"
                  }
                },
                required: ["insight"]
              }
            }
          ]
        }
      };
    },
    onEvent: handleServerEvent
  });

  // Update our state based on base connection
  useEffect(() => {
    setSessionStatus(baseSessionStatus);
  }, [baseSessionStatus]);

  useEffect(() => {
    setError(baseError);
  }, [baseError]);

  useEffect(() => {
    setMessages(baseMessages);
  }, [baseMessages]);

  const connect = useCallback(async () => {
    try {
      await baseConnect();
    } catch (err) {
      console.error('Connection error:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
    }
  }, [baseConnect]);

  return {
    sessionStatus,
    error,
    messages,
    connect,
    disconnect: baseDisconnect,
    sendMessage: baseSendMessage,
    cleanup,
    isCompleting: state.isCompleting,
    currentStage: state.stage,
    totalStages: Object.keys(InterviewStage).length - 1,
    progress: state.progress,
    stageTitle: state.stageTitle,
    feedback: state.feedback,
    preferences: state.preferences,
    keyInsights: state.keyInsights
  };
};
