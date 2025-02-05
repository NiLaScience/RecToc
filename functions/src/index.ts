/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { ObjectMetadata } from "firebase-functions/v1/storage";

// Initialize with explicit permissions
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  storageBucket: "rec-toc-56a25.appspot.com"
});

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

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
  .onFinalize(async (object: ObjectMetadata) => {
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
      const bucket = admin.storage().bucket(object.bucket);
      const file = bucket.file(object.name);
      
      console.log("Downloading file:", object.name);
      // Download the file contents
      const [fileContents] = await file.download();
      console.log("File downloaded successfully, size:", fileContents.length);

      // Create form data for the parser service
      const formData = new FormData();
      const filename = object.name.split("/").pop() || "document.pdf";
      console.log("Creating form data with filename:", filename);
      formData.append("files", fileContents, {filename,
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
