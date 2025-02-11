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
  name?: string;
  arguments?: Record<string, any>;
  session?: {
    id?: string;
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
      type?: string;
      name?: string;
      arguments?: string;
      call_id?: string;
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
    status_details?: {
      error?: any;
    };
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

  // Buffer for accumulating partial text from "response.audio_transcript.delta"
  const currentResponseRef = useRef<{
    text: string;
    timestamp: string;
    responseId?: string;
    messageId?: string;
    isComplete: boolean;
  } | null>(null);

  const cleanup = useCallback(() => {
    setMessages([]);
    setError(null);
    setSessionStatus("DISCONNECTED");

    // Clear partial response buffer
    currentResponseRef.current = null;
    
    // Close data channel and peer connection
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

      // (Optional) add a timeout to guard against long session creation
      const sessionTimeout = setTimeout(() => {
        if (sessionStatus === "CONNECTING") {
          const errorMsg = 'Session creation timed out';
          setError(errorMsg);
          onError?.(errorMsg);
          disconnect();
        }
      }, 10000);

      await ensureInitialized();
      
      // Get ephemeral token from your Firebase function
      let token: string;
      if (Capacitor.isNativePlatform()) {
        const result = await callFunction('generateRealtimeToken') as { token: string };
        token = result.token;
      } else {
        const functions = getFunctions();
        const generateToken = httpsCallable(functions, 'generateRealtimeToken');
        const result = await generateToken({});
        token = (result.data as { token: string }).token;
      }

      if (!token) {
        throw new Error('Invalid token response from server');
      }

      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      pc.ontrack = (e) => {
        if (!audioElementRef.current) {
          audioElementRef.current = document.createElement("audio");
          audioElementRef.current.autoplay = true;
        }
        audioElementRef.current.srcObject = e.streams[0];
      };

      // Basic error handling for ICE
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed') {
          const errorMsg = 'Connection failed.';
          setError(errorMsg);
          onError?.(errorMsg);
          disconnect();
        }
      };

      // Acquire user audio
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
        throw new Error('Failed to set up audio');
      }

      // DataChannel
      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;

      dc.onopen = () => {
        clearTimeout(sessionTimeout);
        setSessionStatus("CONNECTED");
        setError(null);

        // Send any sessionConfig if provided
        if (onSessionConfig) {
          const config = onSessionConfig();
          dc.send(JSON.stringify(config));
        }
        onConnect?.();
      };

      dc.onclose = () => {
        setSessionStatus("DISCONNECTED");
      };

      dc.onerror = (err) => {
        console.error('Data channel error:', err);
        setError(err.error?.message || 'Unknown DC error');
      };

      dc.onmessage = (e: MessageEvent) => {
        let serverEvent: ServerEvent;
        try {
          serverEvent = JSON.parse(e.data);
        } catch (err) {
          console.error('Failed to parse server message:', e.data);
          return;
        }

        // If there's an error in the event
        if (serverEvent.error?.message) {
          setError(serverEvent.error?.message);
          onError?.(serverEvent.error?.message);
        }

        // Let consumer see every event
        onEvent?.(serverEvent);

        switch (serverEvent.type) {
          case 'session.created':
            // Session is established
            setSessionStatus("CONNECTED");
            break;

          // Partial TTS text from the agent
          case 'response.audio_transcript.delta':
            if (serverEvent.delta) {
              if (!currentResponseRef.current) {
                currentResponseRef.current = {
                  text: serverEvent.delta,
                  timestamp: new Date().toISOString(),
                  isComplete: false,
                };
              } else {
                currentResponseRef.current.text += serverEvent.delta;
              }
            }
            break;

          // The final turn is done
          case 'response.done': {
            // If there's partial text
            if (currentResponseRef.current) {
              currentResponseRef.current.isComplete = true;
              const finalText =
                serverEvent.response?.output?.[0]?.content?.[0]?.text ||
                currentResponseRef.current.text;

              const finalMsg: RealtimeMessage = {
                type: "assistant_message",
                timestamp: currentResponseRef.current.timestamp,
                isUser: false,
                text: finalText,
              };
              setMessages((prev) => [...prev, finalMsg]);
              onMessage?.(finalMsg);
              currentResponseRef.current = null;
            }

            // Check if the model produced any function calls
            const outputItems = serverEvent.response?.output || [];
            outputItems.forEach((output) => {
              if (output.type === "function_call" && output.name) {
                let parsedArgs: any;
                try {
                  parsedArgs = JSON.parse(output.arguments || "{}");
                } catch {
                  parsedArgs = {};
                }

                // Fire a synthetic 'function_call' event so higher-level hooks can handle it
                const functionCallEvent: ServerEvent = {
                  type: "function_call",
                  name: output.name,
                  arguments: parsedArgs,
                };
                onEvent?.(functionCallEvent);
              }
            });
            break;
          }

          // Transcribed user input
          case 'conversation.item.input_audio_transcription.completed':
            if (serverEvent.transcript) {
              const userMsg: RealtimeMessage = {
                type: "user_message",
                timestamp: new Date().toISOString(),
                isUser: true,
                text: serverEvent.transcript,
              };
              setMessages((prev) => [...prev, userMsg]);
              onMessage?.(userMsg);
            }
            break;

          default:
            // Possibly handle other events
            break;
        }
      };

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Post to Realtime endpoint
      const baseUrl = "https://api.openai.com/v1/realtime";
      const model = "gpt-4o-realtime-preview-2024-12-17";

      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!sdpResponse.ok) {
        throw new Error('Failed to create session with OpenAI Realtime.');
      }

      const answerSdp = await sdpResponse.text();
      const answer: RTCSessionDescriptionInit = { type: "answer", sdp: answerSdp };
      await pc.setRemoteDescription(answer);

    } catch (err) {
      console.error('Connection failed:', err);
      const errMsg = err instanceof Error ? err.message : 'Unknown connect error';
      setError(errMsg);
      onError?.(errMsg);
      disconnect();
    }
  }, [disconnect, onConnect, onDisconnect, onError, onEvent, onSessionConfig, sessionStatus]);

  const sendMessage = useCallback((message: RealtimeMessage) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      setMessages((prev) => [...prev, message]);
      onMessage?.(message);

      dataChannelRef.current.send(JSON.stringify(message));
    } else {
      console.warn('No open data channel. Cannot send message.');
    }
  }, [onMessage]);

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
