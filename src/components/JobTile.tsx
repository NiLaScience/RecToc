import React, { useState, useEffect } from 'react';
import type { JobOpening } from '../types/job_opening';
import type { UserProfile } from '../types/user';
import { addSnapshotListener, removeSnapshotListener } from '../config/firebase';
import { IonIcon } from '@ionic/react';
import { videocamOutline } from 'ionicons/icons';
import { FirebaseStorage } from '@capacitor-firebase/storage';

interface JobTileProps {
  job: JobOpening;
  onClick: () => void;
}

const JobTile: React.FC<JobTileProps> = ({ job, onClick }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    let unsubscribeId: string | null = null;

    const fetchUserProfile = async () => {
      try {
        unsubscribeId = await addSnapshotListener(
          `users/${job.userId}`,
          (data) => {
            if (data) {
              setUserProfile(data as UserProfile);
            }
          }
        );
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    fetchUserProfile();

    return () => {
      if (unsubscribeId) {
        removeSnapshotListener(unsubscribeId);
      }
    };
  }, [job.userId]);

  // Get authenticated URL for the background image
  useEffect(() => {
    const firstSlide = job.slides?.[0];
    if (firstSlide?.backgroundImageUrl && !backgroundImageUrl && !imageError) {
      const getAuthenticatedUrl = async () => {
        try {
          // If the URL is already a full URL (e.g., from DALL-E), use it directly
          if (firstSlide.backgroundImageUrl.startsWith('http')) {
            setBackgroundImageUrl(firstSlide.backgroundImageUrl);
            return;
          }

          // Otherwise, get an authenticated URL from Firebase Storage
          const result = await FirebaseStorage.getDownloadUrl({
            path: firstSlide.backgroundImageUrl
          });
          setBackgroundImageUrl(result.downloadUrl);
        } catch (error) {
          console.error('Error getting authenticated URL:', error);
          setImageError(true);
        }
      };

      getAuthenticatedUrl();
    }
  }, [job.slides, backgroundImageUrl, imageError]);

  // Get the first slide or use fallbacks
  const firstSlide = job.slides?.[0];
  const displayBackgroundImage = backgroundImageUrl || 
    (job.videoUrl ? `https://via.placeholder.com/1024x1024?text=Loading+Job` : `https://via.placeholder.com/1024x1024?text=No+Preview`);

  return (
    <div 
      onClick={onClick}
      style={{
        position: 'relative',
        width: '100%',
        paddingBottom: '100%', // Makes it square
        backgroundColor: '#000',
        overflow: 'hidden',
        cursor: 'pointer',
        borderRadius: '12px'
      }}
    >
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Background Image */}
        <img
          src={displayBackgroundImage}
          alt={job.title}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            backgroundColor: '#000'
          }}
          onError={() => setImageError(true)}
        />

        {/* Content Overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          {/* Top Section */}
          <div style={{
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0) 100%)',
            padding: '1rem',
            borderRadius: '8px',
            width: '100%'
          }}>
            {/* Job Title */}
            <h3 style={{
              margin: 0,
              marginBottom: '0.5rem',
              color: '#fff',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
            }}>
              {job.title}
            </h3>

            {/* Company & Location */}
            {job.jobDescription?.company && (
              <p style={{
                margin: 0,
                marginBottom: '0.5rem',
                color: 'rgba(255,255,255,0.9)',
                fontSize: '0.9rem'
              }}>
                {job.jobDescription.company}
                {job.jobDescription.location && ` • ${job.jobDescription.location}`}
              </p>
            )}

            {/* First Slide Content */}
            {firstSlide && (
              <div style={{
                marginTop: '0.5rem',
                color: 'rgba(255,255,255,0.85)',
                fontSize: '0.85rem'
              }}>
                <p style={{
                  margin: 0,
                  marginBottom: '0.25rem',
                  fontWeight: 'bold'
                }}>
                  {firstSlide.heading}
                </p>
                <ul style={{
                  margin: 0,
                  padding: 0,
                  paddingLeft: '1.2rem',
                  listStyle: 'disc'
                }}>
                  {firstSlide.bullets.slice(0, 2).map((bullet, index) => (
                    <li key={index} style={{
                      marginBottom: '0.25rem',
                      lineHeight: 1.2
                    }}>
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Bottom Section */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0) 100%)',
            padding: '1rem',
            borderRadius: '8px'
          }}>
            {/* Profile Info */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <img
                src={userProfile?.photoURL || 'https://ionicframework.com/docs/img/demos/avatar.svg'}
                alt="Profile"
                style={{
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '50%',
                  border: '2px solid #fff',
                  objectFit: 'cover'
                }}
              />
              <span style={{
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 'bold'
              }}>
                {userProfile?.displayName || 'User'}
              </span>
            </div>

            {/* Tags & Video Indicator */}
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center'
            }}>
              {job.videoUrl && (
                <div style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  color: '#fff',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <IonIcon icon={videocamOutline} />
                  Video
                </div>
              )}
              {job.tags?.slice(0, 2).map((tag, index) => (
                <span
                  key={index}
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    color: '#fff',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}
                >
                  {tag}
                </span>
              ))}
              {(job.tags?.length || 0) > 2 && (
                <span style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  color: '#fff',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '12px'
                }}>
                  +{job.tags!.length - 2}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobTile; 