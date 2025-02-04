import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonChip,
  IonIcon,
} from '@ionic/react';
import { cloudUploadOutline, closeCircleOutline } from 'ionicons/icons';
import { useState, useEffect } from 'react';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { FirebaseFirestore } from '@capacitor-firebase/firestore';
import VideoRecorder from './VideoRecorder';
import type { User } from 'firebase/auth';
import { Filesystem, Directory } from '@capacitor/filesystem';

interface FirebaseUser {
  uid: string;
  email: string | null;
}

const Upload = () => {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [uploadMode, setUploadMode] = useState<'file' | 'record'>('file');
  const { user } = useAuth();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup any existing preview URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Cleanup any existing preview URL
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      // Check if file is a video
      if (!selectedFile.type.startsWith('video/')) {
        setError('Please select a video file');
        return;
      }
      setFile(selectedFile);
      setError('');
      
      // Create preview URL
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && currentTag.trim()) {
      e.preventDefault();
      if (!tags.includes(currentTag.trim())) {
        setTags([...tags, currentTag.trim()]);
      }
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleRecordedVideo = async (uri: string, format: string) => {
    try {
      // Cleanup any existing preview URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }

      if (Capacitor.isNativePlatform()) {
        // For native platforms, read the file using Filesystem
        const fileContents = await Filesystem.readFile({
          path: uri,
          directory: Directory.Data
        });

        // Convert base64 to blob
        const base64Response = await fetch(`data:video/${format};base64,${fileContents.data}`);
        const blob = await base64Response.blob();
        
        // Create a File object
        const fileName = uri.split('/').pop() || `recorded_video_${Date.now()}.${format}`;
        const newFile = new File([blob], fileName, { type: `video/${format}` });
        setFile(newFile);
        
        // Create and set preview URL
        const previewUrl = URL.createObjectURL(newFile);
        setPreviewUrl(previewUrl);
      } else {
        // For web, uri is already a blob URL
        const response = await fetch(uri);
        const blob = await response.blob();
        const fileName = `recorded_video_${Date.now()}.${format}`;
        const newFile = new File([blob], fileName, { type: `video/${format}` });
        setFile(newFile);
        
        // Create and set preview URL
        const previewUrl = URL.createObjectURL(newFile);
        setPreviewUrl(previewUrl);
      }
    } catch (error) {
      console.error('Error handling recorded video:', error);
      setError('Failed to process recorded video. Please try again.');
    }
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      setError('Please fill in all fields and select a video');
      return;
    }

    // Verify authentication state
    let currentUser: FirebaseUser | null = user;
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await FirebaseAuthentication.getCurrentUser();
        if (!result.user) {
          setError('Authentication required. Please sign in again.');
          return;
        }
        currentUser = result.user;
      } catch (err) {
        console.error('Error getting current user:', err);
        setError('Failed to verify authentication. Please sign in again.');
        return;
      }
    }

    if (!currentUser) {
      setError('Authentication required. Please sign in.');
      return;
    }

    setUploading(true);
    setError('');

    try {
      console.log('Starting upload process...', {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        userId: currentUser.uid
      });

      // Create metadata
      const metadata = {
        contentType: file.type,
        customMetadata: {
          userId: currentUser.uid,
          title: title,
          tags: JSON.stringify(tags)
        }
      };

      console.log('Created metadata:', metadata);

      // Upload video to Firebase Storage
      const storage = getStorage();
      console.log('Got storage reference');
      
      const filePath = `videos/${currentUser.uid}/${Date.now()}-${file.name}`;
      console.log('File will be uploaded to:', filePath);
      
      const storageRef = ref(storage, filePath);
      console.log('Created storage reference');
      
      // Create a Blob from the file
      const blob = new Blob([file], { type: file.type });
      console.log('Created blob:', { size: blob.size, type: blob.type });
      
      // Upload the blob
      console.log('Starting upload task...');
      const uploadTask = uploadBytesResumable(storageRef, blob, metadata);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log('Upload progress:', {
            progress: `${progress}%`,
            state: snapshot.state,
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes
          });
        },
        (error) => {
          console.error('Upload error:', error);
          setError(`Upload failed: ${error.message} (${error.code})`);
          setUploading(false);
        },
        async () => {
          try {
            // Verify authentication state again before Firestore operation
            if (Capacitor.isNativePlatform()) {
              const result = await FirebaseAuthentication.getCurrentUser();
              if (!result.user) {
                throw new Error('Authentication lost during upload');
              }
              currentUser = result.user;
            }

            if (!currentUser) {
              throw new Error('Authentication required');
            }

            console.log('Upload completed, getting download URL...');
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('Got download URL:', downloadURL);
            
            // Save video metadata to Firestore
            console.log('Saving to Firestore...');
            const videoData = {
              title,
              videoUrl: downloadURL,
              tags,
              userId: currentUser.uid,
              createdAt: new Date().toISOString(),
              views: 0,
              likes: 0
            };
            console.log('Video data:', videoData);
            
            if (Capacitor.isNativePlatform()) {
              // Use native Firestore plugin
              await FirebaseFirestore.addDocument({
                reference: '/videos',
                data: videoData
              });
            } else {
              // Use web SDK
              const db = getFirestore();
              await addDoc(collection(db, 'videos'), videoData);
            }
            console.log('Saved to Firestore successfully');

            // Reset form
            setTitle('');
            setFile(null);
            setTags([]);
            setUploading(false);
          } catch (err: any) {
            console.error('Post-upload error:', err);
            setError(`Failed to save video metadata: ${err.message}`);
            setUploading(false);
          }
        }
      );
    } catch (err: any) {
      console.error('Pre-upload error:', err);
      setError(`Upload failed: ${err.message}`);
      setUploading(false);
    }
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonTitle>Upload Video</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonHeader collapse="condense" className="ion-no-border">
          <IonToolbar>
            <IonTitle size="large">Upload Video</IonTitle>
          </IonToolbar>
        </IonHeader>

        <div className="ion-padding">
          <IonItem>
            <IonLabel position="stacked">Title</IonLabel>
            <IonInput
              value={title}
              onIonChange={e => setTitle(e.detail.value!)}
              placeholder="Enter video title"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Tags</IonLabel>
            <IonInput
              value={currentTag}
              onIonChange={e => setCurrentTag(e.detail.value!)}
              onKeyPress={handleAddTag}
              placeholder="Type tag and press Enter"
            />
          </IonItem>

          {tags.length > 0 && (
            <div className="ion-padding-vertical">
              {tags.map(tag => (
                <IonChip key={tag} onClick={() => removeTag(tag)}>
                  <IonLabel>{tag}</IonLabel>
                  <IonIcon icon={closeCircleOutline} />
                </IonChip>
              ))}
            </div>
          )}

          <div className="ion-padding-vertical">
            {uploadMode === 'record' ? (
              <>
                <VideoRecorder
                  onVideoRecorded={(uri, format) => {
                    handleRecordedVideo(uri, format);
                    setUploadMode('file');
                  }}
                  onError={setError}
                />
                <IonButton
                  expand="block"
                  onClick={() => setUploadMode('file')}
                  color="medium"
                  className="ion-margin-top"
                >
                  Cancel Recording
                </IonButton>
              </>
            ) : (
              <>
                {previewUrl && (
                  <div style={{ 
                    width: '100%', 
                    aspectRatio: '16/9',
                    backgroundColor: '#000',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    marginBottom: '1rem'
                  }}>
                    <video
                      src={previewUrl}
                      controls
                      playsInline
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'contain'
                      }}
                    />
                  </div>
                )}
                
                {/* Input for camera recording */}
                <input
                  type="file"
                  accept="video/*"
                  capture="environment"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  id="video-record"
                />
                
                {/* Input for file selection */}
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  id="video-select"
                />

                <div style={{ display: 'flex', gap: '8px' }}>
                  {!file && (
                    <>
                      <IonButton
                        expand="block"
                        onClick={() => setUploadMode('record')}
                        color="medium"
                        style={{ flex: 1 }}
                      >
                        Record Video
                      </IonButton>
                      <IonButton
                        expand="block"
                        onClick={() => document.getElementById('video-select')?.click()}
                        color="medium"
                        style={{ flex: 1 }}
                      >
                        Choose Video
                      </IonButton>
                    </>
                  )}
                </div>

                {file && (
                  <IonButton
                    expand="block"
                    onClick={() => {
                      setFile(null);
                      if (previewUrl) {
                        URL.revokeObjectURL(previewUrl);
                        setPreviewUrl(null);
                      }
                    }}
                    color="medium"
                    className="ion-margin-top"
                  >
                    Remove Video
                  </IonButton>
                )}
              </>
            )}
          </div>

          {error && (
            <div className="ion-padding-vertical ion-text-center">
              <IonLabel color="danger">{error}</IonLabel>
            </div>
          )}

          <IonButton
            expand="block"
            onClick={handleUpload}
            disabled={uploading || !file || !title.trim()}
          >
            <IonIcon icon={cloudUploadOutline} slot="start" />
            {uploading ? 'Uploading...' : 'Upload Video'}
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Upload; 