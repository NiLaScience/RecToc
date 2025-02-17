import React, { useState, useRef, useEffect } from 'react';
import type { JobOpening } from '../types/job_opening';
import { IonIcon } from '@ionic/react';
import {
  volumeHighOutline,
  volumeMuteOutline,
  playCircleOutline,
  pauseCircleOutline
} from 'ionicons/icons';
import { FirebaseStorage } from '@capacitor-firebase/storage';

interface JobPresentationProps {
  job: JobOpening;
  mode?: 'feed' | 'card' | 'modal' | 'details';
  currentSlideIndex?: number;
  onSlideChange?: (index: number) => void;
  onNextJob?: () => void;
  onPreviousJob?: () => void;
  onReject?: () => void;
  onShowDetails?: () => void;
  onEnded?: () => void;
  autoPlay?: boolean;
}

const JobPresentation: React.FC<JobPresentationProps> = ({
  job,
  mode = 'feed',
  currentSlideIndex = 0,
  onSlideChange,
  onNextJob,
  onPreviousJob,
  onReject,
  onShowDetails,
  onEnded,
  autoPlay = true
}) => {
  // Playback state
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(false); // Default to unmuted since we'll control via play/pause
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioEnded, setAudioEnded] = useState(false);

  // Image state
  const [slideImageUrls, setSlideImageUrls] = useState<(string | null)[]>([]);
  const [imageErrors, setImageErrors] = useState<boolean[]>([]);

  // Gesture state
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [mouseStart, setMouseStart] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  // When job changes, reset playback and mute states
  useEffect(() => {
    setIsPlaying(autoPlay);
    setIsMuted(false);
  }, [job.id, autoPlay]);

  // Handle video playback
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(console.error);
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  // Get authenticated URLs for slide images
  useEffect(() => {
    const loadSlideImages = async () => {
      const urls = await Promise.all(
        job.slides.map(async (slide, index) => {
          if (imageErrors[index]) return null;
          if (!slide.backgroundImageUrl) return null;

          try {
            // If the URL is already a full URL (e.g., from DALL-E), use it directly
            if (slide.backgroundImageUrl.startsWith('http')) {
              return slide.backgroundImageUrl;
            }

            // Otherwise, get an authenticated URL from Firebase Storage
            const result = await FirebaseStorage.getDownloadUrl({
              path: slide.backgroundImageUrl
            });
            return result.downloadUrl;
          } catch (error) {
            console.error(`Error getting authenticated URL for slide ${index}:`, error);
            setImageErrors(prev => {
              const newErrors = [...prev];
              newErrors[index] = true;
              return newErrors;
            });
            return null;
          }
        })
      );
      setSlideImageUrls(urls);
    };

    // Initialize error state for new slides
    setImageErrors(new Array(job.slides.length).fill(false));
    loadSlideImages();
  }, [job.slides]);

  // Reset audio when job changes
  useEffect(() => {
    if (audioRef.current && !job.videoUrl) {
      audioRef.current.currentTime = 0;
      setAudioEnded(false);
      if (autoPlay) {
        audioRef.current.play().catch(console.error);
        setIsPlaying(true);
      }
    }
  }, [job.id, autoPlay]);

  // Handle play/pause
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(console.error);
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  // Handle audio end
  const handleAudioEnd = () => {
    setAudioEnded(true);
    setIsPlaying(false);
  };

  const handleRestartAudio = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setAudioEnded(false);
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  /**
   * Update background color feedback for horizontal swipes.
   * If diffX > threshold, user is dragging to the right => 'right' (green).
   * If diffX < -threshold, user is dragging to the left => 'left' (red).
   * Else null => no color overlay.
   */
  const updateSwipeDirection = (diffX: number) => {
    const threshold = 20; // smaller threshold for partial color
    if (diffX > threshold) {
      setSwipeDirection('right'); // swiping right (show details)
    } else if (diffX < -threshold) {
      setSwipeDirection('left'); // swiping left (reject)
    } else {
      setSwipeDirection(null);
    }
  };

  /**
   * Interprets the final X/Y difference to determine swipe direction:
   * - Left / Right (if abs(diffX) > abs(diffY) and distance > 50)
   * - Up / Down (otherwise, if distance > 50)
   */
  const handleSwipeGesture = (
    startPos: { x: number; y: number },
    endPos: { x: number; y: number }
  ) => {
    if (mode !== 'feed' && mode !== 'details') return;

    const diffX = startPos.x - endPos.x;
    const diffY = startPos.y - endPos.y;
    const SWIPE_THRESHOLD = 50;

    // Horizontal vs vertical
    if (Math.abs(diffX) > Math.abs(diffY)) {
      // Left swipe (reject)
      if (diffX > SWIPE_THRESHOLD) {
        onReject?.();
      }
      // Right swipe (show details)
      else if (diffX < -SWIPE_THRESHOLD) {
        onShowDetails?.();
      }
    } else {
      // Up swipe (previous job)
      if (diffY > SWIPE_THRESHOLD) {
        onPreviousJob?.();
      }
      // Down swipe (next job)
      else if (diffY < -SWIPE_THRESHOLD) {
        onNextJob?.();
      }
    }
  };

  /**
   * MOBILE TOUCH EVENTS
   */
  const handleTouchStart = (e: React.TouchEvent) => {
    if (mode !== 'feed' && mode !== 'details') return; // only handle swipes in feed/details
    setTouchStart({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    });
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (mode !== 'feed' && mode !== 'details') return;
    if (!touchStart) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStart.x;
    const diffY = currentY - touchStart.y;

    // Limit the drag distance
    const maxDrag = 100;
    const boundedX = Math.max(Math.min(diffX, maxDrag), -maxDrag);
    const boundedY = Math.max(Math.min(diffY, maxDrag), -maxDrag);

    // If we cross a small threshold, consider it a drag
    if (!isDragging && (Math.abs(diffX) > 20 || Math.abs(diffY) > 20)) {
      setIsDragging(true);
    }

    if (isDragging) {
      setDragOffset({ x: boundedX, y: boundedY });
      updateSwipeDirection(diffX);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (mode !== 'feed' && mode !== 'details') return;
    if (!touchStart) return;

    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY
    };
    const diffX = touchEnd.x - touchStart.x;
    const diffY = touchEnd.y - touchStart.y;

    // If user didn't really drag => treat as tap
    const TAP_THRESHOLD = 10;
    if (Math.abs(diffX) < TAP_THRESHOLD && Math.abs(diffY) < TAP_THRESHOLD) {
      handleTapOrClick(touchEnd.x);
    } else {
      handleSwipeGesture(touchStart, touchEnd);
    }

    // Reset
    setTouchStart(null);
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
    setSwipeDirection(null);
  };

  /**
   * DESKTOP MOUSE EVENTS
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode !== 'feed' && mode !== 'details') return;
    setMouseStart({ x: e.clientX, y: e.clientY });
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (mode !== 'feed' && mode !== 'details') return;
    if (!mouseStart) return;

    const diffX = e.clientX - mouseStart.x;
    const diffY = e.clientY - mouseStart.y;
    const maxDrag = 100;
    const boundedX = Math.max(Math.min(diffX, maxDrag), -maxDrag);
    const boundedY = Math.max(Math.min(diffY, maxDrag), -maxDrag);

    if (!isDragging && (Math.abs(diffX) > 20 || Math.abs(diffY) > 20)) {
      setIsDragging(true);
    }

    if (isDragging) {
      setDragOffset({ x: boundedX, y: boundedY });
      updateSwipeDirection(diffX);
      e.preventDefault(); // prevent text selection
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (mode !== 'feed' && mode !== 'details') return;
    if (!mouseStart) return;

    const mouseEnd = { x: e.clientX, y: e.clientY };
    const diffX = mouseEnd.x - mouseStart.x;
    const diffY = mouseEnd.y - mouseStart.y;

    // If user didn't really drag => treat as click
    const TAP_THRESHOLD = 10;
    if (Math.abs(diffX) < TAP_THRESHOLD && Math.abs(diffY) < TAP_THRESHOLD) {
      handleTapOrClick(mouseEnd.x);
    } else {
      handleSwipeGesture(mouseStart, mouseEnd);
    }

    setMouseStart(null);
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
    setSwipeDirection(null);
  };

  const handleMouseLeave = () => {
    if (mode !== 'feed' && mode !== 'details') return;
    if (!mouseStart) return;

    // If the mouse leaves the element while dragging, reset
    setMouseStart(null);
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
    setSwipeDirection(null);
  };

  /**
   * Tap/Click logic:
   * - If there's a video, toggle play/pause
   * - Else, if there's no video, we check left/right side
   *   to do previous/next slide.
   */
  const handleTapOrClick = (tapX: number, isControlClick: boolean = false) => {
    // If click was on a control button, don't handle slide navigation
    if (isControlClick) return;

    // If job has a video URL, toggle play
    if (job.videoUrl) {
      setIsPlaying(!isPlaying);
    } else {
      // If no video, handle left/right for slides
      const screenWidth = window.innerWidth;
      if (tapX < screenWidth * 0.3) {
        // Left side => previous slide
        if (currentSlideIndex > 0) {
          onSlideChange?.(currentSlideIndex - 1);
        }
      } else if (tapX > screenWidth * 0.7) {
        // Right side => next slide
        if (currentSlideIndex < job.slides.length - 1) {
          onSlideChange?.(currentSlideIndex + 1);
        }
      }
    }
  };

  // Get current slide for background image if no video
  const currentSlide = job.slides[currentSlideIndex];
  const backgroundImage = job.videoUrl ? undefined : 
    (slideImageUrls[currentSlideIndex] || 
     `https://via.placeholder.com/1024x1024?text=Loading+Slide+${currentSlideIndex + 1}`);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
        transition: isDragging ? 'none' : 'transform 0.3s ease-out',
        cursor: mode === 'feed' || mode === 'details' ? (isDragging ? 'grabbing' : 'grab') : 'default',
        touchAction: mode === 'feed' || mode === 'details' ? 'none' : 'auto'
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Swipe overlay */}
      {swipeDirection && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor:
              swipeDirection === 'right'
                ? 'rgba(0, 255, 0, 0.3)' // right => green (show details)
                : 'rgba(255, 0, 0, 0.3)', // left => red (reject)
            zIndex: 5,
            pointerEvents: 'none',
            transition: 'background-color 0.2s ease-out'
          }}
        />
      )}

      {/* Video or Slide Content */}
      {job.videoUrl ? (
        <video
          ref={videoRef}
          src={job.videoUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            backgroundColor: '#000'
          }}
          playsInline
          muted={isMuted}
          onEnded={onEnded}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '2rem',
            backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: '#000'
          }}
        >
          {/* Slide Text Content */}
          <div
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              padding: '1rem',
              borderRadius: '8px',
              maxWidth: '80%'
            }}
          >
            <h2
              style={{
                color: '#fff',
                margin: 0,
                marginBottom: '0.5rem',
                fontSize: '1.5rem',
                fontWeight: 'bold'
              }}
            >
              {currentSlide.heading}
            </h2>
            <ul
              style={{
                color: '#fff',
                margin: 0,
                padding: 0,
                paddingLeft: '1.5rem'
              }}
            >
              {currentSlide.bullets.map((bullet, index) => (
                <li key={index} style={{ marginBottom: '0.5rem' }}>
                  {bullet}
                </li>
              ))}
            </ul>
          </div>

          {/* Controls */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              width: '100%',
              zIndex: 10
            }}
          >
            {/* Media controls */}
            {(job.videoUrl || (job.voiceoverUrl && !job.videoUrl)) && (
              <div
                style={{
                  display: 'flex',
                  gap: '1rem',
                  justifyContent: 'center',
                  marginBottom: '1rem'
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent event from bubbling up
                    if (audioEnded) {
                      handleRestartAudio();
                    } else {
                      setIsPlaying(!isPlaying);
                    }
                  }}
                  style={{
                    background: 'rgba(0, 0, 0, 0.5)',
                    border: '2px solid rgba(255, 255, 255, 0.5)',
                    borderRadius: '50%',
                    padding: '12px',
                    cursor: 'pointer',
                    width: '48px',
                    height: '48px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <IonIcon
                    icon={audioEnded ? playCircleOutline : (isPlaying ? pauseCircleOutline : playCircleOutline)}
                    style={{ 
                      color: '#fff', 
                      fontSize: '24px',
                      transform: audioEnded ? 'rotate(-45deg)' : 'none' // Rotate for restart
                    }}
                  />
                </button>
              </div>
            )}

            {/* Slide indicators */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              {job.slides.map((_, index) => (
                <div
                  key={index}
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor:
                      index === currentSlideIndex
                        ? '#fff'
                        : 'rgba(255, 255, 255, 0.5)',
                    cursor: 'pointer'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSlideChange?.(index);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Voiceover Audio: only present if job.voiceoverUrl && no job.videoUrl */}
      {job.voiceoverUrl && !job.videoUrl && (
        <audio
          ref={audioRef}
          src={job.voiceoverUrl}
          onEnded={handleAudioEnd}
          style={{ display: 'none' }}
        />
      )}
    </div>
  );
};

export default JobPresentation;
