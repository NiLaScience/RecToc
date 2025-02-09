import { useState, useEffect, useRef, useCallback } from 'react';

interface RealtimeMessage {
  type: string;
  timestamp?: string;
  isUser: boolean;
  text?: string;
  transcript?: string;
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

  const connect = useCallback(async () => {
    try {
      setIsConnecting(true);
      setError(null);

      // Get ephemeral token
      const tokenResponse = await fetch("/api/realtime");
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        throw new Error(errorData.error || 'Failed to get ephemeral token');
      }
      
      const data = await tokenResponse.json();
      
      if (!data.client_secret?.value) {
        throw new Error('Invalid token response from server');
      }

      const EPHEMERAL_KEY = data.client_secret.value;

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

      // Add local audio track
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: true
        });
        pc.addTrack(mediaStream.getTracks()[0]);
      } catch (mediaError) {
        console.warn('Could not access microphone:', mediaError);
        // Continue without microphone access
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
                language: "en"
              },
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 200,
                create_response: true,
              }
            }
          };

          console.log('Sending session config:', sessionConfig);
          dc.send(JSON.stringify(sessionConfig));

          // Then, if we have resume data, send it as a system message
          if (resumeData) {
            const formatResumeForInstructions = (resume: ResumeData) => {
              const experienceSection = resume.experience.map(exp => 
                `- ${exp.title} at ${exp.company} (${exp.startDate} to ${exp.endDate || 'Present'})
                   ${exp.description}`
              ).join('\n');

              const educationSection = resume.education.map(edu =>
                `- ${edu.degree} in ${edu.field} from ${edu.school}, graduated ${edu.graduationDate}`
              ).join('\n');

              const skillsSection = `Skills: ${resume.skills.join(', ')}`;

              return `
Here is the candidate's resume:

Experience:
${experienceSection}

Education:
${educationSection}

${skillsSection}

You are an AI interviewer. Use this resume information to conduct a professional job interview. 
Ask relevant questions about the candidate's experience, skills, and education.
Keep your responses concise and focused on the interview context.
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
                    text: formatResumeForInstructions(resumeData)
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
              // Only show the final message when it's complete
              if (currentResponseRef.current) {
                currentResponseRef.current.isComplete = true;
                const finalText = realtimeEvent.response?.output?.[0]?.content?.[0]?.text || currentResponseRef.current.text;
                const finalResponse = {
                  type: 'response.done',
                  text: finalText,
                  timestamp: currentResponseRef.current.timestamp,
                  isUser: false
                };
                console.log('Final response:', finalResponse);
                setMessages(prev => [...prev, finalResponse]);
                currentResponseRef.current = null;
              } else {
                // Handle case where we get response.done without a current response
                const finalText = realtimeEvent.response?.output?.[0]?.content?.[0]?.text;
                if (finalText) {
                  const finalResponse = {
                    type: 'response.done',
                    text: finalText,
                    timestamp: realtimeEvent.timestamp || new Date().toISOString(),
                    isUser: false
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
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
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
  }, [resumeData]);

  const disconnect = useCallback(() => {
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (audioElementRef.current) {
      const tracks = audioElementRef.current.srcObject as MediaStream;
      tracks?.getTracks().forEach(track => track.stop());
      audioElementRef.current.srcObject = null;
    }
    setIsConnected(false);
    setMessages([]);
  }, []);

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
            modalities: message.response.modalities || ["text"]
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

  // Remove the duplicate event handler
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isConnecting,
    error,
    messages,
    connect,
    disconnect,
    sendMessage,
  };
};
