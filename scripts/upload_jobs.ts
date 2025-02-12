require('dotenv').config();

// Add debug logging
console.log('Environment variables:', {
  NEXT_PUBLIC_GEMINI_API_KEY: process.env.NEXT_PUBLIC_GEMINI_API_KEY,
  FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
});

const admin = require('firebase-admin');
const { getStorage } = require('firebase-admin/storage');
const { getFirestore } = require('firebase-admin/firestore');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const fs = require('fs').promises;
const path = require('path');
const { File } = require('@web-std/file');
const { GeminiParserService } = require('../src/services/GeminiParserService');
const PDFParserService = require('../src/services/PDFParserService');
import NodeThumbnailService from './NodeThumbnailService';
import NodeTranscriptionService from './NodeTranscriptionService';
import type { JobDescriptionSchema } from '../src/services/OpenAIService';
import { NodeGeminiParserService } from './NodeGeminiParserService';

// Initialize Firebase Admin
const serviceAccount = require('../service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
});

const storage = getStorage().bucket();
const db = getFirestore();

// Absolute paths
const DB_PATH = '/Users/gauntlet/Documents/projects/jobs/linkedinscraper/data/my_database.db';
const VIDEOS_DIR = '/Users/gauntlet/Documents/projects/jobs/linkedinscraper/videos';

interface JobRecord {
  id: number;
  title: string;
  company: string;
  location: string;
  date: string;
  job_url: string;
  job_description: string;
  pitch_script: string | null;
  date_loaded: string;
}

async function ensureDirectoriesExist() {
  // Ensure database directory exists
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  
  // Ensure videos directory exists
  await fs.mkdir(VIDEOS_DIR, { recursive: true });
}

async function uploadVideo(videoPath: string, jobId: string, userId: string): Promise<[string, string]> {
  // Validate video path
  try {
    const stats = await fs.stat(videoPath);
    console.log(`Video file exists: ${videoPath}`);
    console.log(`File stats:`, stats);
  } catch (error) {
    console.error(`Error accessing video file: ${videoPath}`, error);
    throw new Error(`Video file not accessible: ${videoPath}`);
  }

  // Read video file
  const fileBuffer = await fs.readFile(videoPath);

  // Generate thumbnail
  console.log(`Generating thumbnail for job ${jobId}...`);
  console.log(`Video path: ${videoPath}`);
  const thumbnailBuffer = await NodeThumbnailService.generateThumbnail(videoPath);

  // Upload video - use same path structure as Upload component
  const videoDestination = `videos/${userId}/${path.basename(videoPath)}`;
  const videoFile = storage.file(videoDestination);
  await videoFile.save(fileBuffer, {
    metadata: {
      contentType: 'video/mp4'
    }
  });
  const [videoUrl] = await videoFile.getSignedUrl({
    action: 'read',
    expires: '03-01-2500' // Far future expiration
  });

  // Upload thumbnail - use same path structure as Upload component
  const thumbnailDestination = `thumbnails/${userId}/${jobId}/thumbnail.jpg`;
  const thumbnailFile = storage.file(thumbnailDestination);
  await thumbnailFile.save(thumbnailBuffer, {
    metadata: {
      contentType: 'image/jpeg'
    }
  });
  const [thumbnailUrl] = await thumbnailFile.getSignedUrl({
    action: 'read',
    expires: '03-01-2500' // Far future expiration
  });

  return [videoUrl, thumbnailUrl];
}

async function parseJobDescription(text: string, useGemini: boolean = true): Promise<JobDescriptionSchema> {
  if (useGemini) {
    const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!geminiApiKey) {
      throw new Error('NEXT_PUBLIC_GEMINI_API_KEY is not configured in your environment');
    }
    const geminiParser = new NodeGeminiParserService(geminiApiKey);
    return await geminiParser.parseJobDescription(text);
  } else {
    // Use OpenAI parsing through PDFParserService
    // Note: This would normally expect a PDF file, but we're adapting it for text
    const blob = new Blob([text], { type: 'application/pdf' });
    const file = new File([blob], 'job_description.pdf', { type: 'application/pdf' });
    return await PDFParserService.parsePDF(file);
  }
}

async function uploadJobs(adminUid: string, useGemini: boolean = true) {
  await ensureDirectoriesExist();

  // Open SQLite database
  const sqliteDb = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  try {
    // Get all jobs from the database with required fields
    const jobs = await sqliteDb.all(`
      SELECT 
        id,
        title,
        company,
        location,
        date,
        job_url,
        job_description,
        pitch_script,
        date_loaded
      FROM jobs 
      WHERE pitch_script IS NOT NULL
        AND length(job_description) > 100
    `) as JobRecord[];

    for (const job of jobs) {
      // Find corresponding video file
      const videoFiles = await fs.readdir(VIDEOS_DIR);
      const videoFile = videoFiles.find((file: string) => file.startsWith(job.id.toString()));

      if (!videoFile) {
        console.log(`No video found for job ${job.id}, skipping...`);
        continue;
      }

      // Upload video and generate thumbnail
      const videoPath = path.join(VIDEOS_DIR, videoFile);
      const [videoUrl, thumbnailUrl] = await uploadVideo(videoPath, job.id.toString(), adminUid);

      // Parse job description using existing services
      console.log(`Parsing job description for ${job.id}...`);
      const parsedJobDescription = await parseJobDescription(job.job_description, useGemini);

      // Transcribe video to get proper timestamps
      console.log(`Transcribing video for job ${job.id}...`);
      const transcriptionResult = await NodeTranscriptionService.transcribeVideo(videoPath);

      // Extract tags from job description (similar to Upload component)
      const tags = [
        job.company,
        ...parsedJobDescription.skills.slice(0, 3), // Take top 3 skills as tags
        parsedJobDescription.employmentType,
        parsedJobDescription.experienceLevel
      ].filter(Boolean); // Remove any null/undefined values

      // Prepare job data for Firestore - match Upload component structure exactly
      const jobData = {
        id: job.id.toString(),
        title: job.title,
        videoUrl,
        thumbnailUrl,
        jobDescription: {
          ...parsedJobDescription,
          // Override with database values if needed
          title: job.title,
          company: job.company,
          location: job.location,
          applicationUrl: job.job_url
        },
        tags,
        userId: adminUid,
        createdAt: new Date().toISOString(), // Use current timestamp like Upload component
        views: 0,
        likes: 0,
        transcript: transcriptionResult
      };

      // Add to Firestore
      await db.collection('videos').add(jobData);
      console.log(`Uploaded job ${job.id} with thumbnail and transcript`);
    }
  } catch (error) {
    console.error('Error uploading jobs:', error);
    throw error;
  } finally {
    await sqliteDb.close();
  }
}

// Usage example
if (require.main === module) {
  const adminUid = process.argv[2]; // Firebase Authentication UID of the admin user
  const useGemini = process.argv[3] !== 'false'; // Default to true unless explicitly set to false

  if (!adminUid) {
    console.error('Usage: ts-node upload_jobs.ts <admin_firebase_uid> [use_gemini]');
    console.error('Note: The admin_firebase_uid should be the Firebase Authentication UID of the admin user');
    process.exit(1);
  }

  uploadJobs(adminUid, useGemini)
    .then(() => {
      console.log('All jobs uploaded successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed to upload jobs:', error);
      process.exit(1);
    });
}

module.exports = { uploadJobs }; 