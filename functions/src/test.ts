import * as admin from "firebase-admin";
import { applicationDefault } from "firebase-admin/app";

// Initialize Firebase Admin with default credentials
admin.initializeApp({
  credential: applicationDefault(),
  storageBucket: "rec-toc-56a25.firebasestorage.app"
});

async function uploadPDFForTesting() {
  try {
    const bucket = admin.storage().bucket();
    const pdfPath = "/Users/gauntlet/Documents/projects/rectoc-cursor/docs/Venture & Corporate Finance Intern_ra_2025.pdf";
    const destinationPath = "pdfs-to-parse/test-job-description.pdf";

    console.log("Starting PDF upload...");
    
    await bucket.upload(pdfPath, {
      destination: destinationPath,
      metadata: {
        contentType: "application/pdf",
      },
    });

    console.log("PDF uploaded successfully!");
    console.log(`File uploaded to: ${destinationPath}`);
    
  } catch (error) {
    console.error("Error uploading PDF:", error);
  }
}

// Run the upload
uploadPDFForTesting(); 