import { FeedItem } from '@/store';

interface FeedCardProps {
  item: FeedItem;
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
  display: 'flex',
  alignItems: 'center',
  padding: '1rem',
  borderBottom: '1px solid #e5e7eb',
  gap: '0.75rem'
};

const avatarContainerStyle: React.CSSProperties = {
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  overflow: 'hidden',
  border: '1px solid #e5e7eb'
};

const avatarStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover'
};

const contentStyle: React.CSSProperties = {
  padding: '1rem'
};

const imageContainerStyle: React.CSSProperties = {
  width: '100%',
  height: '192px',
  borderTop: '1px solid #e5e7eb'
};

const imageStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover'
};

export default function FeedCard({ item }: FeedCardProps) {
  console.log('FeedCard rendering:', item.title);
  return (
    <div style={cardStyle}>
      {/* Header with author info */}
      <div style={headerStyle}>
        <div style={avatarContainerStyle}>
          <img
            src={item.authorAvatar}
            alt={item.author}
            style={avatarStyle}
          />
        </div>
        <div>
          <h3 style={{ fontWeight: 500, color: '#111827' }}>{item.author}</h3>
          <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>{item.type}</p>
        </div>
      </div>

      {/* Main content */}
      <div style={contentStyle}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: '#111827' }}>
          {item.title}
        </h2>
        <p style={{ color: '#4b5563' }}>{item.text}</p>
      </div>

      {/* Main image */}
      {item.image && (
        <div style={imageContainerStyle}>
          <img
            src={item.image}
            alt={item.title}
            style={imageStyle}
          />
        </div>
      )}
    </div>
  );
} 