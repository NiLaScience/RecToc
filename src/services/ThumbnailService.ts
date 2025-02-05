class ThumbnailService {
  static async generateThumbnail(videoFile: File | string): Promise<File> {
    return new Promise((resolve, reject) => {
      // Create video element
      const video = document.createElement('video');
      const url = typeof videoFile === 'string' ? videoFile : URL.createObjectURL(videoFile);
      
      video.src = url;
      video.crossOrigin = 'anonymous';
      video.preload = 'metadata';
      
      const cleanup = () => {
        video.pause();
        video.removeAttribute('src');
        video.load(); // Ensures media resources are released
        if (typeof videoFile !== 'string') {
          URL.revokeObjectURL(url);
        }
        video.remove();
      };
      
      video.onloadedmetadata = () => {
        // Set current time after metadata is loaded
        video.currentTime = 1; // Seek to 1 second
      };
      
      video.onseeked = () => {
        try {
          // Create canvas and draw video frame
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            cleanup();
            reject(new Error('Failed to get canvas context'));
            return;
          }
          
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Convert canvas to file
          canvas.toBlob((blob) => {
            if (blob) {
              const thumbnailFile = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
              cleanup();
              resolve(thumbnailFile);
            } else {
              cleanup();
              reject(new Error('Failed to generate thumbnail'));
            }
            canvas.remove();
          }, 'image/jpeg', 0.7); // 0.7 quality for good balance of quality and size
        } catch (error) {
          cleanup();
          reject(error);
        }
      };
      
      video.onerror = () => {
        const error = video.error?.message || 'Error loading video';
        cleanup();
        reject(new Error(error));
      };
    });
  }
}

export default ThumbnailService; 