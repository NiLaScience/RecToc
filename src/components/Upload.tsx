import { useState, useEffect } from 'react';
import { 
  IonPage, 
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
  IonAccordionGroup, 
  IonAccordion, 
  IonProgressBar,
  IonToggle,
} from '@ionic/react';
import { cloudUploadOutline, closeCircleOutline, micOutline } from 'ionicons/icons';
import { useAuth } from '../context/AuthContext';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Filesystem, Directory } from '@capacitor/filesystem';
import VideoRecorder from './VideoRecorder';
import TranscriptionService from '../services/TranscriptionService';
import { Dialog } from '@capacitor/dialog';
import { alertController } from '@ionic/core';
import ThumbnailService from '../services/ThumbnailService';
import { ParserService } from '../services/ParserService';
import type { JobDescription } from '../types/job_opening';
import { uploadFile, addDocument } from '../config/firebase';
import AppHeader from './AppHeader';
import AccordionGroup from './shared/AccordionGroup';
import AccordionSection from './shared/AccordionSection';
import { ListContent, ChipsContent } from './shared/AccordionContent';
import { FirebaseStorage } from '@capacitor-firebase/storage';
import JobDescriptionAccordion from './shared/JobDescriptionAccordion';
import { SlideGenerationService } from '../services/SlideGenerationService';

interface User {
  uid: string;
  email: string | null;
}

interface UploadProps {
  onClose: () => void;
}

