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

const tileOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  padding: '12px',
  paddingBottom: '16px',
  background: 'linear-gradient(transparent, rgba(0,0,0,0.9))',
  marginTop: 'auto'
};

const infoRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px'
};

const userInfoStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flex: '1 1 auto'
};

const avatarStyle: React.CSSProperties = {
  width: '48px',
  height: '48px',
  borderRadius: '50%',
  border: '2px solid #fff',
  objectFit: 'cover',
  minWidth: '48px', // Prevent shrinking
  backgroundColor: '#f4f4f4' // Placeholder background while loading
};

const usernameStyle: React.CSSProperties = {
  margin: 0,
  color: '#fff',
  fontSize: '14px',
  fontWeight: 'bold',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textAlign: 'right',
  flex: '1 1 auto',
  maxWidth: '50%'
};

const tagContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px',
  marginTop: '4px'
};

const tagStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
  color: '#fff',
  padding: '2px 8px',
  borderRadius: '12px',
  fontSize: '12px'
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
        <div style={tileOverlayStyle}>
          <div style={infoRowStyle}>
            <div style={userInfoStyle}>
              <img
                src={userProfile?.photoURL || 'https://ionicframework.com/docs/img/demos/avatar.svg'}
                alt={userProfile?.displayName || 'User'}
                style={avatarStyle}
              />
              <p style={usernameStyle}>{userProfile?.displayName || 'User'}</p>
            </div>
            <p style={titleStyle}>{video.title}</p>
            {video.tags && video.tags.length > 0 && (
              <div style={tagContainerStyle}>
                {video.tags.slice(0, 3).map((tag, index) => (
                  <span key={index} style={tagStyle}>
                    {tag}
                  </span>
                ))}
                {video.tags.length > 3 && (
                  <span style={tagStyle}>+{video.tags.length - 3}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoTile; 