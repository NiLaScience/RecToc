# Week 1 MVP Development Checklist

## Phase 1: Initial Setup and "Hello World" App

- [x] **Create Project Structure**
  - [x] Create an empty project directory.
  - [x] Initialize a new Next.js project.
- [x] **Integrate Ionic Framework**
  - [x] Install Ionic React and configure Ionic components within the Next.js project.
- [x] **Set Up Firebase**
  - [x] Create and configure a Firebase project.
  - [x] Install Firebase SDKs (Authentication, Firestore, Storage).
  - [x] Initialize Firebase in the project and verify connection with a simple test read/write.
- [x] **Integrate Capacitor**
  - [x] Install Capacitor CLI and core packages.
  - [x] Initialize Capacitor within the project.
- [x] **Establish Basic Routing**
  - [x] Create initial pages (e.g., Home/Feed, Upload, Profile) in Next.js.
- [x] **Develop a "Hello World" App**
  - [x] Build a simple page using Ionic components to display a "Hello World" message.
  - [x] Create a minimal Capacitor Android project.
  - [x] Deploy the "Hello World" app to an Android device and verify it runs correctly on both web and mobile.

## Phase 2: User Authentication and Video Upload

- [x] **Implement Firebase Authentication**
  - [x] Design and build signup and login forms using Ionic UI components.
  - [x] Integrate Firebase Authentication flows (signup, login, logout).
  - [x] Add proper error handling and loading states.
  - [x] Implement platform-specific auth (web vs mobile).
- [ ] **Develop the Video Upload Page**
  - [ ] Create an upload page accessible only to authenticated users.
  - [ ] Add a file input for selecting video files on the web.
  - [ ] Integrate Capacitor's camera or file chooser plugin for capturing/choosing video on mobile.
- [ ] **Handle Video Upload Process**
  - [ ] Configure functionality to upload video files to Firebase Cloud Storage.
  - [ ] Create a corresponding Firestore document for each video with basic metadata (e.g., user ID, description).
- [ ] **Testing**
  - [x] Verify authentication flows.
  - [ ] Test video upload functionality on both web and Android.

## Phase 3: Tagging, Video Metadata, and Feed Creation

- [ ] **Enhance Video Upload Functionality**
  - [ ] Add input fields for video title/description.
  - [ ] Add a tagging system (e.g., comma-separated input or chips) for keywords.
  - [ ] Update Firestore video documents to store tags as an array along with video URL.
- [ ] **Create the Video Feed Page**
  - [ ] Build a feed page that queries Firestore for video entries.
  - [ ] Display basic video information (thumbnail, title, tags) using Ionic components.
- [ ] **Testing**
  - [ ] Ensure that video metadata (tags, title, URL) is correctly saved and displayed in the feed.

## Phase 4: Basic Transcription (Text Caption) Pipeline

- [ ] **Integrate Transcription/Captions**
  - [ ] Add a transcript/caption input field on the video upload page.
  - [ ] Update Firestore documents to include a transcript field.
  - [ ] Optionally, plan for integration with a simple third-party transcription service or Cloud Function (prototype-level).
- [ ] **Display Transcript**
  - [ ] Ensure that the transcript is shown alongside the video on its detail or playback page.
- [ ] **Testing**
  - [ ] Verify that transcript data is captured and displayed correctly.

## Phase 5: Feed Presentation and Basic Interactivity

- [ ] **Enhance Feed UI**
  - [ ] Refine the feed layout to mimic a TikTok-like experience using Ionic cards or slides.
  - [ ] Enable smooth scrolling or swiping through video posts.
- [ ] **Implement Video Playback**
  - [ ] Ensure videos are playable within the feed.
  - [ ] Configure auto-play (muted) with tap-to-unmute functionality.
- [ ] **Add Interactive Features**
  - [ ] Add a like button to each video and configure it to update a like count in Firestore.
  - [ ] Optionally, add a basic commenting system (storing comments as subcollections in Firestore).
- [ ] **Secure Interactions**
  - [x] Update Firebase security rules to allow only authenticated users to interact (upload, like, comment).
- [ ] **Testing**
  - [ ] Test interactivity and ensure data updates (likes, comments) are reflected in real time on both web and mobile.

## Phase 6: Final Testing, Feedback, and Refinements

- [ ] **Cross-Platform Testing**
  - [ ] Test the complete application on the web.
  - [ ] Test the complete application on an Android device via Capacitor.
- [ ] **Identify and Fix Issues**
  - [ ] Resolve platform-specific issues (layout, permissions, performance).
  - [ ] Refine UI components and responsiveness.
- [ ] **Deploy a Preview Version**
  - [ ] Prepare the Next.js app for production build.
  - [ ] Deploy the web version (e.g., Firebase Hosting, Vercel, or Netlify).
  - [ ] Generate and test an Android APK/IPA using Capacitor.
- [ ] **Gather Feedback**
  - [ ] Conduct user testing sessions.
  - [ ] Document feedback and make final adjustments to meet the Week 1 MVP criteria.
