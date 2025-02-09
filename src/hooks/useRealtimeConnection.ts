import { useState, useEffect, useRef, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { ensureInitialized, callFunction } from '../config/firebase';
import { Capacitor } from '@capacitor/core';

// Interview stage definitions
enum InterviewStage {
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

export const useRealtimeConnection = (resumeData?: ResumeData) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<RealtimeMessage[]>([]);
  const [interviewState, setInterviewState] = useState<InterviewState>({
    stage: InterviewStage.INTRODUCTION,
    completedTopics: [],
    preferences: {},
    keyInsights: []
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

  const cleanup = useCallback(() => {
    // Clear all state
    setMessages([]);
    setError(null);
    setIsConnected(false);
    setIsConnecting(false);
    setInterviewState({
      stage: InterviewStage.INTRODUCTION,
      completedTopics: [],
      preferences: {},
      keyInsights: []
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
      setIsConnecting(true);
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
        setIsConnected(true);
        setIsConnecting(false);

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

              const stageInstructions = {
                [InterviewStage.INTRODUCTION]: `
                  You are conducting the initial part of a job search onboarding interview.
                  Start by briefly acknowledging their experience at ${resume.experience[0]?.company} as a ${resume.experience[0]?.title} and their ${resume.education[0]?.degree} in ${resume.education[0]?.field}.
                  Explain that you'll be helping understand their job preferences based on their background.
                  Keep the introduction concise and professional.
                `,
                [InterviewStage.EXPERIENCE_REVIEW]: `
                  Focus on understanding their most relevant experience.
                  Ask about specific achievements and responsibilities.
                  Identify their core strengths and expertise areas.
                `,
                [InterviewStage.SKILLS_ASSESSMENT]: `
                  Evaluate their technical and soft skills.
                  Ask about their proficiency levels and recent applications of key skills.
                  Identify any skill gaps or areas for growth.
                `,
                [InterviewStage.PREFERENCES]: `
                  Gather specific job preferences:
                  - Preferred job types and roles
                  - Location preferences and remote work
                  - Salary expectations
                  - Work environment preferences
                `,
                [InterviewStage.EXPECTATIONS]: `
                  Understand their career goals:
                  - Short and long-term career objectives
                  - Growth expectations
                  - Type of companies they're interested in
                `,
                [InterviewStage.WRAP_UP]: `
                  Summarize key points discussed.
                  Confirm their preferences and priorities.
                  Thank them and explain next steps in their job search.
                `
              }[state.stage];

              return `
You are an AI interviewer conducting a structured job search onboarding interview.
Current interview stage: ${state.stage}

Candidate's Resume:
Experience:
${experienceSection}

Education:
${educationSection}

${skillsSection}

Stage-specific instructions:
${stageInstructions}

Previously completed topics: ${state.completedTopics.join(', ')}
Current preferences: ${JSON.stringify(state.preferences)}
Key insights gathered: ${state.keyInsights.join(', ')}

Keep responses concise and focused on the current stage.
Ask one question at a time.
When a stage is complete, include [NEXT_STAGE] in your response.
When the entire interview is complete, include [INTERVIEW_COMPLETE].
`;
            };

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
          }
        } catch (error) {
          console.error('Failed to configure session:', error);
          setError('Failed to configure session');
        }
      };

      dc.onclose = () => {
        setIsConnected(false);
      };

      dc.onerror = (e) => {
        setError('Data channel error: ' + e.error?.message || 'Unknown error');
      };

      dc.onmessage = (e) => {
        try {
          const realtimeEvent = JSON.parse(e.data);
          console.log("Received event:", realtimeEvent.type, realtimeEvent);

          switch (realtimeEvent.type) {
            case 'error':
              const errorMessage = realtimeEvent.error?.message || 'Unknown error occurred';
              console.error('OpenAI Realtime error:', errorMessage, realtimeEvent.error);
              setError(errorMessage);
              break;

            case 'session.created':
              console.log('Session created:', realtimeEvent.session);
              break;

            case 'session.updated':
              console.log('Session updated:', realtimeEvent.session);
              // Verify if the session was updated with our configuration
              if (!realtimeEvent.session?.input_audio_transcription) {
                console.warn('Session missing audio transcription configuration');
              }
              break;

            case 'conversation.item.input_audio_transcription.completed':
              // Add completed user speech transcript
              const userTranscript = {
                type: realtimeEvent.type,
                transcript: realtimeEvent.transcript,
                timestamp: realtimeEvent.timestamp || new Date().toISOString(),
                isUser: true
              };
              console.log('User transcript:', userTranscript);
              setMessages(prev => [...prev, userTranscript]);
              break;

            case 'response.created':
              // Initialize a new response buffer
              currentResponseRef.current = {
                text: '',
                timestamp: realtimeEvent.timestamp || new Date().toISOString(),
                responseId: realtimeEvent.response?.id,
                isComplete: false
              };
              break;

            case 'response.audio_transcript.delta':
              // Accumulate text in the buffer but don't update messages state
              if (currentResponseRef.current && !currentResponseRef.current.isComplete) {
                currentResponseRef.current.text += realtimeEvent.delta;
              }
              break;

            case 'response.done':
              if (currentResponseRef.current) {
                currentResponseRef.current.isComplete = true;
                const finalText = realtimeEvent.response?.output?.[0]?.content?.[0]?.text || currentResponseRef.current.text;
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
              } else {
                const finalText = realtimeEvent.response?.output?.[0]?.content?.[0]?.text;
                if (finalText) {
                  const finalResponse = {
                    type: 'response.done',
                    text: finalText,
                    timestamp: realtimeEvent.timestamp || new Date().toISOString(),
                    isUser: false,
                    stage: interviewState.stage
                  };
                  console.log('Final response (without streaming):', finalResponse);
                  setMessages(prev => [...prev, finalResponse]);
                }
              }
              break;

            default:
              console.log('Unhandled event type:', realtimeEvent.type);
              break;
          }
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
      setIsConnecting(false);
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

  const processAIResponse = useCallback((response: string) => {
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

    // Check for interview completion
    if (response.includes('[INTERVIEW_COMPLETE]')) {
      setInterviewState(prev => ({
        ...prev,
        stage: InterviewStage.COMPLETED
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
      if (isConnected) {
        disconnect();
      }
    };
  }, [isConnected, disconnect]);

  return {
    isConnected,
    isConnecting,
    error,
    messages,
    connect,
    disconnect,
    sendMessage,
    cleanup,
  };
};
