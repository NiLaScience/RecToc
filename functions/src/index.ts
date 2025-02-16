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
import type {JobOpening, UserProfile} from "./types";

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
    const fetch = await getFetch();
    const apiUrl = "https://generativelanguage.googleapis.com/v1/models/" +
      "gemini-pro:generateContent";
    const response = await fetch(`${apiUrl}?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data.payload),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Error processing Gemini API request",
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
