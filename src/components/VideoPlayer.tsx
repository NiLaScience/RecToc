import { useState, useEffect, useRef } from 'react';
import { IonIcon, IonButton, IonAvatar, IonSpinner } from '@ionic/react';
import { heart, chatbubble, share, informationCircleOutline, volumeHighOutline, volumeMuteOutline } from 'ionicons/icons';
import { VideoItem } from '../types/video';
import type { UserProfile } from '../types/user';
import SubtitleService from '../services/SubtitleService';
import { addSnapshotListener, removeSnapshotListener } from '../config/firebase';
import VideoDetails from './VideoDetails';

interface VideoPlayerProps {
  video: VideoItem;
  onSwipe?: (direction: 'up' | 'down') => void;
  autoPlay?: boolean;
  onEnded?: () => void;
  allowSwipe?: boolean;
  mode?: 'feed' | 'card' | 'modal' | 'details';
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

export default function VideoPlayer({ video, onSwipe, autoPlay = false, onEnded, allowSwipe = true, mode = 'feed' }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(autoPlay);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [mouseStart, setMouseStart] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');
  const [showDetails, setShowDetails] = useState(false);
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
    setShowDescription(false);
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
    // Only allow swipes in feed mode
    if (mode !== 'feed') return;
    
    const diffX = startPos.x - endPos.x;
    const diffY = startPos.y - endPos.y;

    // Check if the swipe is more horizontal than vertical
    if (Math.abs(diffX) > Math.abs(diffY)) {
      // Right swipe to open details (swipe left to right)
      if (diffX < -50 && !showDetails) {
        setShowDetails(true);
      }
      // Left swipe to close details (swipe right to left)
      else if (diffX > 50 && showDetails && !showApplication) {
        setShowDetails(false);
      }
    } else {
      // Only allow vertical swipes when details are not shown
      if (!showDetails && Math.abs(diffY) > 50 && onSwipe) {
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
        cursor: mode === 'feed' ? (isDragging ? 'grabbing' : 'grab') : 'default',
        overflow: 'hidden',
        touchAction: mode === 'feed' ? 'none' : 'auto'
      }}
      onTouchStart={mode === 'feed' ? handleTouchStart : undefined}
      onTouchEnd={mode === 'feed' ? handleTouchEnd : undefined}
      onMouseDown={mode === 'feed' ? handleMouseDown : undefined}
      onMouseMove={mode === 'feed' ? handleMouseMove : undefined}
      onMouseUp={mode === 'feed' ? handleMouseUp : undefined}
      onMouseLeave={mode === 'feed' ? handleMouseLeave : undefined}
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

      <video
        ref={videoRef}
        src={video.videoUrl}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          touchAction: mode === 'feed' ? 'none' : 'auto',
          opacity: videoLoading ? 0 : 1,
          transition: 'opacity 0.2s ease-in-out'
        }}
        onClick={togglePlay}
        playsInline
        muted={isMuted}
        onEnded={onEnded}
        poster={video.thumbnailUrl}
      />

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