const Upload: React.FC<UploadProps> = ({ onClose }) => {
  const [title, setTitle] = useState('');
  const [applicationUrl, setApplicationUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [uploadMode, setUploadMode] = useState<'file' | 'record'>('file');
  const [uploadProgress, setUploadProgress] = useState(0);
  const { user } = useAuth();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<{
    text: string;
    segments: { id: number; start: number; end: number; text: string; }[];
  } | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [webSuccess, setWebSuccess] = useState(false);
  const [jobDescription, setJobDescription] = useState<JobDescription | null>(null);
  const [parsingPDF, setParsingPDF] = useState(false);
  const [generatingSlides, setGeneratingSlides] = useState(false);
  const [slideGenerationError, setSlideGenerationError] = useState<string | null>(null);
  const slideGenerationService = new SlideGenerationService();
  const parser = new ParserService();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Constants for upload handling
  const CHUNK_UPLOAD_THRESHOLD = 25 * 1024 * 1024; // 25 MB threshold

  const writeFileInChunks = async (path: string, blob: Blob, chunkSize: number = 5 * 1024 * 1024) => {
    const totalSize = blob.size;
    let offset = 0;
    
    while (offset < totalSize) {
      const chunk = blob.slice(offset, offset + chunkSize);
      const chunkArrayBuffer = await chunk.arrayBuffer();
      const base64chunk = Buffer.from(chunkArrayBuffer).toString('base64');
      
      await Filesystem.appendFile({
        path,
        data: base64chunk,
        directory: Directory.Cache
      });
      
      offset += chunkSize;
    }
  };

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
        // For web platform
        setPreviewUrl(uri);
        const response = await fetch(uri);
        const blob = await response.blob();
        
        // Clean up the format string to remove codecs
        const cleanFormat = format.split(';')[0];
        const cleanMimeType = `video/${cleanFormat}`;
        
        // Convert blob to base64
        const base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        
        // Create a new blob with clean MIME type
        const cleanBlob = new Blob([blob], { type: cleanMimeType });
        
        const fileName = `recorded_video_${Date.now()}.${cleanFormat}`;
        const videoFile = new File([cleanBlob], fileName, { type: cleanMimeType });
        setFile(videoFile);
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
    setApplicationUrl('');
    setFile(null);
    setTags([]);
    setCurrentTag('');
    setError('');
    setTranscript(null);
    setWebSuccess(false);
    setJobDescription(null);
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

  const handlePDFChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const pdfFile = event.target.files?.[0];
    if (!pdfFile) return;

    // Check authentication first
    if (!user) {
      setError('You must be signed in to upload a job description');
      return;
    }

    console.log('Current auth state:', user);
    setParsingPDF(true);
    try {
      const result = await parser.uploadAndParsePDF<JobDescription>(pdfFile, 'pdfs-to-parse');
      setJobDescription(result);
      
      // Auto-populate fields from parsed job description
      if (result) {
        setTitle(result.title || '');
        setTags([
          ...(result.skills || []),
          result.employmentType || '',
          result.experienceLevel || '',
          result.location || '',
        ].filter(Boolean));
      }
    } catch (error: any) {
      console.error('Error parsing PDF:', error);
      // More specific error messages based on the error type
      if (error.code === 'permission-denied') {
        setError('You don\'t have permission to upload job descriptions. Please check your account permissions.');
      } else if (error.code === 'unauthenticated') {
        setError('Your session has expired. Please sign in again.');
      } else {
        setError(error.message || 'Failed to parse PDF. Please try again.');
      }
      setShowAlert(true);
    } finally {
      setParsingPDF(false);
    }
  };

  const handleUpload = async () => {
    if (!jobDescription) {
      setError('Please upload a job description first');
      return;
    }

    // Verify authentication state
    try {
      const result = await FirebaseAuthentication.getCurrentUser();
      if (!result.user) {
        setError('Authentication required. Please sign in again.');
        return;
      }
      const currentUser = result.user;

      setUploading(true);
      setError('');
      setUploadProgress(0);

      try {
        // Generate slides first
        setGeneratingSlides(true);
        setSlideGenerationError(null);
        const { slides, voiceoverUrl, status } = await slideGenerationService.generateJobPresentation(
          jobDescription,
          `${Date.now()}-${title.replace(/\s+/g, '-').toLowerCase()}`
        );

        // Optional: If video is provided, handle it
        let videoUrl: string | undefined;
        let thumbnailUrl: string | undefined;
        
        if (file) {
          console.log('Generating thumbnail for file:', file.name, 'type:', file.type, 'size:', file.size);
          const thumbnailFile = await ThumbnailService.generateThumbnail(file);
          console.log('Thumbnail generated successfully');
          
          // Generate unique file names and upload paths
          const videoFileName = `${Date.now()}-${file.name}`;
          const thumbnailFileName = `${Date.now()}-thumbnail.jpg`;
          const videoPath = `videos/${currentUser.uid}/${videoFileName}`;
          const thumbnailPath = `thumbnails/${currentUser.uid}/${thumbnailFileName}`;
          
          console.log('Uploading files to Firebase Storage...');
          const cleanMimeType = file.type.split(';')[0];

          [videoUrl, thumbnailUrl] = await Promise.all([
            new Promise<string>((resolve, reject) => {
              FirebaseStorage.uploadFile(
                {
                  path: videoPath,
                  blob: file,
                  metadata: { contentType: cleanMimeType },
                },
                (progress, error) => {
                  if (error) {
                    reject(error);
                  } else if (progress) {
                    if (progress.progress) {
                      setUploadProgress(progress.progress * 100);
                    }
                    if (progress.completed) {
                      FirebaseStorage.getDownloadUrl({ path: videoPath })
                        .then((result) => resolve(result.downloadUrl))
                        .catch(reject);
                    }
                  }
                }
              );
            }),
            uploadFile(thumbnailPath, undefined, {
              contentType: 'image/jpeg',
              blob: thumbnailFile,
            }),
          ]);
        }
        
        console.log('Files uploaded to Firebase Storage successfully');

        // Save job metadata to Firestore
        const jobData = {
          title,
          ...(videoUrl && { videoUrl }),
          ...(thumbnailUrl && { thumbnailUrl }),
          jobDescription,
          slides,
          voiceoverUrl,
          slidesStatus: status,
          pdfUrl,
          tags,
          userId: currentUser.uid,
          createdAt: new Date().toISOString(),
          views: 0,
          likes: 0,
          transcript: transcript || null,
          applicationUrl: applicationUrl || null,
        };
        
        await addDocument('job_openings', jobData);

        setUploading(false);
        await showUploadSuccess();
      } catch (err: any) {
        console.error('Upload error:', err);
        setError(err.message || 'Failed to upload job');
        setUploading(false);
      }
    } catch (error: any) {
      console.error('Authentication error:', error);
      setError('Failed to verify authentication. Please sign in again.');
      setUploading(false);
    }
  };

  return (
    <IonPage>
      <AppHeader
        title="Upload Job"
        mode="upload"
      />
      <IonContent>
        <div style={{ padding: '1rem', paddingTop: '56px' }}>
          <div className="input-container">
            <IonInput
              value={title}
              onIonChange={e => setTitle(e.detail.value!)}
              placeholder="Job title"
              className={title ? 'has-value' : ''}
            />
          </div>

          <div className="input-container">
            <IonInput
              value={applicationUrl}
              onIonChange={e => setApplicationUrl(e.detail.value!)}
              placeholder="Application URL"
              type="url"
              className={applicationUrl ? 'has-value' : ''}
            />
          </div>

          <div className="input-container">
            <div className="tags-container">
              <IonInput
                value={currentTag}
                onIonInput={e => setCurrentTag(e.detail.value!)}
                onKeyPress={handleAddTag}
                placeholder="Add tags (press Enter after each tag)"
                className={currentTag ? 'has-value' : ''}
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
            {tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                {tags.map(tag => (
                  <IonChip key={tag} onClick={() => removeTag(tag)}>
                    <IonLabel>{tag}</IonLabel>
                    <IonIcon icon={closeCircleOutline} />
                  </IonChip>
                ))}
              </div>
            )}
          </div>

          {/* Job Description Upload */}
          <input
            type="file"
            accept="application/pdf"
            onChange={handlePDFChange}
            style={{ display: 'none' }}
            id="pdf-upload"
          />
          <IonButton
            expand="block"
            onClick={() => document.getElementById('pdf-upload')?.click()}
            disabled={parsingPDF}
            style={{ margin: '16px 0' }}
          >
            {parsingPDF ? (
              <>
                <IonSpinner name="crescent" />
                <span className="ion-padding-start">Parsing PDF...</span>
              </>
            ) : jobDescription ? (
              'Change Job Description'
            ) : (
              'Upload Job Description'
            )}
          </IonButton>

          {jobDescription && (
            <div className="ion-margin-top">
              <div style={{ 
                backgroundColor: '#2a2a2a',
                padding: '1rem',
                borderRadius: '8px',
                color: '#fff',
                border: '2px solid rgba(255, 255, 255, 0.2)'
              }}>
                <div style={{ marginBottom: '1rem' }}>
                  <h2 style={{ color: '#fff', fontSize: '1.25rem', marginBottom: '0.5rem' }}>{jobDescription.title}</h2>
                  <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.875rem' }}>
                    {jobDescription.company} • {jobDescription.location}
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <IonChip style={{ '--background': '#333', '--color': '#fff' }}>
                      {jobDescription.employmentType}
                    </IonChip>
                    <IonChip style={{ '--background': '#333', '--color': '#fff' }}>
                      {jobDescription.experienceLevel}
                    </IonChip>
                  </div>
                </div>

                <JobDescriptionAccordion
                  responsibilities={jobDescription.responsibilities}
                  requirements={jobDescription.requirements}
                  skills={jobDescription.skills}
                  benefits={jobDescription.benefits}
                  salary={jobDescription.salary}
                />
              </div>
            </div>
          )}

          {/* Optional Video Upload Section */}
          <div style={{ marginTop: '1rem' }}>
            <IonLabel style={{ color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginBottom: '0.5rem' }}>
              Optional: Add a Video Pitch
            </IonLabel>
            {!Capacitor.isNativePlatform() && (
              <IonSegment 
                value={uploadMode} 
                onIonChange={e => {
                  const newMode = e.detail.value as 'file' | 'record';
                  setUploadMode(newMode);
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
                  <IonLabel>Record Pitch</IonLabel>
                </IonSegmentButton>
              </IonSegment>
            )}

            {uploadMode === 'file' ? (
              <div className="ion-padding-vertical">
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  id="video-upload"
                />
                <IonButton
                  expand="block"
                  onClick={() => document.getElementById('video-upload')?.click()}
                  disabled={uploading}
                >
                  {file ? 'Change Video' : 'Choose Video'}
                </IonButton>

                {file && (
                  <div className="ion-padding-vertical">
                    <video
                      src={previewUrl || undefined}
                      controls
                      style={{
                        width: '100%',
                        borderRadius: '8px',
                        backgroundColor: '#000'
                      }}
                    />
                  </div>
                )}

                {/* Transcription Section */}
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
                      <div className="transcript-preview">
                        <h2 style={{ color: '#fff', marginBottom: '12px' }}>Transcript Preview</h2>
                        <div style={{ 
                          background: '#2a2a2a',
                          padding: '16px',
                          borderRadius: '8px',
                          border: '2px solid rgba(255, 255, 255, 0.2)',
                          color: '#fff',
                          whiteSpace: 'pre-wrap',
                          fontSize: '14px',
                          lineHeight: '1.5'
                        }}>
                          {transcript.text}
                        </div>
                      </div>
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
          </div>

          {error && (
            <div className="ion-padding-vertical ion-text-center">
              <IonLabel color="danger">{error}</IonLabel>
            </div>
          )}

          {slideGenerationError && (
            <div className="ion-padding-vertical ion-text-center">
              <IonLabel color="danger">Error generating slides: {slideGenerationError}</IonLabel>
            </div>
          )}

          <IonButton
            expand="block"
            onClick={handleUpload}
            disabled={uploading || !jobDescription || generatingSlides}
          >
            <IonIcon icon={cloudUploadOutline} slot="start" />
            {uploading ? 'Uploading...' : generatingSlides ? 'Generating Slides...' : 'Post Job'}
          </IonButton>

          {(uploading || generatingSlides) && (
            <div style={{ maxWidth: '600px', margin: '1.5rem auto' }}>
              <IonProgressBar 
                value={uploadProgress / 100}
                style={{ '--progress-background': '#0055ff' }}
              />
              <p style={{ 
                textAlign: 'center', 
                marginTop: '0.5rem',
                color: 'rgba(255, 255, 255, 0.7)'
              }}>
                {generatingSlides ? 'Generating slides and voiceover...' : `Uploading... ${Math.round(uploadProgress)}%`}
              </p>
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
        ion-content {
          --background: #1a1a1a;
          --padding-top: 0;
          --padding-bottom: 0;
          --padding-start: 0;
          --padding-end: 0;
        }

        .input-container {
          margin: 16px 0;
        }

        ion-input {
          --background: transparent !important;
          --color: #fff !important;
          --placeholder-color: rgba(255, 255, 255, 0.5);
          --padding-start: 16px !important;
          --padding-end: 16px !important;
          --border-radius: 8px;
          --highlight-color: #0055ff;
          min-height: 52px;
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
        }

        ion-input::part(wrapper) {
          padding-left: 12px;
        }

        ion-input::part(native) {
          color: #fff !important;
        }

        ion-input:focus-within {
          border-color: #0055ff;
          border-width: 2px;
        }

        ion-input.has-value {
          border-color: rgba(255, 255, 255, 0.3);
        }

        .tags-container {
          display: flex;
          gap: 8px;
          width: 100%;
        }

        ion-button {
          --background: #0055ff;
          --background-hover: #0044cc;
          --color: #fff;
        }

        ion-chip {
          --background: #333;
          --color: #fff;
        }

        .job-description-preview {
          background-color: #f5f5f5 !important;
          color: #000 !important;
        }

        ion-segment {
          background: #2a2a2a;
          border-radius: 8px;
          margin-bottom: 16px;
        }

        ion-segment-button {
          --background: transparent;
          --background-checked: #0055ff;
          --color: #bbb;
          --color-checked: #fff;
        }

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