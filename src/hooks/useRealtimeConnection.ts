import { useState, useEffect, useRef, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { ensureInitialized, callFunction } from '../config/firebase';
import { Capacitor } from '@capacitor/core';

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

// Add better type definitions at the top
export type SessionStatus = "DISCONNECTED" | "CONNECTING" | "CONNECTED";

interface ServerEvent {
  type: string;
  event_id?: string;
  item_id?: string;
  transcript?: string;
  delta?: string;
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

export const useRealtimeConnection = (resumeData?: ResumeData) => {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("DISCONNECTED");
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<RealtimeMessage[]>([]);
  const [interviewState, setInterviewState] = useState<InterviewState>({
    stage: InterviewStage.INTRODUCTION,
    completedTopics: [],
    preferences: {},
    keyInsights: [],
    isCompleting: false
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
    setInterviewState({
      stage: InterviewStage.INTRODUCTION,
      completedTopics: [],
      preferences: {},
      keyInsights: [],
      isCompleting: false
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

  const connect = useCallback(async () => {
    try {
      setSessionStatus("CONNECTING");
      setError(null);

      // Ensure Firebase is initialized
      await ensureInitialized();

      // Get ephemeral token using Firebase Function
      let token: string;
      if (Capacitor.isNativePlatform()) {
        // Use Capacitor Firebase Functions plugin for native platforms
        const result = await callFunction('generateRealtimeToken') as { token: string };
        token = result.token;
      } else {
        // Use web SDK for browser
        const functions = getFunctions();
        const generateToken = httpsCallable(functions, 'generateRealtimeToken');
        const result = await generateToken({});
        token = (result.data as { token: string }).token;
      }

      if (!token) {
        throw new Error('Invalid token response from server');
      }

      // Create peer connection with ICE servers
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ]
      });
      peerConnectionRef.current = pc;

      // Set up audio element for remote audio
      const audioEl = new Audio();
      audioEl.autoplay = true;
      audioElementRef.current = audioEl;

      pc.ontrack = (e) => {
        if (audioElementRef.current) {
          audioElementRef.current.srcObject = e.streams[0];
        }
      };

      // Handle connection state changes
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed') {
          setError('Connection failed. Please try again.');
          disconnect();
        }
      };

      // Set up audio
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        pc.addTrack(stream.getTracks()[0]);
      } catch (err) {
        console.error('Audio setup failed:', err);
        throw new Error('Failed to setup audio');
      }

      // Set up data channel
      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;

      dc.onopen = () => {
        setSessionStatus("CONNECTED");
        setError(null);

        try {
          // First, send basic session config
          const sessionConfig = {
            type: "session.update",
            session: {
              modalities: ["audio", "text"],
              input_audio_transcription: {
                model: "whisper-1",
                language: "en",
                prompt: "This is a job interview conversation."
              },
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 200,
                create_response: true
              }
            }
          };

          console.log('Sending session config:', sessionConfig);
          dc.send(JSON.stringify(sessionConfig));

          // Then, if we have resume data, send it as a system message
          if (resumeData) {
            const formatSystemPrompt = (resume: ResumeData, state: InterviewState) => {
              const experienceSection = resume.experience.map(exp => 
                `- ${exp.title} at ${exp.company} (${exp.startDate} to ${exp.endDate || 'Present'})
                   ${exp.description}`
              ).join('\n');

              const educationSection = resume.education.map(edu =>
                `- ${edu.degree} in ${edu.field} from ${edu.school}, graduated ${edu.graduationDate}`
              ).join('\n');

              const skillsSection = `Skills: ${resume.skills.join(', ')}`;

              return `
You are an AI interviewer conducting a structured job search onboarding interview.
Current interview stage: ${state.stage}

Candidate's Resume:
Experience:
${experienceSection}

Education:
${educationSection}

${skillsSection}

Instructions:
1. Start by briefly acknowledging their experience at ${resume.experience[0]?.company} as a ${resume.experience[0]?.title}.
2. Follow this interview structure:
   - Review their experience and achievements
   - Assess their skills and expertise
   - Understand their job preferences (location, salary, remote work)
   - Discuss career goals and expectations
3. Keep responses concise and focused.
4. Ask one question at a time.
5. Include [NEXT_STAGE] when ready to move to the next stage.
6. Include [INTERVIEW_COMPLETE] when all stages are done.

Previously completed topics: ${state.completedTopics.join(', ')}
Current preferences: ${JSON.stringify(state.preferences)}
Key insights gathered: ${state.keyInsights.join(', ')}
`;
            };

            // Send initial system message
            const systemMessage = {
              type: "conversation.item.create",
              item: {
                type: "message",
                role: "system",
                content: [
                  {
                    type: "input_text",
                    text: formatSystemPrompt(resumeData, interviewState)
                  }
                ]
              }
            };

            console.log('Sending system message with resume:', systemMessage);
            dc.send(JSON.stringify(systemMessage));

            // Start the interview with a response request
            const responseCreate = {
              type: "response.create",
              response: {
                modalities: ["text", "audio"]
              }
            };
            dc.send(JSON.stringify(responseCreate));
          }
        } catch (error) {
          console.error('Failed to configure session:', error);
          setError('Failed to configure session');
        }
      };

      dc.onclose = () => {
        setSessionStatus("DISCONNECTED");
      };

      dc.onerror = (e) => {
        setError('Data channel error: ' + e.error?.message || 'Unknown error');
      };

      dc.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          handleServerEvent(event);
        } catch (parseError) {
          console.error('Failed to parse message:', parseError);
          setError('Failed to parse server message');
        }
      };

      // Create and set local description
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Connect to OpenAI Realtime API
      const baseUrl = "https://api.openai.com/v1/realtime";
      const model = "gpt-4o-realtime-preview-2024-12-17";
      
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/sdp"
        },
      });

      if (!sdpResponse.ok) {
        throw new Error('Failed to establish connection with OpenAI');
      }

      const answer = {
        type: 'answer' as RTCSdpType,
        sdp: await sdpResponse.text(),
      };
      
      await pc.setRemoteDescription(answer);

    } catch (err) {
      console.error('Connection error:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setSessionStatus("DISCONNECTED");
      disconnect();
    }
  }, [resumeData, interviewState, disconnect]);

  const sendMessage = useCallback((message: RealtimeMessage) => {
    if (dataChannelRef.current?.readyState === 'open') {
      try {
        // Step 1: Create conversation item
        const conversationItem = {
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: message.response.instructions
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

  const handleCompletion = useCallback(() => {
    // Set completing state
    setInterviewState(prev => ({
      ...prev,
      isCompleting: true
    }));

    // Wait for audio to finish (5 seconds buffer)
    completionTimeoutRef.current = setTimeout(() => {
      // Close the connection
      disconnect();
      
      // Reset completion state
      setInterviewState(prev => ({
        ...prev,
        isCompleting: false
      }));
    }, 5000);
  }, [disconnect]);

  const processAIResponse = useCallback((response: string) => {
    // Check for interview completion
    if (response.includes('[INTERVIEW_COMPLETE]')) {
      setInterviewState(prev => ({
        ...prev,
        stage: InterviewStage.COMPLETED
      }));
      handleCompletion();
      return;
    }

    // Check for stage transition marker
    if (response.includes('[NEXT_STAGE]')) {
      // Move to next stage
      const currentIndex = Object.values(InterviewStage).indexOf(interviewState.stage);
      const nextStage = Object.values(InterviewStage)[currentIndex + 1];
      
      // Add current stage to completed topics
      setInterviewState(prev => ({
        ...prev,
        stage: nextStage,
        completedTopics: [...prev.completedTopics, prev.stage]
      }));
    }

    // Extract and update preferences if in preferences stage
    if (interviewState.stage === InterviewStage.PREFERENCES) {
      // Look for specific preference markers in the response
      const jobTypesMatch = response.match(/Job Types?: (.*?)(?:\[|$)/i);
      const locationsMatch = response.match(/Locations?: (.*?)(?:\[|$)/i);
      const salaryMatch = response.match(/Salary?: (.*?)(?:\[|$)/i);
      const remoteMatch = response.match(/Remote?: (.*?)(?:\[|$)/i);

      setInterviewState(prev => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          ...(jobTypesMatch && { jobTypes: jobTypesMatch[1].split(',').map(s => s.trim()) }),
          ...(locationsMatch && { locations: locationsMatch[1].split(',').map(s => s.trim()) }),
          ...(salaryMatch && { salary: salaryMatch[1].trim() }),
          ...(remoteMatch && { remote: remoteMatch[1].toLowerCase().includes('yes') })
        }
      }));
    }

    // Extract key insights from AI responses
    const insights = response
      .split('\n')
      .filter(line => line.startsWith('*') || line.startsWith('-'))
      .map(line => line.replace(/^[*-]\s*/, '').trim());

    if (insights.length > 0) {
      setInterviewState(prev => ({
        ...prev,
        keyInsights: Array.from(new Set([...prev.keyInsights, ...insights]))
      }));
    }
  }, [interviewState.stage, handleCompletion]);

  const handleServerEvent = useCallback((event: ServerEvent) => {
    console.log("Received event:", event.type, event);

    switch (event.type) {
      case 'error':
        const errorMessage = event.error?.message || 'Unknown error occurred';
        console.error('OpenAI Realtime error:', errorMessage, event.error);
        setError(errorMessage);
        break;

      case 'session.created':
        console.log('Session created:', event.session);
        setSessionStatus("CONNECTED");
        break;

      case 'session.updated':
        console.log('Session updated:', event.session);
        if (!event.session?.input_audio_transcription) {
          console.warn('Session missing audio transcription configuration');
        }
        break;

      case 'conversation.item.input_audio_transcription.completed':
        const userTranscript = {
          type: event.type,
          transcript: event.transcript,
          timestamp: new Date().toISOString(),
          isUser: true
        };
        console.log('User transcript:', userTranscript);
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
          const finalResponse = {
            type: 'response.done',
            text: finalText,
            timestamp: currentResponseRef.current.timestamp,
            isUser: false,
            stage: interviewState.stage
          };
          console.log('Final response:', finalResponse);
          setMessages(prev => [...prev, finalResponse]);
          currentResponseRef.current = null;
        }
        break;

      default:
        console.log('Unhandled event type:', event.type);
        break;
    }
  }, [interviewState.stage]);

  // Update message handling to process AI responses
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && !lastMessage.isUser && lastMessage.text) {
      processAIResponse(lastMessage.text);
    }
  }, [messages, processAIResponse]);

  // Clean up
  useEffect(() => {
    return () => {
      if (sessionStatus === "CONNECTED") {
        disconnect();
      }
    };
  }, [sessionStatus, disconnect]);

  return {
    sessionStatus,
    error,
    messages,
    connect,
    disconnect,
    sendMessage,
    cleanup,
    isCompleting: interviewState.isCompleting,
    currentStage: interviewState.stage,
    totalStages: Object.keys(InterviewStage).length - 1, // Subtract 1 to exclude COMPLETED
  };
};
