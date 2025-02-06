import { VideoItem } from '../types/video';
import { IonCard, IonCardHeader, IonCardContent, IonChip, IonLabel, IonAvatar, IonButton, IonIcon, IonSpinner } from '@ionic/react';
import { useState, useEffect } from 'react';
import { informationCircleOutline, playCircleOutline, videocamOutline } from 'ionicons/icons';
import type { UserProfile } from '../types/user';
import VideoPlayer from './VideoPlayer';
import { addSnapshotListener, removeSnapshotListener } from '../config/firebase';

interface FeedCardProps {
  video: VideoItem;
  onClick?: () => void;
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

export default function FeedCard({ video, onClick }: FeedCardProps) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showDescription, setShowDescription] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);
  const [thumbnailLoading, setThumbnailLoading] = useState(true);

  useEffect(() => {
    let callbackId: string;

    const setupProfileListener = async () => {
      try {
        callbackId = await addSnapshotListener(`users/${video.userId}`, (profileData) => {
          if (profileData) {
            // Transform the data to match UserProfile structure
            const profile = {
              id: video.userId,
              ...(typeof profileData === 'object' && 'data' in profileData ? profileData.data : profileData)
            } as UserProfile;
            setUserProfile(profile);
          }
        });
      } catch (error) {
        console.error('Error setting up profile listener:', error);
      }
    };

    if (video.userId) {
      setupProfileListener();
    }

    return () => {
      if (callbackId) {
        removeSnapshotListener(callbackId).catch(console.error);
      }
    };
  }, [video.userId]);

  const handleVideoClick = () => {
    if (onClick) {
      onClick();
    } else if (video.videoUrl) {
      setIsPlaying(!isPlaying);
    }
  };

  if (!video) return null;

  return (
    <IonCard style={cardStyle}>
      <IonCardHeader style={headerStyle}>
        <div style={userInfoStyle}>
          <IonAvatar style={{ width: '40px', height: '40px' }}>
            <img
              src={userProfile?.photoURL || 'https://ionicframework.com/docs/img/demos/avatar.svg'}
              alt={userProfile?.displayName || 'User'}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'https://ionicframework.com/docs/img/demos/avatar.svg';
              }}
            />
          </IonAvatar>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{userProfile?.displayName || 'Anonymous'}</div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>@{userProfile?.username || 'user'}</div>
          </div>
          {userProfile?.description && (
            <IonButton
              fill="clear"
              onClick={() => setShowDescription(!showDescription)}
            >
              <IonIcon icon={informationCircleOutline} />
            </IonButton>
          )}
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
        <div 
          style={videoContainerStyle}
          onClick={handleVideoClick}
        >
          {isPlaying && video.videoUrl ? (
            <VideoPlayer
              video={video}
              autoPlay={true}
              mode="card"
            />
          ) : (
            <>
              {/* Show thumbnail with play button overlay */}
              {video.thumbnailUrl && !thumbnailError ? (
                <img
                  src={video.thumbnailUrl}
                  alt={video.title}
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover',
                    opacity: thumbnailLoading ? 0 : 1,
                    transition: 'opacity 0.2s ease-in-out'
                  }}
                  onLoad={() => setThumbnailLoading(false)}
                  onError={() => {
                    setThumbnailError(true);
                    setThumbnailLoading(false);
                  }}
                />
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#f3f4f6',
                  color: '#9ca3af'
                }}>
                  <IonIcon
                    icon={videocamOutline}
                    style={{ fontSize: '3rem' }}
                  />
                </div>
              )}
              {thumbnailLoading && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#f3f4f6'
                }}>
                  <IonSpinner />
                </div>
              )}
              {video.videoUrl && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                  borderRadius: '50%',
                  padding: '1rem',
                  cursor: 'pointer'
                }}>
                  <IonIcon
                    icon={playCircleOutline}
                    style={{
                      fontSize: '2rem',
                      color: 'white'
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>
        <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', color: '#6b7280' }}>
          <span>{video.views || 0} views</span>
          <span>•</span>
          <span>{video.likes || 0} likes</span>
        </div>
      </IonCardContent>
    </IonCard>
  );
} 