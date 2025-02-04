import { useState, useEffect, useRef } from 'react';
import { IonIcon, IonButton, IonAvatar } from '@ionic/react';
import { heart, chatbubble, share, informationCircleOutline } from 'ionicons/icons';
import { VideoItem } from './Feed';
import { getFirestore, doc, onSnapshot, DocumentData } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { FirebaseFirestore } from '@capacitor-firebase/firestore';
import type { UserProfile } from '../types/user';
import type { AddDocumentSnapshotListenerCallbackEvent } from '@capacitor-firebase/firestore';

interface VideoPlayerProps {
  video: VideoItem;
  onSwipe?: (direction: 'up' | 'down') => void;
  autoPlay?: boolean;
}

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  padding: '1rem',
  background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)',
  color: 'white',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem'
};

const actionButtonsStyle: React.CSSProperties = {
  position: 'absolute',
  right: '1rem',
  bottom: '5rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  alignItems: 'center'
};

const userInfoStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem'
};

const userDescriptionStyle: React.CSSProperties = {
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  padding: '1rem',
  borderRadius: '0.5rem',
  marginTop: '0.5rem',
  fontSize: '0.875rem'
};

const tagsStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.5rem',
  marginTop: '0.5rem'
};

export default function VideoPlayer({ video, onSwipe, autoPlay = false }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [showDescription, setShowDescription] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setupProfileListener = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          await FirebaseFirestore.addDocumentSnapshotListener({
            reference: `/users/${video.userId}`,
          }, (event: AddDocumentSnapshotListenerCallbackEvent<DocumentData> | null) => {
            if (event?.snapshot?.data) {
              setUserProfile(event.snapshot.data as UserProfile);
            }
          });
        } else {
          const db = getFirestore();
          const docRef = doc(db, 'users', video.userId);
          unsubscribe = onSnapshot(docRef, (doc) => {
            if (doc.exists()) {
              setUserProfile(doc.data() as UserProfile);
            }
          });
        }
      } catch (error) {
        console.error('Error setting up profile listener:', error);
      }
    };

    setupProfileListener();

    return () => {
      if (Capacitor.isNativePlatform()) {
        FirebaseFirestore.removeAllListeners();
      } else if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [video.userId]);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart || !onSwipe) return;

    const touchEnd = e.changedTouches[0].clientY;
    const diff = touchStart - touchEnd;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        onSwipe('up');
      } else {
        onSwipe('down');
      }
    }

    setTouchStart(null);
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#000'
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <video
        ref={videoRef}
        src={video.videoUrl}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain'
        }}
        onClick={togglePlay}
        playsInline
        muted={autoPlay}
      />

      <div style={overlayStyle}>
        <div style={userInfoStyle}>
          <IonAvatar style={{ width: '40px', height: '40px' }}>
            <img
              src={userProfile?.photoURL || 'https://ionicframework.com/docs/img/demos/avatar.svg'}
              alt={userProfile?.displayName || 'User'}
            />
          </IonAvatar>
          <div>
            <div style={{ fontWeight: 600 }}>{userProfile?.displayName || 'Anonymous'}</div>
            <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>@{userProfile?.username || 'user'}</div>
          </div>
        </div>

        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{video.title}</h3>
          {video.tags && video.tags.length > 0 && (
            <div style={tagsStyle}>
              {video.tags.map(tag => (
                <span
                  key={tag}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '1rem',
                    fontSize: '0.875rem'
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {showDescription && userProfile?.description && (
          <div style={userDescriptionStyle}>
            {userProfile.description}
          </div>
        )}
      </div>

      <div style={actionButtonsStyle}>
        <IonButton fill="clear" color="light">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <IonIcon icon={heart} style={{ fontSize: '1.5rem' }} />
            <span style={{ fontSize: '0.75rem' }}>{video.likes}</span>
          </div>
        </IonButton>
        <IonButton fill="clear" color="light">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <IonIcon icon={chatbubble} style={{ fontSize: '1.5rem' }} />
            <span style={{ fontSize: '0.75rem' }}>0</span>
          </div>
        </IonButton>
        <IonButton fill="clear" color="light">
          <IonIcon icon={share} style={{ fontSize: '1.5rem' }} />
        </IonButton>
        <IonButton
          fill="clear"
          color="light"
          onClick={() => setShowDescription(!showDescription)}
        >
          <IonIcon icon={informationCircleOutline} style={{ fontSize: '1.5rem' }} />
        </IonButton>
      </div>
    </div>
  );
} 