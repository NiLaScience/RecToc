import { FirebaseFunctions } from '@capacitor-firebase/functions';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { Capacitor } from '@capacitor/core';

class CloudFunctionService {
  static async callFunction<RequestData = unknown, ResponseData = unknown>(
    functionName: string,
    data: RequestData
  ): Promise<ResponseData> {
    try {
      if (Capacitor.isNativePlatform()) {
        // Use Capacitor plugin for native platforms
        const result = await FirebaseFunctions.callByName<RequestData, ResponseData>({
          name: functionName,
          data,
        });
        return result.data;
      } else {
        // Use web SDK for browser
        const functions = getFunctions(getApp());
        const callable = httpsCallable<RequestData, ResponseData>(functions, functionName);
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