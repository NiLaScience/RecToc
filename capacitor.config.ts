import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nexus.rectoc',
  appName: 'rectoc',
  webDir: 'out',
  server: {
    androidScheme: 'http',
    cleartext: true,
    url: 'http://10.0.2.2:3000',
    allowNavigation: ['*']
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ["google.com"]  // Add any other providers you need
    }
  }
};

export default config;
