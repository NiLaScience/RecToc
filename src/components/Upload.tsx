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
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonAlert,
} from '@ionic/react';
import { cloudUploadOutline, closeCircleOutline, micOutline } from 'ionicons/icons';
import { useState, useEffect } from 'react';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, uploadBytes } from 'firebase/storage';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { FirebaseFirestore } from '@capacitor-firebase/firestore';
import VideoRecorder from './VideoRecorder';
import type { User } from 'firebase/auth';
import { Filesystem, Directory } from '@capacitor/filesystem';
import TranscriptionService from '../services/TranscriptionService';
import { Dialog } from '@capacitor/dialog';
import { alertController } from '@ionic/core';
import ThumbnailService from '../services/ThumbnailService';

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
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<{
    text: string;
    segments: { id: number; start: number; end: number; text: string; }[];
  } | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [webSuccess, setWebSuccess] = useState(false);

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
      if (Capacitor.isNativePlatform()) {
        // Keep Android behavior exactly the same
        setPreviewUrl(uri);
        
        const fileContents = await Filesystem.readFile({
          path: uri,
          directory: Directory.Data
        });

        const base64Response = await fetch(`data:video/${format};base64,${fileContents.data}`);
        const blob = await base64Response.blob();
        
        const fileName = uri.split('/').pop() || `recorded_video_${Date.now()}.${format}`;
        setFile(new File([blob], fileName, { type: `video/${format}` }));
      } else {
        // For web, ensure we properly handle the recording completion
        setPreviewUrl(uri);
        const response = await fetch(uri);
        const blob = await response.blob();
        const fileName = `recorded_video_${Date.now()}.${format}`;
        const videoFile = new File([blob], fileName, { type: `video/${format}` });
        setFile(videoFile);
        // Force switch back to file mode after recording is complete
        setUploadMode('file');
      }
    } catch (error) {
      console.error('Error handling recorded video:', error);
      setError('Failed to process recorded video. Please try again.');
    }
  };

  const handleTranscribe = async () => {
    if (!file && !previewUrl) {
      setError('Please record or select a video first');
      return;
    }

    setTranscribing(true);
    setError('');

    try {
      let videoSource: string | File;
      
      if (Capacitor.isNativePlatform()) {
        if (previewUrl?.startsWith('file://')) {
          // For recorded videos on native platform, use the original file path
          videoSource = previewUrl.replace('file://', '');
        } else {
          // For selected files, use the File object
          videoSource = file!;
        }
      } else {
        // For web platform, always use the File object as it's already processed
        videoSource = file!;
      }

      const transcriptionResult = await TranscriptionService.transcribeVideo(videoSource);
      setTranscript(transcriptionResult);
    } catch (error) {
      console.error('Transcription error:', error);
      setError(error instanceof Error ? error.message : 'Failed to transcribe video');
    } finally {
      setTranscribing(false);
    }
  };

  const resetForm = () => {
    console.log('resetForm called');
    setTitle('');
    setFile(null);
    setTags([]);
    setCurrentTag('');
    setError('');
    setTranscript(null);
    setWebSuccess(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    // Reset to default upload mode if on web
    if (!Capacitor.isNativePlatform()) {
      setUploadMode('file');
    }
    console.log('resetForm completed');
  };

  const showUploadSuccess = async () => {
    try {
      console.log('showUploadSuccess called, platform:', Capacitor.isNativePlatform() ? 'native' : 'web');
      
      if (Capacitor.isNativePlatform()) {
        console.log('Showing native dialog');
        await Dialog.alert({
          title: 'Upload Complete',
          message: 'Your video has been successfully uploaded!',
          buttonTitle: 'OK'
        });
        console.log('Native dialog closed');
        resetForm();
      } else {
        console.log('Showing web success message');
        setWebSuccess(true);
        // Auto clear after 2 seconds
        setTimeout(() => {
          resetForm();
        }, 2000);
      }
    } catch (error) {
      console.error('Error in showUploadSuccess:', error);
      resetForm();
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
      // Generate thumbnail
      const thumbnailFile = await ThumbnailService.generateThumbnail(file);
      
      // Upload video and thumbnail to Firebase Storage
      const storage = getStorage();
      const videoPath = `videos/${currentUser.uid}/${Date.now()}-${file.name}`;
      const thumbnailPath = `thumbnails/${currentUser.uid}/${Date.now()}-thumbnail.jpg`;
      
      const videoRef = ref(storage, videoPath);
      const thumbnailRef = ref(storage, thumbnailPath);
      
      // Upload thumbnail
      await uploadBytes(thumbnailRef, thumbnailFile);
      const thumbnailUrl = await getDownloadURL(thumbnailRef);
      
      // Upload video
      const uploadTask = uploadBytesResumable(videoRef, file);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log('Upload progress:', progress + '%');
        },
        (error) => {
          console.error('Upload error:', error);
          setError(`Upload failed: ${error.message}`);
          setUploading(false);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            
            // Save video metadata to Firestore
            const videoData = {
              title,
              videoUrl: downloadURL,
              thumbnailUrl, // Add thumbnail URL
              tags,
              userId: currentUser!.uid,
              createdAt: new Date().toISOString(),
              views: 0,
              likes: 0,
              transcript: transcript || null,
            };
            
            if (Capacitor.isNativePlatform()) {
              await FirebaseFirestore.addDocument({
                reference: '/videos',
                data: videoData
              });
            } else {
              const db = getFirestore();
              await addDoc(collection(db, 'videos'), videoData);
            }

            setUploading(false);
            await showUploadSuccess();
          } catch (err: any) {
            console.error('Post-upload error:', err);
            setError(`Failed to save video metadata: ${err.message}`);
            setUploading(false);
          }
        }
      );
    } catch (error: any) {
      console.error('Upload error:', error);
      setError(error.message || 'Failed to upload video');
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
          {!Capacitor.isNativePlatform() && (
            <IonSegment 
              value={uploadMode} 
              onIonChange={e => {
                const newMode = e.detail.value as 'file' | 'record';
                setUploadMode(newMode);
                // Clear existing file and preview when switching modes
                if (newMode === 'record') {
                  setFile(null);
                  if (previewUrl) {
                    URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                  }
                }
              }}
            >
              <IonSegmentButton value="file">
                <IonLabel>Choose File</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="record">
                <IonLabel>Record Video</IonLabel>
              </IonSegmentButton>
            </IonSegment>
          )}

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
            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <IonInput
                value={currentTag}
                onIonInput={e => setCurrentTag(e.detail.value!)}
                onKeyPress={handleAddTag}
                placeholder="Type tag and press Enter"
                style={{ flex: 1 }}
              />
              <IonButton
                size="small"
                onClick={() => {
                  if (currentTag.trim()) {
                    if (!tags.includes(currentTag.trim())) {
                      setTags([...tags, currentTag.trim()]);
                    }
                    setCurrentTag('');
                  }
                }}
                disabled={!currentTag.trim()}
              >
                +
              </IonButton>
            </div>
          </IonItem>

          {tags.length > 0 && (
            <div className="ion-padding-vertical" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {tags.map(tag => (
                <IonChip key={tag} onClick={() => removeTag(tag)}>
                  <IonLabel>{tag}</IonLabel>
                  <IonIcon icon={closeCircleOutline} />
                </IonChip>
              ))}
            </div>
          )}

          {(uploadMode === 'file' || Capacitor.isNativePlatform()) ? (
            <div className="ion-padding-vertical">
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

              {Capacitor.isNativePlatform() ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <IonButton
                    expand="block"
                    onClick={() => document.getElementById('video-record')?.click()}
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
                </div>
              ) : (
                <IonButton
                  expand="block"
                  onClick={() => document.getElementById('video-select')?.click()}
                  color="medium"
                >
                  {file ? 'Change Video' : 'Select Video'}
                </IonButton>
              )}

              {file && Capacitor.isNativePlatform() && (
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

              {/* Add transcription button after video selection/recording */}
              {(file || previewUrl) && !uploading && (
                <div className="ion-padding-vertical">
                  <IonButton
                    expand="block"
                    onClick={handleTranscribe}
                    disabled={transcribing}
                    color={transcript ? 'success' : 'primary'}
                  >
                    <IonIcon icon={micOutline} slot="start" />
                    {transcribing ? (
                      <>
                        <IonSpinner name="crescent" />
                        <span className="ion-padding-start">Transcribing...</span>
                      </>
                    ) : transcript ? (
                      'Transcription Complete'
                    ) : (
                      'Transcribe Video'
                    )}
                  </IonButton>

                  {transcript && (
                    <IonItem lines="none" className="ion-margin-top">
                      <IonLabel>
                        <h2>Transcript Preview</h2>
                        <p style={{ whiteSpace: 'pre-wrap' }}>{transcript.text}</p>
                      </IonLabel>
                    </IonItem>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <VideoRecorder
                onVideoRecorded={handleRecordedVideo}
                onError={setError}
              />
              {file && previewUrl && (
                <div className="ion-padding-vertical">
                  <IonButton
                    expand="block"
                    color="medium"
                    onClick={() => {
                      setFile(null);
                      if (previewUrl) {
                        URL.revokeObjectURL(previewUrl);
                        setPreviewUrl(null);
                      }
                      setUploadMode('record');
                    }}
                  >
                    Record Again
                  </IonButton>
                </div>
              )}
            </>
          )}

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

          {webSuccess && !Capacitor.isNativePlatform() && (
            <div className="ion-text-center ion-padding">
              <IonLabel color="success" style={{ fontSize: '1.2em', fontWeight: 'bold' }}>
                Upload Complete! Clearing form...
              </IonLabel>
            </div>
          )}
        </div>
      </IonContent>

      <IonAlert
        isOpen={showAlert}
        onDidDismiss={() => {
          console.log('Alert dismissed');
          setShowAlert(false);
          resetForm();
        }}
        header="Upload Complete"
        message="Your video has been successfully uploaded!"
        buttons={[
          {
            text: 'OK',
            handler: () => {
              console.log('OK clicked');
              setShowAlert(false);
              resetForm();
            }
          }
        ]}
        cssClass={['upload-success-alert', 'alert-with-backdrop']}
        backdropDismiss={false}
      />

      <style>{`
        .alert-with-backdrop::part(backdrop) {
          background: rgba(0, 0, 0, 0.7);
          opacity: 1;
          z-index: 100000;
        }

        .upload-success-alert {
          --width: 80%;
          --max-width: 400px;
          --background: #ffffff;
          --backdrop-opacity: 1;
          z-index: 100001;
          position: relative;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
        }

        .upload-success-alert::part(wrapper) {
          z-index: 100001;
          background: #ffffff;
          border-radius: 8px;
        }

        .upload-success-alert::part(container) {
          background: #ffffff;
        }

        .upload-success-alert::part(header) {
          background: var(--ion-color-primary);
          color: white;
          padding: 20px;
          font-size: 1.2em;
          font-weight: bold;
          border-radius: 8px 8px 0 0;
        }

        .upload-success-alert::part(message) {
          padding: 20px;
          font-size: 1.1em;
          color: var(--ion-color-dark);
          background: #ffffff;
        }

        .upload-success-alert::part(button) {
          font-size: 1.1em;
          font-weight: 600;
          padding: 15px;
          background: #ffffff;
        }

        .alert-button-confirm {
          color: var(--ion-color-primary);
        }

        @media (max-width: 576px) {
          .upload-success-alert {
            --width: 90%;
          }
        }
      `}</style>
    </IonPage>
  );
};

export default Upload; 