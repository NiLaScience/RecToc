import { VideoItem } from './Feed';
import { IonCard, IonCardHeader, IonCardContent, IonChip, IonLabel } from '@ionic/react';

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
  marginTop: '1rem'
};

export default function FeedCard({ video }: FeedCardProps) {
  return (
    <IonCard style={cardStyle}>
      <IonCardHeader style={headerStyle}>
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
      </IonCardHeader>

      <IonCardContent style={contentStyle}>
        <div style={videoContainerStyle}>
          <video
            src={video.videoUrl}
            controls
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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