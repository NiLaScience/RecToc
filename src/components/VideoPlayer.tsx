import { useState, useEffect, useRef } from 'react';
import { IonIcon, IonButton, IonAvatar, IonSpinner } from '@ionic/react';
import { volumeHighOutline, volumeMuteOutline } from 'ionicons/icons';
import { VideoItem } from '../types/video';
import type { UserProfile } from '../types/user';
import SubtitleService from '../services/SubtitleService';
import { addSnapshotListener, removeSnapshotListener } from '../config/firebase';
import VideoDetails from './VideoDetails';

interface VideoPlayerProps {
  video: VideoItem;
  onSwipe?: (direction: 'up' | 'down' | 'left' | 'right') => void;
  autoPlay?: boolean;
  onEnded?: () => void;
  allowSwipe?: boolean;
  mode?: 'feed' | 'card' | 'modal' | 'details';
}

const containerStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden'
};

const videoStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover'
};

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  padding: '1rem',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  zIndex: 15,
  pointerEvents: 'none' // Allow clicks to pass through to video
};

const interactiveStyle: React.CSSProperties = {
  pointerEvents: 'auto' // Re-enable pointer events for buttons and interactive elements
};

const upperLeftStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  width: '100%'
};

const upperRightStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.5rem',
  justifyContent: 'flex-end',
  maxWidth: '40%'
};

const lowerLeftStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  maxWidth: '60%',
  background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0) 100%)',
  padding: '1rem',
  borderRadius: '8px'
};

const actionButtonsStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem'
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

const tagContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.5rem',
  marginTop: '0.5rem',
  zIndex: 11,
  position: 'relative'
};

const tagStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
  color: '#fff',
  padding: '4px 12px',
  borderRadius: '16px',
  fontSize: '14px',
  display: 'inline-block'
};

