/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import OpenAI from "openai";
import type {JobOpening, UserProfile, JobDescription} from "./types";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize with explicit permissions
admin.initializeApp();

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// Dynamic imports for ESM modules
const getFetch = async () => {
  const module = await import("node-fetch");
  return module.default;
};

interface OpenAIRealtimeResponse {
  client_secret: {
    value: string;
  };
}

export const generateRealtimeToken = functions.https.onCall(async (data, context) => {
  // Ensure user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  // Get OpenAI API key from Firebase config
  const openaiApiKey = functions.config().openai?.key;
  if (!openaiApiKey) {
    console.error("OpenAI API key not configured in Firebase");
    throw new functions.https.HttpsError(
      "failed-precondition",
      "OpenAI API key not configured"
    );
  }

  try {
    const fetch = await getFetch();
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "verse"
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("OpenAI API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      
      throw new functions.https.HttpsError(
        "internal",
        "Failed to generate token from OpenAI"
      );
    }

    const responseData = await response.json() as OpenAIRealtimeResponse;
    
    if (!responseData?.client_secret?.value) {
      console.error("Invalid response format from OpenAI:", responseData);
      throw new functions.https.HttpsError(
        "internal",
        "Invalid response format from OpenAI"
      );
    }

    return {token: responseData.client_secret.value};
  } catch (error) {
    console.error("Error generating token:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Internal error while generating token"
    );
  }
});

const openai = new OpenAI({
  apiKey: functions.config().openai?.key,
});

