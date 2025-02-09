import { IonText } from '@ionic/react';
import React, { useMemo } from 'react';

interface Message {
  type: string;
  text?: string;
  transcript?: string;
  timestamp?: string;
  isUser: boolean;
}

interface ChatMessageProps {
  message: Message;
  isUser: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isUser }) => {
  console.log('Rendering message:', message);

  const formattedTime = useMemo(() => {
    if (!message.timestamp) return '';
    return new Date(message.timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  }, [message.timestamp]);

  const getMessageContent = () => {
    switch (message.type) {
      case 'conversation.item.input_audio_transcription.completed':
        if (!message.transcript?.trim()) {
          return null;
        }
        return message.transcript;
      case 'response.done':
      case 'response.audio_transcript.done':
        if (!message.text?.trim()) {
          return null;
        }
        return message.text;
      default:
        return null;
    }
  };

  const content = getMessageContent();
  
  if (!content) {
    return null;
  }

  const messageIsUser = message.isUser ?? isUser;

  return (
    <div 
      className={`chat-message ${messageIsUser ? 'user' : 'assistant'}`}
      data-message-type={message.type}
    >
      <div className="message-content">
        <div className="message-bubble">
          <IonText>{content}</IonText>
        </div>
        {formattedTime && (
          <div className="message-time">
            {formattedTime}
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(ChatMessage);
