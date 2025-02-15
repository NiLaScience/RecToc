require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs/promises';
import path from 'path';
import { File } from '@web-std/file';

import { NodeGeminiParserService } from './NodeGeminiParserService';
import PDFParserService from '../src/services/PDFParserService';
import NodeThumbnailService from './NodeThumbnailService';
import NodeTranscriptionService from './NodeTranscriptionService';
import type { JobDescriptionSchema } from '../src/services/OpenAIService';

//
// 1) Initialize Firebase Admin
//    (Replace service-account.json with your real service account credentials.)
//
const serviceAccount = require('../service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'rec-toc-56a25.firebasestorage.app',  // Explicitly set the bucket
});

const db = getFirestore();
const bucket = getStorage().bucket();

//
// 2) Constants
//
const DB_PATH = '/Users/gauntlet/Documents/projects/jobs/data/my_database.db';
const VIDEOS_DIR = '/Users/gauntlet/Documents/projects/jobs/videos';

// The local DB "jobs" table has records shaped roughly like:
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

interface TranscriptionResult {
  text: string;
  segments: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

//
// 3) Utility to ensure directories exist
//
async function ensureDirectoriesExist() {
  // Make sure DB path directory exists
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  // Make sure videos directory exists
  await fs.mkdir(VIDEOS_DIR, { recursive: true });
}

//
// 4) Upload a single video to Firebase Storage
//    and generate a thumbnail.
//
async function uploadVideo(
  videoPath: string,
  userId: string
): Promise<{ videoUrl: string; thumbnailUrl: string }> {
  // Validate existence
  await fs.access(videoPath);

  // Read bytes
  const fileBuffer = await fs.readFile(videoPath);

  // Generate thumbnail via Node script
  const thumbnailBuffer = await NodeThumbnailService.generateThumbnail(videoPath);

  //
  // Upload the video
  //
  const videoFileName = path.basename(videoPath); // e.g. "1234.mp4"
  const videoStoragePath = `videos/${userId}/${videoFileName}`;
  const videoFile = bucket.file(videoStoragePath);

  await videoFile.save(fileBuffer, {
    metadata: { contentType: 'video/mp4' },
  });

  const [videoUrl] = await videoFile.getSignedUrl({
    action: 'read',
    expires: '03-01-2500',
  });

  //
  // Upload the thumbnail
  //
  const thumbnailFileName = `thumbnail-${Date.now()}.jpg`;
  const thumbnailStoragePath = `thumbnails/${userId}/${thumbnailFileName}`;
  const thumbnailFile = bucket.file(thumbnailStoragePath);

  await thumbnailFile.save(thumbnailBuffer, {
    metadata: { contentType: 'image/jpeg' },
  });

  const [thumbnailUrl] = await thumbnailFile.getSignedUrl({
    action: 'read',
    expires: '03-01-2500',
  });

  return { videoUrl, thumbnailUrl };
}

//
// 5) Parse a job description with optional Gemini or PDF approach
//
async function parseJobDescription(
  text: string,
  useGemini = true
): Promise<JobDescriptionSchema> {
  if (useGemini) {
    const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!geminiApiKey) {
      throw new Error(
        'NEXT_PUBLIC_GEMINI_API_KEY is not configured in your environment'
      );
    }
    const geminiParser = new NodeGeminiParserService(geminiApiKey);
    // The parseJobDescription in NodeGeminiParserService expects plain text,
    // but your local code base64-encodes job text. If that's correct, do:
    return await geminiParser.parseJobDescription(text);
  } else {
    // Fall back to PDF parser
    // (But you're feeding it text, so adapt if needed.)
    const fakePDFFile = new File([text], 'job_description.pdf', {
      type: 'application/pdf',
    });
    return await PDFParserService.parsePDF(fakePDFFile);
  }
}

//
// 6) Transcribe the video with NodeTranscriptionService
//
async function transcribeVideo(videoPath: string): Promise<TranscriptionResult> {
  return await NodeTranscriptionService.transcribeVideo(videoPath);
}

//
// 7) Generate tags from job data + parsed fields
//
function generateTags(
  job: JobRecord,
  parsed: JobDescriptionSchema
): string[] {
  const tags = new Set<string>();

  if (job.company) tags.add(job.company.trim());
  if (parsed.employmentType) tags.add(parsed.employmentType.trim());
  if (parsed.experienceLevel) tags.add(parsed.experienceLevel.trim());
  if (parsed.skills && parsed.skills.length > 0) {
    parsed.skills.slice(0, 3).forEach((skill) => tags.add(skill.trim()));
  }
  if (job.location) tags.add(job.location.trim());

  return Array.from(tags);
}

