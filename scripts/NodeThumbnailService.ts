import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

class NodeThumbnailService {
  static async generateThumbnail(videoPath: string): Promise<Buffer> {
    const thumbnailPath = path.join(os.tmpdir(), `thumbnail_${Date.now()}.jpg`);
    console.log('Attempting to generate thumbnail at:', thumbnailPath);
    
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: ['1'], // Take screenshot at 1 second
          filename: path.basename(thumbnailPath),
          folder: path.dirname(thumbnailPath),
          size: '720x720'
        })
        .on('start', (command) => {
          console.log('FFmpeg command:', command);
        })
        .on('end', async () => {
          try {
            console.log('FFmpeg finished, reading thumbnail file');
            const thumbnailBuffer = await fs.readFile(thumbnailPath);
            console.log('Thumbnail file read successfully');
            await fs.unlink(thumbnailPath);
            console.log('Temporary file cleaned up');
            resolve(thumbnailBuffer);
          } catch (error) {
            console.error('Error processing thumbnail:', error);
            reject(error);
          }
        })
        .on('error', (err: Error) => {
          console.error('FFmpeg error:', err);
          reject(err);
        });
    });
  }
}

export default NodeThumbnailService; 