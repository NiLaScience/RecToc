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

// Initialize with explicit permissions
admin.initializeApp();

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

interface ParserResult {
  text: string | null;
}

// Dynamic imports for ESM modules
const getFetch = async () => {
  const module = await import("node-fetch");
  return module.default;
};

const getFormData = async () => {
  const module = await import("form-data");
  return module.default;
};

export const onPDFUploaded = functions.storage
  .object()
  .onFinalize(async (object) => {
    // Only process PDF files in the pdfs-to-parse directory
    if (
      !object.name?.startsWith("pdfs-to-parse/") ||
      !object.name.endsWith(".pdf")
    ) {
      return;
    }

    const jobId = object.name.split("/").pop()?.replace(".pdf", "");
    if (!jobId) {
      console.error("Could not extract job ID from file name");
      return;
    }

    try {
      const [fetch, FormData] = await Promise.all([getFetch(), getFormData()]);

      // Get the file directly from the bucket
      const bucket = admin.storage().bucket();
      const file = bucket.file(object.name);
      
      console.log("Downloading file:", object.name);
      // Download the file contents
      const [fileContents] = await file.download();
      console.log("File downloaded successfully, size:", fileContents.length);

      // Create form data for the parser service
      const formData = new FormData();
      const filename = object.name.split("/").pop() || "document.pdf";
      console.log("Creating form data with filename:", filename);
      formData.append("files", fileContents, {
        filename,
        contentType: "application/pdf",
      });
      formData.append("strategy", "fast");

      // Log the form data headers
      console.log("Form data headers:", formData.getHeaders());

      // Call the parser service
      console.log("Calling parser service...");
      const parserResponse = await fetch(
        "https://parser.gawntlet.com/api/parse",
        {
          method: "POST",
          body: formData,
          headers: {
            accept: "application/json",
            ...formData.getHeaders(),
          },
        }
      );

      if (!parserResponse.ok) {
        const errorText = await parserResponse.text();
        console.error("Parser service error:", {
          status: parserResponse.status,
          headers: parserResponse.headers,
          error: errorText,
        });
        throw new Error(
          `Parser service returned ${parserResponse.status}: ${errorText}`
        );
      }

      console.log("Parser service response received");
      const data = (await parserResponse.json()) as ParserResult[];
      console.log("Parsed results:", data);
      const text = data
        .map((el) => el.text?.trim())
        .filter(Boolean)
        .join("\n")
        .replace(/\n{3,}/g, "\n\n");

      // Store the result in Firestore
      await admin
        .firestore()
        .collection("parsedPDFs")
        .doc(jobId)
        .set({
          status: "completed",
          text,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

      // Clean up: Delete the uploaded PDF
      await file.delete();
    } catch (error) {
      console.error("Error processing PDF:", error);

      // Store the error in Firestore
      await admin
        .firestore()
        .collection("parsedPDFs")
        .doc(jobId)
        .set({
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
  });

export const onCVUploaded = functions.storage
  .object()
  .onFinalize(async (object) => {
    // Only process PDF files in the cvs-to-parse directory
    if (
      !object.name?.startsWith("cvs-to-parse/") ||
      !object.name.endsWith(".pdf")
    ) {
      return;
    }

    const cvId = object.name.split("/").pop()?.replace(".pdf", "");
    if (!cvId) {
      console.error("Could not extract CV ID from file name");
      return;
    }

    try {
      const [fetch, FormData] = await Promise.all([getFetch(), getFormData()]);

      // Get the file directly from the bucket
      const bucket = admin.storage().bucket();
      const file = bucket.file(object.name);
      
      console.log("Downloading CV file:", object.name);
      // Download the file contents
      const [fileContents] = await file.download();
      console.log(
        "CV file downloaded successfully, size:",
        fileContents.length
      );

      // Create form data for the parser service
      const formData = new FormData();
      const filename = object.name.split("/").pop() || "document.pdf";
      console.log("Creating form data with filename:", filename);
      formData.append("files", fileContents, {
        filename,
        contentType: "application/pdf",
      });
      formData.append("strategy", "fast");

      // Log the form data headers
      console.log("Form data headers:", formData.getHeaders());

      // Call the parser service
      console.log("Calling parser service...");
      const parserResponse = await fetch(
        "https://parser.gawntlet.com/api/parse",
        {
          method: "POST",
          body: formData,
          headers: {
            accept: "application/json",
            ...formData.getHeaders(),
          },
        }
      );

      if (!parserResponse.ok) {
        const errorText = await parserResponse.text();
        console.error("Parser service error:", {
          status: parserResponse.status,
          headers: parserResponse.headers,
          error: errorText,
        });
        throw new Error(
          `Parser service returned ${parserResponse.status}: ${errorText}`
        );
      }

      console.log("Parser service response received");
      const data = (await parserResponse.json()) as ParserResult[];
      console.log("Parsed CV results:", data);
      const text = data
        .map((el) => el.text?.trim())
        .filter(Boolean)
        .join("\n")
        .replace(/\n{3,}/g, "\n\n");

      // Store the result in Firestore
      await admin
        .firestore()
        .collection("parsedCVs")
        .doc(cvId)
        .set({
          status: "completed",
          text,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

      // Clean up: Delete the uploaded PDF
      await file.delete();
    } catch (error) {
      console.error("Error processing CV:", error);

      // Store the error in Firestore
      await admin
        .firestore()
        .collection("parsedCVs")
        .doc(cvId)
        .set({
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
  });

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
