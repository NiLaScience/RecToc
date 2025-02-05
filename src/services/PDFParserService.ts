import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import OpenAIService, { JobDescriptionSchema } from './OpenAIService';

class PDFParserService {
  static async parsePDF(pdfFile: File): Promise<JobDescriptionSchema> {
    try {
      const storage = getStorage();
      const db = getFirestore();
      
      // Generate unique ID for this parsing job
      const jobId = uuidv4();
      
      // Upload PDF to Firebase Storage
      const pdfRef = ref(storage, `pdfs-to-parse/${jobId}.pdf`);
      await uploadBytes(pdfRef, pdfFile);
      
      // Get the download URL (needed by Cloud Function)
      await getDownloadURL(pdfRef);

      // Wait for the parsed result in Firestore
      const rawText = await new Promise<string>((resolve, reject) => {
        const unsubscribe = onSnapshot(
          doc(db, 'parsedPDFs', jobId),
          (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data();
              if (data.status === 'completed' && data.text) {
                unsubscribe();
                resolve(data.text);
              } else if (data.status === 'error') {
                unsubscribe();
                reject(new Error(data.error || 'PDF parsing failed'));
              }
            }
          },
          (error) => {
            unsubscribe();
            reject(error);
          }
        );

        // Set a timeout for the parsing
        setTimeout(() => {
          unsubscribe();
          reject(new Error('PDF parsing timed out. Please try again.'));
        }, 30000); // 30 second timeout
      });

      // Structure the raw text using OpenAI
      const structuredData = await OpenAIService.structureJobDescription(rawText);
      return structuredData;

    } catch (error) {
      console.error('Error parsing PDF:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unknown error occurred while parsing the PDF');
    }
  }
}

export default PDFParserService; 