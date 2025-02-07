'use client';

import React, { useState, useEffect } from 'react';
import type { VideoItem } from '../types/video';
import type { UserProfile } from '../types/user';
import { addSnapshotListener, removeSnapshotListener } from '../config/firebase';

interface VideoTileProps {
  video: VideoItem;
  onClick: () => void;
}

const tileStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  paddingBottom: '100%', // Makes it square
  backgroundColor: '#fff',
  overflow: 'hidden'
};

const tileContentStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  flexDirection: 'column'
};

const thumbnailStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  backgroundColor: '#000'
};

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  padding: '0.75rem',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  zIndex: 2,
  pointerEvents: 'none'
};

const upperContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  width: '100%',
  pointerEvents: 'auto'
};

const VideoTile: React.FC<VideoTileProps> = ({ video, onClick }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let unsubscribeId: string | null = null;

    const fetchUserProfile = async () => {
      try {
        unsubscribeId = await addSnapshotListener(
          `users/${video.userId}`,
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
  }, [video.userId]);

  return (
    <div style={tileStyle} onClick={onClick}>
      <div style={tileContentStyle}>
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          style={thumbnailStyle}
        />
        <div style={overlayStyle}>
          <div style={upperContainerStyle}>
            {/* Title in upper left */}
            <div style={{ maxWidth: '60%' }}>
              <p style={{ 
                margin: 0, 
                fontSize: '0.9rem', 
                fontWeight: 'bold',
                color: 'white',
                textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                padding: '6px 10px',
                borderRadius: '6px',
                display: 'inline-block'
              }}>
                {video.title}
              </p>
            </div>

            {/* Tags in upper right */}
            {Array.isArray(video.tags) && video.tags.length > 0 && (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.25rem',
                justifyContent: 'flex-end',
                maxWidth: '40%'
              }}>
                {video.tags.slice(0, 2).map((tag, index) => (
                  <span key={index} style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    color: '#fff',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    display: 'inline-block',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
                  }}>
                    {tag}
                  </span>
                ))}
                {video.tags.length > 2 && (
                  <span style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    color: '#fff',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    display: 'inline-block',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
                  }}>
                    +{video.tags.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Profile info in lower left */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            pointerEvents: 'auto'
          }}>
            <img
              src={userProfile?.photoURL || 'https://ionicframework.com/docs/img/demos/avatar.svg'}
              alt="Profile"
              style={{
                width: '2rem',
                height: '2rem',
                borderRadius: '50%',
                border: '2px solid #fff',
                objectFit: 'cover',
                minWidth: '2rem', // Prevent shrinking
                backgroundColor: '#f4f4f4' // Placeholder background while loading
              }}
            />
            <div>
              <p style={{ 
                margin: 0, 
                fontWeight: 'bold', 
                fontSize: '0.8rem',
                color: 'white',
                textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
              }}>
                {userProfile?.displayName || 'User'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoTile; 