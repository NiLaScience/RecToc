class ThumbnailService {
  static async generateThumbnail(videoFile: File | string): Promise<File> {
    return new Promise((resolve, reject) => {
      // Create video element
      const video = document.createElement('video');
      const url = typeof videoFile === 'string' ? videoFile : URL.createObjectURL(videoFile);
      
      video.src = url;
      video.crossOrigin = 'anonymous';
      video.currentTime = 1; // Seek to 1 second
      
      video.onloadeddata = () => {
        // Create canvas and draw video frame
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to file
        canvas.toBlob((blob) => {
          if (blob) {
            const thumbnailFile = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
            resolve(thumbnailFile);
          } else {
            reject(new Error('Failed to generate thumbnail'));
          }
        }, 'image/jpeg', 0.7); // 0.7 quality for good balance of quality and size
        
        // Cleanup
        if (typeof videoFile !== 'string') {
          URL.revokeObjectURL(url);
        }
      };
      
      video.onerror = () => {
        reject(new Error('Error loading video'));
        if (typeof videoFile !== 'string') {
          URL.revokeObjectURL(url);
        }
      };
    });
  }
}

export default ThumbnailService; 