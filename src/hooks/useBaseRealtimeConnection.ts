import { useState, useEffect, useRef, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { ensureInitialized, callFunction } from '../config/firebase';
import { Capacitor } from '@capacitor/core';

export type SessionStatus = "DISCONNECTED" | "CONNECTING" | "CONNECTED";

export interface RealtimeMessage {
  type: string;
  timestamp?: string;
  isUser: boolean;
  text?: string;
  transcript?: string;
  [key: string]: any;
}

export interface ServerEvent {
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

interface UseBaseRealtimeConnectionProps {
  onSessionConfig?: () => any;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
  onMessage?: (message: RealtimeMessage) => void;
  onEvent?: (event: ServerEvent) => void;
}

export const useBaseRealtimeConnection = ({
  onSessionConfig,
  onConnect,
  onDisconnect,
  onError,
  onMessage,
  onEvent,
}: UseBaseRealtimeConnectionProps = {}) => {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("DISCONNECTED");
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

  const cleanup = useCallback(() => {
    // Clear all state
    setMessages([]);
    setError(null);
    setSessionStatus("DISCONNECTED");

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

    onDisconnect?.();
  }, [onDisconnect]);

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
          const errorMsg = 'Connection failed. Please try again.';
          setError(errorMsg);
          onError?.(errorMsg);
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
        setError(null);
        onConnect?.();

        try {
          // Let the consumer configure the session
          const sessionConfig = onSessionConfig?.() || {
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
                create_response: true
              }
            }
          };

          console.log('Sending session config:', sessionConfig);
          dc.send(JSON.stringify(sessionConfig));
        } catch (err) {
          console.error('Failed to send session config:', err);
          const errorMsg = 'Failed to configure session';
          setError(errorMsg);
          onError?.(errorMsg);
          disconnect();
        }
      };

      dc.onmessage = (e) => {
        try {
          const event: ServerEvent = JSON.parse(e.data);
          console.log('Received event:', event);
          onEvent?.(event);

          if (event.error) {
            const errorMsg = event.error.message || 'Unknown error occurred';
            setError(errorMsg);
            onError?.(errorMsg);
            return;
          }

          // Handle different event types
          switch (event.type) {
            case 'session.created':
            case 'session.updated':
              // After session is ready, notify consumer
              if (!sessionStatus.includes('CONNECTED')) {
                setSessionStatus("CONNECTED");
                onConnect?.();
              }
              break;

            case 'response.chunk':
              if (event.delta) {
                if (!currentResponseRef.current) {
                  currentResponseRef.current = {
                    text: event.delta,
                    timestamp: new Date().toISOString(),
                    responseId: event.event_id,
                    isComplete: false
                  };
                } else {
                  currentResponseRef.current.text += event.delta;
                }
              }
              break;

            case 'response.done':
              if (currentResponseRef.current) {
                const message: RealtimeMessage = {
                  timestamp: currentResponseRef.current.timestamp,
                  isUser: false,
                  text: currentResponseRef.current.text,
                  ...event
                };
                setMessages(prev => [...prev, message]);
                onMessage?.(message);
                currentResponseRef.current = null;
              }
              break;

            case 'transcript.partial':
            case 'transcript.final':
              const message: RealtimeMessage = {
                isUser: true,
                timestamp: new Date().toISOString(),
                ...event,
                // Add any additional transcript-specific handling if needed
              };
              setMessages(prev => [...prev, message]);
              onMessage?.(message);
              if (event.type === 'transcript.final') {
                // Automatically request a response when the user's turn is complete
                if (dataChannelRef.current?.readyState === 'open') {
                  dataChannelRef.current.send(JSON.stringify({
                    type: 'response.create',
                    response: {
                      modalities: ["text", "audio"]
                    }
                  }));
                }
              }
              break;
          }
        } catch (err) {
          console.error('Error processing message:', err, e.data);
        }
      };

      // Create and send offer
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
      console.error('Connection failed:', err);
      const errorMsg = 'Failed to establish connection';
      setError(errorMsg);
      onError?.(errorMsg);
      disconnect();
    }
  }, [cleanup, disconnect, onConnect, onError, onMessage, onEvent, onSessionConfig]);

  const sendMessage = useCallback((message: RealtimeMessage) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      // Create a copy of the message without isUser
      const { isUser, ...apiMessage } = message;
      dataChannelRef.current.send(JSON.stringify(apiMessage));
      // Keep isUser in the message for internal handling
      setMessages(prev => [...prev, message]);
      onMessage?.(message);
    }
  }, [onMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    sessionStatus,
    error,
    messages,
    connect,
    disconnect,
    sendMessage,
  };
};
