import React, { useEffect, useState } from 'react';
import { FirebaseStorage } from '@capacitor-firebase/storage';
import { IonSkeletonText } from '@ionic/react';

interface FirebaseStorageImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  path: string;
}

const FirebaseStorageImage: React.FC<FirebaseStorageImageProps> = ({ path, ...props }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getDownloadUrl = async () => {
      try {
        const result = await FirebaseStorage.getDownloadUrl({
          path
        });
        setUrl(result.downloadUrl);
        setLoading(false);
      } catch (error) {
        console.error('Error getting download URL:', error);
        setError(true);
        setLoading(false);
      }
    };

    if (path) {
      getDownloadUrl();
    }
  }, [path]);

  if (loading) {
    return <IonSkeletonText animated style={{ width: '100%', height: '100%' }} />;
  }

  if (error || !url) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#333',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '8px'
      }}>
        <span style={{ color: '#666' }}>!</span>
      </div>
    );
  }

  return <img src={url} {...props} />;
};

export default FirebaseStorageImage; 