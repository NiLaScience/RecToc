import { useState, useCallback, useRef, useEffect } from 'react';
import { useBaseRealtimeConnection, ServerEvent, SessionStatus } from './useBaseRealtimeConnection';
import type { CVSchema } from '../types/cv';
import type { JobDescription } from '../types/job_opening';

export type onboardingStage = 'intro' | 'technical' | 'behavioral' | 'problemSolving' | 'cultureFit' | 'closing';

export const onboarding_STAGES: onboardingStage[] = [
  'intro',
  'technical',
  'behavioral',
  'problemSolving',
  'cultureFit',
  'closing'
];

interface onboardingFeedback {
  feedbackType: 'positive' | 'improvement' | 'neutral';
  message: string;
  details: {
    strengths: string[];
    improvements: string[];
  };
}

interface onboardingCoachState {
  currentStage: onboardingStage;
  progress: number;  // 0 to 100
  stageTitle: string;
  feedback: onboardingFeedback | null;
}

interface UseOnboardingCoachProps {
  resumeData: CVSchema;
  jobDescription: JobDescription;
  onProgressUpdate?: (stage: onboardingStage, progress: number, title: string) => void;
  onFeedback?: (feedback: onboardingFeedback) => void;
}

export const useOnboardingInterview = ({
  resumeData,
  jobDescription,
  onProgressUpdate,
  onFeedback,
}: UseOnboardingCoachProps) => {
  const [state, setState] = useState<onboardingCoachState>({
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
      const instructions = `
# Personality and Tone
You are an AI-powered onboarding assistant. Your role is to conduct a structured interview to understand the candidate's background, skills, and career goals.

# Interview Structure
You must follow these interview sections:
1) Introduction (10%)
   - Welcome the candidate
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

4) Career Goals (20%)
   - Short-term objectives
   - Long-term aspirations
   - Growth areas

5) Job Preferences (15%)
   - Desired role types
   - Location preferences
   - Work style preferences (remote/hybrid/onsite)
   - Salary expectations

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
5. Use addKeyInsight to note important points
6. Include [NEXT_STAGE] when ready to move stages
7. Include [INTERVIEW_COMPLETE] when finished

Remember to:
- Be professional but friendly
- Focus on gathering specific, actionable information
- Provide constructive feedback
- Help identify candidate's strengths and areas for improvement
`;

      return {
        type: "session.update",
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
              name: 'updateOnboardingProgress',
              description: 'Updates the UI to reflect current onboarding stage and progress (0-100).',
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
        if (event.name === 'updateOnboardingProgress') {
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
      // Send initial message to start the onboarding immediately after connection
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

  const stopOnboarding = useCallback(() => {
    setState((prev) => ({
      ...prev,
      progress: 0,
      feedback: null,
    }));
    disconnect();
  }, [disconnect]);

  useEffect(() => {
    // Start the onboarding if needed
    // (Or let the parent call startOnboarding explicitly)
  }, []);

  return {
    state,
    sessionStatus,
    error,
    messages,
    connect,
    stopOnboarding,
  };
};
