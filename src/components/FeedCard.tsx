import { VideoItem } from './Feed';
import { IonCard, IonCardHeader, IonCardContent, IonChip, IonLabel, IonAvatar, IonButton, IonIcon } from '@ionic/react';
import { useState, useEffect } from 'react';
import { getFirestore, doc, onSnapshot, DocumentData } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { FirebaseFirestore } from '@capacitor-firebase/firestore';
import { informationCircleOutline } from 'ionicons/icons';
import type { UserProfile } from '../types/user';
import type { AddDocumentSnapshotListenerCallbackEvent } from '@capacitor-firebase/firestore';
import VideoPlayer from './VideoPlayer';

interface FeedCardProps {
  video: VideoItem;
}

const cardStyle: React.CSSProperties = {
  marginBottom: '1rem',
  backgroundColor: 'white',
  borderRadius: '12px',
  border: '1px solid #e5e7eb',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  overflow: 'hidden'
};

const headerStyle: React.CSSProperties = {
  padding: '1rem',
  borderBottom: '1px solid #e5e7eb'
};

const contentStyle: React.CSSProperties = {
  padding: '1rem'
};

const tagsContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.5rem',
  marginTop: '0.5rem'
};

const videoContainerStyle: React.CSSProperties = {
  width: '100%',
  aspectRatio: '16/9',
  backgroundColor: '#f3f4f6',
  marginTop: '1rem',
  borderRadius: '8px',
  overflow: 'hidden',
  position: 'relative'
};

const userInfoStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  marginBottom: '1rem'
};

const userDescriptionStyle: React.CSSProperties = {
  padding: '1rem',
  backgroundColor: '#f9fafb',
  borderRadius: '0.5rem',
  marginTop: '1rem',
  fontSize: '0.875rem',
  color: '#4b5563'
};

export default function FeedCard({ video }: FeedCardProps) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showDescription, setShowDescription] = useState(false);

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

  return (
    <IonCard style={cardStyle}>
      <IonCardHeader style={headerStyle}>
        <div style={userInfoStyle}>
          <IonAvatar style={{ width: '40px', height: '40px' }}>
            <img
              src={userProfile?.photoURL || 'https://ionicframework.com/docs/img/demos/avatar.svg'}
              alt={userProfile?.displayName || 'User'}
            />
          </IonAvatar>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{userProfile?.displayName || 'Anonymous'}</div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>@{userProfile?.username || 'user'}</div>
          </div>
          <IonButton
            fill="clear"
            onClick={() => setShowDescription(!showDescription)}
          >
            <IonIcon icon={informationCircleOutline} />
          </IonButton>
        </div>

        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, color: '#111827' }}>
          {video.title}
        </h2>
        {video.tags && video.tags.length > 0 && (
          <div style={tagsContainerStyle}>
            {video.tags.map((tag) => (
              <IonChip key={tag} outline>
                <IonLabel>{tag}</IonLabel>
              </IonChip>
            ))}
          </div>
        )}

        {showDescription && userProfile?.description && (
          <div style={userDescriptionStyle}>
            {userProfile.description}
          </div>
        )}
      </IonCardHeader>

      <IonCardContent style={contentStyle}>
        <div style={videoContainerStyle}>
          <VideoPlayer
            video={video}
            autoPlay={false}
          />
        </div>
        <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', color: '#6b7280' }}>
          <span>{video.views} views</span>
          <span>•</span>
          <span>{video.likes} likes</span>
        </div>
      </IonCardContent>
    </IonCard>
  );
} 