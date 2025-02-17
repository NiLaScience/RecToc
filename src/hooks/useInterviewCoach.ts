import { useState, useCallback, useRef, useEffect } from 'react';
import { useBaseRealtimeConnection, ServerEvent, SessionStatus } from './useBaseRealtimeConnection';
import type { CVSchema } from '../types/cv';
import type { JobDescription } from '../types/job_opening';

export type InterviewStage = 'intro' | 'technical' | 'behavioral' | 'problemSolving' | 'cultureFit' | 'closing';

export const INTERVIEW_STAGES: InterviewStage[] = [
  'intro',
  'technical',
  'behavioral',
  'problemSolving',
  'cultureFit',
  'closing'
];

interface InterviewFeedback {
  feedbackType: 'positive' | 'improvement' | 'neutral';
  message: string;
  details: {
    strengths: string[];
    improvements: string[];
  };
}

interface InterviewCoachState {
  currentStage: InterviewStage;
  progress: number;  // 0 to 100
  stageTitle: string;
  feedback: InterviewFeedback | null;
}

interface UseInterviewCoachProps {
  resumeData: CVSchema;
  jobDescription: JobDescription;
  onProgressUpdate?: (stage: InterviewStage, progress: number, title: string) => void;
  onFeedback?: (feedback: InterviewFeedback) => void;
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
    stageTitle: 'Introduction',
    feedback: null,
  });

  const {
    sessionStatus,
    error,
    messages,
    connect: baseConnect,
    disconnect,
    sendMessage,
  } = useBaseRealtimeConnection({
    onSessionConfig: () => {
      // Provide the entire instructions + tool definitions to the Realtime session
      const instructions = `
# Personality and Tone
You are an AI-powered interview coach that provides a structured mock interview for a candidate applying for:
- Job Title: ${jobDescription.title || 'Unknown'}
- Company: ${jobDescription.company || 'Unknown'}
- Skills: ${jobDescription.skills?.join(', ') || 'N/A'}

The candidate's resume data is:
${JSON.stringify(resumeData, null, 2)}

You must follow these interview sections:
1) Intro (5%)
2) Technical (25%)
3) Behavioral (25%)
4) Problem Solving (20%)
5) Culture Fit (15%)
6) Closing (10%)

After each major question, you may provide immediate feedback by calling \`showFeedback\`. Whenever you move from one section to another, call \`updateInterviewProgress\`. Progress goes from 0 to 100.

Be sure to only call these tools via "function_call" in your JSON. For example:
{
  "type": "function_call",
  "name": "updateInterviewProgress",
  "arguments": "{ \\"currentStage\\": \\"technical\\", \\"progress\\": 25, \\"stageTitle\\": \\"Technical Skills\\"}"
}

You can call showFeedback with details. For example:
{
  "type": "function_call",
  "name": "showFeedback",
  "arguments": "{ \\"feedbackType\\": \\"improvement\\", \\"message\\": \\"Some improvement points...\\", \\"details\\": { \\"strengths\\": [...], \\"improvements\\": [...]}}"
}

End each stage transition with [NEXT_STAGE] or provide feedback within [FEEDBACK] markers if you want. 
Remember to keep the user engaged and track the progress from 0% to 100% through the 6 stages.
`;

      return {
        type: 'session.update',
        session: {
          modalities: ['audio', 'text'],
          instructions, 
          voice: 'coral',
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          input_audio_transcription: { model: 'whisper-1' },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 200,
            create_response: true,
          },
          tools: [
            {
              type: 'function',
              name: 'updateInterviewProgress',
              description: 'Updates the UI to reflect current interview stage and progress (0-100).',
              parameters: {
                type: 'object',
                properties: {
                  currentStage: {
                    type: 'string',
                    enum: ['intro','technical','behavioral','problemSolving','cultureFit','closing'],
                  },
                  progress: { type: 'number' },
                  stageTitle: { type: 'string' },
                },
                required: ['currentStage','progress','stageTitle'],
              },
            },
            {
              type: 'function',
              name: 'showFeedback',
              description: 'Displays feedback with evaluation after each answer.',
              parameters: {
                type: 'object',
                properties: {
                  feedbackType: {
                    type: 'string',
                    enum: ['positive','improvement','neutral']
                  },
                  message: { type: 'string' },
                  details: {
                    type: 'object',
                    properties: {
                      strengths: { type: 'array', items: { type: 'string' }},
                      improvements: { type: 'array', items: { type: 'string' }},
                    },
                    required: ['strengths','improvements'],
                  }
                },
                required: ['feedbackType','message','details'],
              },
            }
          ],
        },
      };
    },
    onEvent: (event: ServerEvent) => {
      // Specifically catch function calls
      if (event.type === 'function_call' && event.name && event.arguments) {
        if (event.name === 'updateInterviewProgress') {
          const { currentStage, progress, stageTitle } = event.arguments;
          setState((prev) => ({
            ...prev,
            currentStage,
            progress,
            stageTitle,
          }));
          onProgressUpdate?.(currentStage, progress, stageTitle);

        } else if (event.name === 'showFeedback') {
          const { feedbackType, message, details } = event.arguments;
          const newFeedback = {
            feedbackType,
            message,
            details,
          };
          setState((prev) => ({
            ...prev,
            feedback: newFeedback,
          }));
          onFeedback?.(newFeedback);
        }
      }
    }
  });

  const connect = useCallback(async () => {
    try {
      await baseConnect();
      // Send initial message to start the interview immediately after connection
      if (sessionStatus === "CONNECTED") {
        const responseCreate = {
          type: "response.create",
          response: {
            modalities: ["text", "audio"]
          },
          isUser: false
        };
        sendMessage(responseCreate);
      }
    } catch (err) {
      console.error('Connection error:', err);
    }
  }, [baseConnect, sessionStatus, sendMessage]);

  const stopInterview = useCallback(() => {
    setState((prev) => ({
      ...prev,
      progress: 0,
      feedback: null,
    }));
    disconnect();
  }, [disconnect]);

  useEffect(() => {
    // Start the interview if needed
    // (Or let the parent call startInterview explicitly)
  }, []);

  return {
    state,
    sessionStatus,
    error,
    messages,
    connect,
    stopInterview,
  };
};
