#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting deployment process...${NC}"

# 0. Clean up any existing APKs
echo -e "${BLUE}🧹 Cleaning up existing APKs...${NC}"
rm -f android/app/src/main/assets/public/install/*.apk public/install/*.apk out/install/*.apk

# 1. Build the web app
echo -e "${BLUE}📦 Building web app...${NC}"
npm run build

# 2. Sync web app to Android
echo -e "${BLUE}🔄 Syncing web app to Android...${NC}"
npx cap sync android

# 3. Build the Android app
echo -e "${BLUE}📱 Building Android app...${NC}"
cd android
./gradlew clean assembleDebug
cd ..

# 4. Copy the APK directly to the output directory
echo -e "${BLUE}📂 Copying APK to output directory...${NC}"
mkdir -p out/install
cp android/app/build/outputs/apk/debug/app-debug.apk out/install/

# 5. Deploy to Firebase
echo -e "${BLUE}🚀 Deploying to Firebase...${NC}"
firebase deploy --only hosting

# 6. Verify deployment
echo -e "${BLUE}✨ Verifying deployment...${NC}"
curl -sI https://rec-toc-56a25.web.app/install/app-debug.apk | grep -i content-length

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "${GREEN}🌍 Web app: https://rec-toc-56a25.web.app${NC}"
echo -e "${GREEN}📱 APK install: https://rec-toc-56a25.web.app/install${NC}" 