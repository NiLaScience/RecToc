const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const path = require('path');

class NodeThumbnailService {
  static async generateThumbnail(videoPath: string): Promise<Buffer> {
    const thumbnailPath = path.join(path.dirname(videoPath), 'temp_thumbnail.jpg');
    
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: ['1'], // Take screenshot at 1 second
          filename: 'temp_thumbnail.jpg',
          folder: path.dirname(videoPath),
          size: '1280x720' // 720p thumbnail
        })
        .on('end', async () => {
          try {
            const thumbnailBuffer = await fs.readFile(thumbnailPath);
            await fs.unlink(thumbnailPath); // Clean up temporary file
            resolve(thumbnailBuffer);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (err: Error) => {
          reject(err);
        });
    });
  }
}

module.exports = NodeThumbnailService; 