//
// 8) Main function that processes jobs from local SQLite
//    and uploads them to Firestore
//
async function uploadJobs(adminUid: string, useGemini = true) {
  await ensureDirectoriesExist();

  // Open the SQLite DB
  const sqliteDb = await open({
    filename: DB_PATH,
    driver: sqlite3.Database,
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
        AND job_url IS NOT NULL
        AND trim(job_url) != ''
    `) as JobRecord[];

    console.log(`Found ${jobs.length} jobs to process`);

    let processedCount = 0;
    let skippedCount = 0;

    for (const job of jobs) {
      try {
        // In your existing logic you matched files named "job.id.mp4"
        const videoFileName = `${job.id}.mp4`; // or .mov, etc.
        const videoPath = path.join(VIDEOS_DIR, videoFileName);

        // Check that video actually exists
        try {
          await fs.access(videoPath);
        } catch {
          console.log(`No matching video found for job ${job.id}; skipping.`);
          skippedCount++;
          continue;
        }

        console.log(`Uploading video for job ID ${job.id}...`);
        const { videoUrl, thumbnailUrl } = await uploadVideo(videoPath, adminUid);

        // Parse job description
        console.log(`Parsing job description for job ID ${job.id}...`);
        const parsed = await parseJobDescription(job.job_description, useGemini);

        // Transcribe the video
        console.log(`Transcribing video for job ID ${job.id}...`);
        const rawTranscript = await transcribeVideo(videoPath);

        // Format transcript to match the shape used by Upload.tsx
        // We typically store:
        //   { text: string; segments: { id: string, start: number, end: number, text: string }[] }
        const transcript = {
          text: rawTranscript.text,
          segments: rawTranscript.segments.map((segment, index) => ({
            id: index.toString(),
            start: segment.start,
            end: segment.end,
            text: segment.text,
          })),
        };

        // Build tags
        const tags = generateTags(job, parsed);

        // Prepare the jobDescription to fit the app's shape
        // (making sure salary is `parsed.salary || null`)
        const jobDescription = {
          title: parsed.title || job.title || 'Untitled',
          company: parsed.company || job.company || '',
          location: parsed.location || job.location || '',
          employmentType: parsed.employmentType || 'Full-time',
          experienceLevel: parsed.experienceLevel || '',
          responsibilities: parsed.responsibilities || [],
          requirements: parsed.requirements || [],
          skills: parsed.skills || [],
          benefits: parsed.benefits || [],
          salary: parsed.salary ?? null
        };

        //
        // This is the crucial part:
        //  - DO NOT store an `id:` field that collides with the doc ID.
        //  - Instead, let Firestore assign its own doc ID, or if you really want the doc ID
        //    to match `job.id.toString()`, you must explicitly do doc(job.id.toString()).set(...).
        //
        const documentData = {
          title: job.title,
          videoUrl,
          thumbnailUrl,
          jobDescription,
          applicationUrl: job.job_url,
          tags,
          userId: adminUid,
          createdAt: new Date().toISOString(),
          views: 0,
          likes: 0,
          transcript
        };

        //
        // Firestore: add doc with random ID
        // or:
        //   .doc(job.id.toString()).set(documentData)   // if you want the doc ID = local job ID
        //
        await db.collection('videos').add(documentData);

        console.log(`Successfully uploaded job ${job.id}`);
        processedCount++;
      } catch (err) {
        console.error(`Error processing job ${job.id}:`, err);
        skippedCount++;
      }
    }

    console.log(
      `Finished. Processed = ${processedCount}, Skipped = ${skippedCount}, total = ${jobs.length}`
    );
  } catch (error) {
    console.error('Unhandled error in uploadJobs:', error);
    throw error;
  } finally {
    await sqliteDb.close();
  }
}

//
// 9) CLI usage
//
if (require.main === module) {
  const adminUid = process.argv[2];
  const geminiArg = process.argv[3];
  const useGemini = geminiArg !== 'false';

  if (!adminUid) {
    console.error('Usage: ts-node upload_jobs.ts <admin_firebase_uid> [use_gemini]');
    process.exit(1);
  }

  uploadJobs(adminUid, useGemini)
    .then(() => {
      console.log('All jobs uploaded successfully');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Failed to upload jobs:', err);
      process.exit(1);
    });
}

export { uploadJobs };
