import { FirebaseFunctions } from '@capacitor-firebase/functions';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { Capacitor } from '@capacitor/core';

interface GeminiSchema {
  type: string;
  properties: Record<string, any>;
  required?: string[];
}

interface GeminiPayload {
  contents: Array<{
    role?: string;
    parts: Array<{
      inlineData?: {
        data: string;
        mimeType: string;
      };
      text?: string;
    }>;
  }>;
  schema?: GeminiSchema;
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

export class CloudFunctionService {
  static async callFunction<T extends { payload: GeminiPayload }, R extends GeminiResponse>(
    functionName: string,
    data: T
  ): Promise<R> {
    try {
      if (Capacitor.isNativePlatform()) {
        // Use Capacitor plugin for native platforms
        const result = await FirebaseFunctions.callByName<T, R>({
          name: functionName,
          data,
        });
        return result.data;
      } else {
        // Use web SDK for browser
        const functions = getFunctions(getApp());
        const callable = httpsCallable<T, R>(functions, functionName);
        const result = await callable(data);
        return result.data;
      }
    } catch (error) {
      console.error(`Error calling Cloud Function ${functionName}:`, error);
      throw error;
    }
  }
}

export default CloudFunctionService; 