export default function VideoPlayer({ video, onSwipe, autoPlay = false, onEnded, allowSwipe = true, mode = 'feed' }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(autoPlay);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [mouseStart, setMouseStart] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');
  const [showApplication, setShowApplication] = useState(false);
  const [videoLoading, setVideoLoading] = useState(true);
  const [thumbnailError, setThumbnailError] = useState(false);

  useEffect(() => {
    let callbackId: string;

    const setupProfileListener = async () => {
      try {
        callbackId = await addSnapshotListener(`users/${video.userId}`, (profileData) => {
          setUserProfile(profileData as UserProfile);
        });
      } catch (error) {
        console.error('Error setting up profile listener:', error);
      }
    };

    setupProfileListener();

    return () => {
      if (callbackId) {
        removeSnapshotListener(callbackId).catch(console.error);
      }
    };
  }, [video.userId]);

  useEffect(() => {
    if (videoRef.current && video.transcript?.segments) {
      const updateSubtitles = () => {
        const currentTime = videoRef.current?.currentTime || 0;
        const segment = video.transcript?.segments.find(
          seg => currentTime >= seg.start && currentTime <= seg.end
        );
        setCurrentSubtitle(segment?.text || '');
      };

      // Reset subtitle when video changes
      setCurrentSubtitle('');

      // Update subtitles every 100ms
      const intervalId = setInterval(updateSubtitles, 100);
      videoRef.current.addEventListener('seeking', updateSubtitles);

      return () => {
        clearInterval(intervalId);
        if (videoRef.current) {
          videoRef.current.removeEventListener('seeking', updateSubtitles);
        }
        // Clear subtitle when unmounting or changing video
        setCurrentSubtitle('');
      };
    }
    
    return () => {
      // Clear subtitle when video has no transcript
      setCurrentSubtitle('');
    };
  }, [video.id, video.transcript?.segments]); // Add video.id to dependencies

  // Reset state when video changes
  useEffect(() => {
    setIsPlaying(autoPlay);
    setIsMuted(autoPlay);
    setShowDetails(false);
    setCurrentSubtitle('');
  }, [video.id, autoPlay]);

  useEffect(() => {
    const fabElement = document.querySelector('ion-fab[data-feed-toggle]') as HTMLElement;
    if (fabElement) {
      if (showDetails) {
        fabElement.style.display = 'none';
      } else {
        fabElement.style.display = 'block';
      }
    }
  }, [showDetails]);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (videoRef.current && autoPlay) {
      setIsPlaying(true);
      videoRef.current.play().catch(error => {
        console.error('Error auto-playing video:', error);
      });
    }
  }, [video.videoUrl, autoPlay]);

  useEffect(() => {
    if (mode === 'details' && videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [mode]);

  useEffect(() => {
    if (showDetails && videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [showDetails]);

  useEffect(() => {
    if (videoRef.current) {
      const handleLoadStart = () => setVideoLoading(true);
      const handleCanPlay = () => setVideoLoading(false);
      const handleError = () => setVideoLoading(false);

      videoRef.current.addEventListener('loadstart', handleLoadStart);
      videoRef.current.addEventListener('canplay', handleCanPlay);
      videoRef.current.addEventListener('error', handleError);

      return () => {
        if (videoRef.current) {
          videoRef.current.removeEventListener('loadstart', handleLoadStart);
          videoRef.current.removeEventListener('canplay', handleCanPlay);
          videoRef.current.removeEventListener('error', handleError);
        }
      };
    }
  }, []);

  const handleSwipeGesture = (startPos: { x: number; y: number }, endPos: { x: number; y: number }) => {
    // Only allow swipes in feed mode and details mode
    if (mode !== 'feed' && mode !== 'details') return;
    
    const diffX = startPos.x - endPos.x;
    const diffY = startPos.y - endPos.y;
    const SWIPE_THRESHOLD = 50;

    // Check if the swipe is more horizontal than vertical
    if (Math.abs(diffX) > Math.abs(diffY)) {
      // Right swipe (swipe left to right)
      if (diffX < -SWIPE_THRESHOLD) {
        if (!showDetails && onSwipe) {
          setShowDetails(true);
          onSwipe('right');
        }
      }
      // Left swipe (swipe right to left)
      else if (diffX > SWIPE_THRESHOLD) {
        if (showDetails && !showApplication) {
          setShowDetails(false);
        } else if (!showDetails && onSwipe) {
          onSwipe('left');
        }
      }
    } else {
      // Only allow vertical swipes when details are not shown
      if (!showDetails && Math.abs(diffY) > SWIPE_THRESHOLD && onSwipe) {
        if (diffY > 0) {
          onSwipe('up');
        } else {
          onSwipe('down');
        }
      }
    }
  };

  // Touch event handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;

    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY
    };

    handleSwipeGesture(touchStart, touchEnd);
    setTouchStart(null);
  };

  // Mouse event handlers for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    setMouseStart({
      x: e.clientX,
      y: e.clientY
    });
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !mouseStart) return;

    // Prevent text selection during drag
    e.preventDefault();
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!mouseStart || !isDragging) return;

    const mouseEnd = {
      x: e.clientX,
      y: e.clientY
    };

    handleSwipeGesture(mouseStart, mouseEnd);
    setMouseStart(null);
    setIsDragging(false);
  };

  // Handle mouse leaving the element
  const handleMouseLeave = () => {
    setMouseStart(null);
    setIsDragging(false);
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      setIsMuted(!isMuted);
      videoRef.current.muted = !isMuted;
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        cursor: (mode === 'feed' || mode === 'details') ? (isDragging ? 'grabbing' : 'grab') : 'default',
        overflow: 'hidden',
        touchAction: (mode === 'feed' || mode === 'details') ? 'none' : 'auto'
      }}
      onTouchStart={(mode === 'feed' || mode === 'details') ? handleTouchStart : undefined}
      onTouchEnd={(mode === 'feed' || mode === 'details') ? handleTouchEnd : undefined}
      onMouseDown={(mode === 'feed' || mode === 'details') ? handleMouseDown : undefined}
      onMouseMove={(mode === 'feed' || mode === 'details') ? handleMouseMove : undefined}
      onMouseUp={(mode === 'feed' || mode === 'details') ? handleMouseUp : undefined}
      onMouseLeave={(mode === 'feed' || mode === 'details') ? handleMouseLeave : undefined}
    >
      {/* Show thumbnail while video is loading */}
      {videoLoading && video.thumbnailUrl && !thumbnailError && (
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            backgroundColor: '#000',
            zIndex: 1
          }}
          onError={() => setThumbnailError(true)}
        />
      )}

      {/* Loading spinner */}
      {videoLoading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 2
        }}>
          <IonSpinner />
        </div>
      )}

      <div style={containerStyle}>
        <video
          ref={videoRef}
          src={video.videoUrl}
          style={{
            ...videoStyle,
            touchAction: (mode === 'feed' || mode === 'details') ? 'none' : 'auto',
            opacity: videoLoading ? 0 : 1,
            transition: 'opacity 0.2s ease-in-out'
          }}
          onClick={togglePlay}
          playsInline
          muted={isMuted}
          onEnded={onEnded}
          poster={video.thumbnailUrl}
        />

        <div style={{
          ...overlayStyle,
          paddingTop: mode === 'feed' ? '4rem' : '1rem',
          paddingBottom: mode === 'feed' ? '4rem' : '1rem'
        }}>
          <div style={upperLeftStyle}>
            {/* Title in upper left */}
            <div style={{ 
              maxWidth: '60%',
              ...interactiveStyle
            }}>
              <p style={{ 
                margin: 0, 
                fontSize: '1.1rem', 
                fontWeight: 'bold',
                color: 'white',
                textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                padding: '8px 12px',
                borderRadius: '8px',
                display: 'inline-block'
              }}>
                {video.title}
              </p>
            </div>

            {/* Tags in upper right */}
            {Array.isArray(video.tags) && video.tags.length > 0 && (
              <div style={{
                ...upperRightStyle,
                ...interactiveStyle
              }}>
                {video.tags.map((tag, index) => (
                  <span key={index} style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    color: '#fff',
                    padding: '4px 12px',
                    borderRadius: '16px',
                    fontSize: '14px',
                    display: 'inline-block',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            width: '100%'
          }}>
            {/* Profile info in lower left */}
            <div style={{
              ...lowerLeftStyle,
              ...interactiveStyle
            }}>
              <IonAvatar style={{ width: '2.5rem', height: '2.5rem', flexShrink: 0 }}>
                <img 
                  src={userProfile?.photoURL || 'https://ionicframework.com/docs/img/demos/avatar.svg'} 
                  alt="Profile" 
                />
              </IonAvatar>
              <div>
                <p style={{ margin: 0, fontWeight: 'bold', color: 'white' }}>{userProfile?.displayName || 'User'}</p>
                {userProfile?.description && (
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', opacity: 0.8, color: 'white' }}>
                    {userProfile.description}
                  </p>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{
              ...actionButtonsStyle,
              ...interactiveStyle
            }}>
              <IonButton
                fill="clear"
                color="light"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMute();
                }}
              >
                <IonIcon icon={isMuted ? volumeMuteOutline : volumeHighOutline} />
              </IonButton>
              {video.transcript && (
                <IonButton
                  fill="clear"
                  color="light"
                  onClick={() => setSubtitlesEnabled(!subtitlesEnabled)}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ 
                      fontSize: '1.2rem', 
                      fontWeight: 'bold',
                      opacity: subtitlesEnabled ? 1 : 0.5 
                    }}>
                      CC
                    </span>
                  </div>
                </IonButton>
              )}
            </div>
          </div>
        </div>

        {subtitlesEnabled && currentSubtitle && (
          <div style={{
            position: 'absolute',
            bottom: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '4px',
            maxWidth: '80%',
            textAlign: 'center',
            fontSize: '1rem',
            fontWeight: '500',
            zIndex: 10
          }}>
            {currentSubtitle}
          </div>
        )}
      </div>

      {showDetails && (
        <VideoDetails
          video={video}
          onClose={() => setShowDetails(false)}
          onApplicationModalChange={(isOpen) => setShowApplication(isOpen)}
        />
      )}

      <style>{`
        video::cue {
          background-color: rgba(0, 0, 0, 0.7);
          color: white;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 1.2rem;
          line-height: 1.4;
          padding: 0.2em 0.5em;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}