export const onJobOpeningWrite = functions.firestore
  .document("job_openings/{docId}")
  .onWrite(async (change, context) => {
    const beforeData = change.before.exists 
      ? change.before.data() as JobOpening 
      : { jobDescription: {} } as JobOpening;
    const afterData = change.after.data() as JobOpening || {};

    // Extract relevant text fields from jobDescription
    const { jobDescription } = afterData;
    const combinedText = [
      jobDescription?.title || "",
      jobDescription?.company || "",
      jobDescription?.location || "",
      jobDescription?.employmentType || "",
      jobDescription?.experienceLevel || "",
      jobDescription?.responsibilities ? jobDescription.responsibilities.join(". ") : "",
      jobDescription?.requirements ? jobDescription.requirements.join(". ") : "",
      jobDescription?.skills ? jobDescription.skills.join(". ") : "",
      jobDescription?.benefits ? jobDescription.benefits.join(". ") : "",
    ].filter(Boolean).join(". ");

    // Check if text changed from beforeData
    const { jobDescription: beforeJobDesc } = beforeData;
    const oldCombinedText = [
      beforeJobDesc?.title || "",
      beforeJobDesc?.company || "",
      beforeJobDesc?.location || "",
      beforeJobDesc?.employmentType || "",
      beforeJobDesc?.experienceLevel || "",
      beforeJobDesc?.responsibilities ? beforeJobDesc.responsibilities.join(". ") : "",
      beforeJobDesc?.requirements ? beforeJobDesc.requirements.join(". ") : "",
      beforeJobDesc?.skills ? beforeJobDesc.skills.join(". ") : "",
      beforeJobDesc?.benefits ? beforeJobDesc.benefits.join(". ") : "",
    ].filter(Boolean).join(". ");

    if (combinedText === oldCombinedText) {
      console.log("No relevant text changes detected. Skipping embedding.");
      return;
    }

    try {
      console.log("Generating embedding for job opening:", context.params.docId);
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: combinedText,
        encoding_format: "float",
      });
      
      const embeddingArray = embeddingResponse.data[0].embedding;

      await change.after.ref.update({
        embedding: embeddingArray,
        last_embedded: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      console.log(
        `Embedding stored successfully for job_openings/${context.params.docId}`
      );
    } catch (err) {
      console.error(
        `Error creating embedding for job_openings/${context.params.docId}`,
        err
      );
      await change.after.ref.update({
        embedding_error: err instanceof Error ? err.message : "Unknown error",
        last_embedding_attempt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

export const onUserProfileWrite = functions.firestore
  .document("users/{uid}")
  .onWrite(async (change, context) => {
    const beforeData = change.before.exists 
      ? change.before.data() as UserProfile 
      : { displayName: "", description: "", cv: {} } as UserProfile;
    const afterData = change.after.data() as UserProfile || {};

    // Extract relevant text fields
    const { displayName, description, cv } = afterData;
    const combinedText = [
      displayName,
      description,
      // Personal Info
      cv?.personalInfo?.summary,
      cv?.personalInfo?.location,
      // Experience
      cv?.experience?.map((exp: { title: string; company: string; highlights: string[] }) => [
        exp.title,
        exp.company,
        ...exp.highlights
      ].join(". ")).join(". "),
      // Education
      cv?.education?.map((edu: { institution: string; degree: string; field: string }) => [
        edu.institution,
        edu.degree,
        edu.field
      ].join(", ")).join(". "),
      // Skills
      cv?.skills?.map((skill: { category: string; items: string[] }) => [
        skill.category,
        skill.items.join(", ")
      ].join(": ")).join(". ")
    ].filter(Boolean).join(". ");

    const { displayName: oldDisplayName, description: oldDescription, cv: oldCV } = beforeData;
    const oldCombinedText = [
      oldDisplayName,
      oldDescription,
      // Personal Info
      oldCV?.personalInfo?.summary,
      oldCV?.personalInfo?.location,
      // Experience
      oldCV?.experience?.map((exp: { title: string; company: string; highlights: string[] }) => [
        exp.title,
        exp.company,
        ...exp.highlights
      ].join(". ")).join(". "),
      // Education
      oldCV?.education?.map((edu: { institution: string; degree: string; field: string }) => [
        edu.institution,
        edu.degree,
        edu.field
      ].join(", ")).join(". "),
      // Skills
      oldCV?.skills?.map((skill: { category: string; items: string[] }) => [
        skill.category,
        skill.items.join(", ")
      ].join(": ")).join(". ")
    ].filter(Boolean).join(". ");

    if (combinedText === oldCombinedText) {
      console.log("No relevant text changes detected. Skipping embedding.");
      return;
    }

    try {
      console.log("Generating embedding for user profile:", context.params.uid);
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: combinedText,
        encoding_format: "float",
      });
      
      const embeddingArray = embeddingResponse.data[0].embedding;

      await change.after.ref.update({
        embedding: embeddingArray,
        last_embedded: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      console.log(
        `Embedding stored successfully for users/${context.params.uid}`
      );
    } catch (err) {
      console.error(
        `Error creating embedding for users/${context.params.uid}`,
        err
      );
      await change.after.ref.update({
        embedding_error: err instanceof Error ? err.message : "Unknown error",
        last_embedding_attempt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

// Gemini API endpoint
export const callGeminiAPI = functions.https.onCall(async (data, context) => {
  // Ensure user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }

  // Get Gemini API key from Firebase config
  const geminiApiKey = functions.config().gemini?.key;
  if (!geminiApiKey) {
    console.error("Gemini API key not configured in Firebase");
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Gemini API key not configured",
    );
  }

  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    // If we're getting a PDF URL, fetch it first
    if (data.payload.contents?.[0]?.parts?.[0]?.inlineData?.mimeType === "application/pdf") {
      const fetch = await getFetch();
      const pdfUrl = data.payload.contents[0].parts[0].inlineData.data;
      
      console.log("Fetching PDF from URL:", pdfUrl);
      
      // Fetch the PDF
      const pdfResponse = await fetch(pdfUrl);
      if (!pdfResponse.ok) {
        throw new Error(`Failed to fetch PDF: ${pdfResponse.statusText}`);
      }
      
      const pdfBuffer = await pdfResponse.arrayBuffer();
      const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");
      
      console.log("PDF converted to base64, length:", pdfBase64.length);

      // First extract text from PDF
      console.log("Extracting text from PDF...");
      const extractionResult = await model.generateContent({
        contents: [{
          role: "user",
          parts: [{
            inlineData: {
              data: pdfBase64,
              mimeType: "application/pdf"
            }
          }, {
            text: "Extract all text from this document"
          }]
        }]
      });

      if (!extractionResult.response) {
        throw new Error("No response from Gemini API during text extraction");
      }

      const extractedText = extractionResult.response.text();
      console.log("Extracted text length:", extractedText.length);

      // Then process the extracted text with the provided instructions
      const instructions = data.payload.contents[0].parts[1]?.text || "";
      console.log("Processing text with instructions:", instructions);
      
      const processingResult = await model.generateContent({
        contents: [{
          role: "user",
          parts: [{
            text: extractedText
          }, {
            text: instructions
          }]
        }]
      });

      if (!processingResult.response) {
        throw new Error("No response from Gemini API during text processing");
      }

      const processedText = processingResult.response.text();
      console.log("Processed text length:", processedText.length);

      return {
        candidates: [{
          content: {
            parts: [{
              text: processedText,
            }],
          },
        }],
      };
    }

    // For non-PDF requests, just pass through to Gemini
    console.log("Processing non-PDF request");
    const result = await model.generateContent({
      contents: data.payload.contents
    });
    
    if (!result.response) {
      throw new Error("No response from Gemini API");
    }

    const responseText = result.response.text();
    console.log("Response text length:", responseText.length);

    return {
      candidates: [{
        content: {
          parts: [{
            text: responseText,
          }],
        },
      }],
    };
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw new functions.https.HttpsError(
      "internal",
      `Error processing Gemini API request: ${errorMessage}`,
    );
  }
});

// OpenAI API endpoint
export const callOpenAIAPI = functions.https.onCall(async (data, context) => {
  // Ensure user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }

  // Get OpenAI API key from Firebase config
  const openaiApiKey = functions.config().openai?.key;
  if (!openaiApiKey) {
    console.error("OpenAI API key not configured in Firebase");
    throw new functions.https.HttpsError(
      "failed-precondition",
      "OpenAI API key not configured",
    );
  }

  try {
    const openai = new OpenAI({ apiKey: openaiApiKey });
    
    // Handle different types of OpenAI API calls based on the request type
    switch (data.type) {
      case 'transcription':
        const transcription = await openai.audio.transcriptions.create({
          file: data.audioData,
          model: "whisper-1",
          ...data.options,
        });
        return transcription;
      
      default:
        throw new Error(`Unsupported OpenAI API call type: ${data.type}`);
    }
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Error processing OpenAI API request",
    );
  }
});

interface SlideData {
  title: string;
  heading: string;
  bullet_points: string[];
  image_prompt: string;
}

async function generateDalleImage(prompt: string, jobId: string, slideIndex: number): Promise<string> {
  console.log('Starting generateDalleImage with prompt:', prompt);
  
  try {
    const enhancedPrompt = `${prompt}. The image should be high quality, visually striking, and optimized for social media. Use vibrant colors and modern design elements.`;
    console.log('Enhanced prompt:', enhancedPrompt);

    // Generate image with DALL-E
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: enhancedPrompt,
      size: "1024x1024",
      quality: "standard",
      n: 1,
    });
    console.log('Received DALL-E response');

    if (!response.data[0].url) {
      console.error('No image URL in DALL-E response');
      throw new Error("No image URL generated");
    }

    // Download the image
    const fetch = await getFetch();
    const imageResponse = await fetch(response.data[0].url);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.statusText}`);
    }
    const imageBuffer = await imageResponse.buffer();

    // Upload to Firebase Storage
    const storagePath = `job_slides/${jobId}/slide_${slideIndex}.png`;
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    
    await file.save(imageBuffer, {
      metadata: {
        contentType: 'image/png'
      }
    });

    console.log('Successfully uploaded image to Firebase Storage:', storagePath);
    return storagePath;
  } catch (error) {
    console.error('Error in generateDalleImage:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    throw error;
  }
}

async function generateSlidesContent(jobData: JobDescription, jobId: string): Promise<{ slides: SlideData[] }> {
  console.log('Starting generateSlidesContent...');
  
  if (!functions.config().openai?.key) {
    console.error('OpenAI API key not found in config');
    throw new functions.https.HttpsError(
      'failed-precondition',
      'OpenAI API key not configured'
    );
  }

  try {
    const styles = [
      "minimalist and modern",
      "vibrant and energetic",
      "professional and sleek",
      "tech-inspired and futuristic",
      "warm and inviting",
      "bold and dynamic",
      "clean and sophisticated",
      "creative and innovative"
    ];
    const chosenStyle = styles[Math.floor(Math.random() * styles.length)];
    console.log('Selected style:', chosenStyle);

    const promptMessage = `Generate a JSON array of exactly 4 slides for a job posting. Return ONLY the raw JSON array without any markdown formatting, code blocks, or backticks.

Each slide should have these exact fields:
{
  "title": string,
  "heading": string,
  "bullets": string[],
  "image_prompt": string
}

The 4 slides should be:
1. "Highlights" - Include job title, company, location, and best perk
2. "${jobData.company || "Company"}" - Company name as heading with short description
3. "${jobData.title}" - Job title as heading with key requirements
4. "Why Apply?" - Top 3 reasons to apply, specific to this role

Make bullet points concise (max 5 words each).
For image_prompt, describe a relevant image that matches style: ${chosenStyle}

Job Details:
${JSON.stringify(jobData, null, 2)}

Remember: Return ONLY the raw JSON array. No markdown. No \`\`\`. No explanation.`;

    console.log('Creating OpenAI chat completion...');
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { 
          role: "system", 
          content: "You are a JSON generator. Output only valid JSON arrays without any markdown formatting or explanation."
        },
        { role: "user", content: promptMessage }
      ]
    });
    console.log('Received OpenAI response');

    const outputText = response.choices[0].message.content;
    if (!outputText) {
      console.error('No content generated by OpenAI');
      throw new Error("No content generated");
    }
    console.log('Generated content:', outputText);

    try {
      const parsedSlides = JSON.parse(outputText.trim());
      console.log('Successfully parsed slides JSON');

      // Validate the structure
      if (!Array.isArray(parsedSlides) || parsedSlides.length !== 4) {
        throw new Error('Invalid slides format: expected array of 4 slides');
      }

      // Validate each slide
      parsedSlides.forEach((slide, index) => {
        if (!slide.title || !slide.heading || !Array.isArray(slide.bullets) || !slide.image_prompt) {
          throw new Error(`Invalid slide format at index ${index}`);
        }
      });

      // Generate images for each slide
      const slidesWithImages = await Promise.all(
        parsedSlides.map(async (slide, index) => {
          const backgroundImageUrl = await generateDalleImage(slide.image_prompt, jobId, index);
          return {
            ...slide,
            backgroundImageUrl
          };
        })
      );

      return { slides: slidesWithImages };
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      console.error('Raw response:', outputText);
      throw new Error(
        `Failed to parse OpenAI response: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`
      );
    }
  } catch (error) {
    console.error('Error in generateSlidesContent:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    throw error;
  }
}

export const generateJobSlides = functions.https.onCall(async (data: {
  jobData: JobDescription;
  jobId: string;
}, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    console.log('Starting generateJobSlides with data:', {
      jobId: data.jobId,
      jobData: JSON.stringify(data.jobData, null, 2)
    });

    // Generate slide content with images
    console.log('Generating slide content...');
    const slidesContent = await generateSlidesContent(data.jobData, data.jobId);
    console.log('Generated slides content:', JSON.stringify(slidesContent, null, 2));

    // Create or update the job document
    console.log('Creating/updating job document in Firestore...');
    const jobRef = admin.firestore().collection('job_openings').doc(data.jobId);
    
    // Get the document
    const doc = await jobRef.get();
    
    if (!doc.exists) {
      // Document doesn't exist, create it with initial data
      console.log('Document does not exist, creating it...');
      await jobRef.set({
        id: data.jobId,
        title: data.jobData.title || '',
        jobDescription: data.jobData,
        slides: slidesContent.slides,
        userId: context.auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        views: 0,
        likes: 0
      });
    } else {
      // Document exists, just update the slides
      console.log('Document exists, updating slides...');
      await jobRef.update({
        slides: slidesContent.slides
      });
    }
    console.log('Slides stored successfully');

    return { slides: slidesContent.slides, status: 'complete' };
  } catch (error) {
    console.error('Error in generateJobSlides:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    throw new functions.https.HttpsError('internal', 
      `Error generating slides: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
});

export const generateVoiceover = functions.https.onCall(async (data: {
  jobData: JobDescription;
  jobId: string;
}, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const script = await generateVoiceoverScript(data.jobData);
    const audioData = await generateVoiceoverAudio(script, data.jobId);
    
    // Upload audio to Firebase Storage
    const bucket = admin.storage().bucket();
    const audioFileName = `voiceovers/${data.jobId}.mp3`;
    const file = bucket.file(audioFileName);
    
    await file.save(Buffer.from(audioData, 'base64'), {
      metadata: {
        contentType: 'audio/mp3'
      }
    });

    // Get the public URL
    const bucketName = bucket.name;
    const voiceoverUrl = `https://storage.googleapis.com/${bucketName}/${audioFileName}`;

    // Update job with voiceover URL
    await admin.firestore().collection('job_openings').doc(data.jobId).update({
      voiceoverUrl: voiceoverUrl
    });

    return { voiceoverUrl };
  } catch (error) {
    console.error('Error in generateVoiceover:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    throw new functions.https.HttpsError('internal', 'Error generating voiceover');
  }
});

// Helper functions
async function generateVoiceoverScript(jobData: JobDescription): Promise<string> {
  const prompt = `Create a word-for-word script for a 1-minute pitch about this job opportunity (150 words).
  Don't focus on the job title, take as much information as you can from the job description.
  Make it engaging and conversational, more casual than a normal job description, but professional.

  Job Details:
  - Title: ${jobData.title}
  - Company: ${jobData.company || "Company"}
  - Location: ${jobData.location || "Location not specified"}
  - Description: ${JSON.stringify(jobData)}

  Do not add any formatting to the response. Just write the words as they would sound in natural conversation.
  Include any relevant insights about ${jobData.company || "the company"} or ${jobData.location || "the location"} that aren't in the job description.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: "You are recruiter writing scripts for job pitches that will be converted to audio using a tts model. Your goal is to motive candidates to apply for the job. Do not waste any time on introductions or flowery language, you want to engage people as quickly as possible by getting them excited about what makes the job stand out."
      },
      { role: "user", content: prompt }
    ]
  });

  return completion.choices[0].message.content || "";
}

async function generateVoiceoverAudio(script: string, jobId: string): Promise<string> {
  console.log('Starting generateVoiceoverAudio...');
  
  // Check for OpenAI API key
  const openaiApiKey = functions.config().openai?.key;
  if (!openaiApiKey) {
    console.error('OpenAI API key not found in config');
    throw new functions.https.HttpsError(
      'failed-precondition',
      'OpenAI API key not configured'
    );
  }

  try {
    const voices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;
    const randomVoice = voices[Math.floor(Math.random() * voices.length)];
    console.log('Selected voice:', randomVoice);

    const openai = new OpenAI({ apiKey: openaiApiKey });
    console.log('Creating TTS with OpenAI...');

    const response = await openai.audio.speech.create({
      model: "tts-1-hd",
      voice: randomVoice,
      input: script
    });

    console.log('Successfully generated audio');
    const audioData = await response.arrayBuffer();
    return Buffer.from(audioData).toString('base64');
  } catch (error) {
    console.error('Error in generateVoiceoverAudio:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    throw new functions.https.HttpsError(
      'internal',
      `Error generating audio: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
