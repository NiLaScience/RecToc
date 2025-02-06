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
  - [x] Add secure routing and protected pages.
  - [x] Implement persistent auth state management.
- [x] **Develop the Video Upload Page**
  - [x] Create an upload page accessible only to authenticated users.
  - [x] Add a file input for selecting video files on the web.
  - [x] Integrate Capacitor's camera or file chooser plugin for capturing/choosing video on mobile.
- [ ] **Handle Video Upload Process**
  - [x] Configure functionality to upload video files to Firebase Cloud Storage.
  - [x] Create a corresponding Firestore document for each video with basic metadata (e.g., user ID, description).
- [ ] **Testing**
  - [x] Verify authentication flows.
  - [x] Test video upload functionality on both web and Android.

## Phase 3: Tagging, Video Metadata, and Feed Creation

- [x] **Enhance Video Upload Functionality**
  - [x] Add input fields for video title/description.
  - [x] Add a tagging system (e.g., comma-separated input or chips) for keywords.
  - [x] Update Firestore video documents to store tags as an array along with video URL.
- [x] **Create the Video Feed Page**
  - [x] Build a feed page that queries Firestore for video entries.
  - [x] Display basic video information (thumbnail, title, tags) using Ionic components.
- [x] **Testing**
  - [x] Ensure that video metadata (tags, title, URL) is correctly saved and displayed in the feed.

## Phase 4: Basic Transcription (Text Caption) Pipeline

- [x] **Integrate Transcription/Captions**
  - [x] Add a transcript/caption input field on the video upload page.
  - [x] Update Firestore documents to include a transcript field.
  - [x] Optionally, plan for integration with a simple third-party transcription service or Cloud Function (prototype-level).
- [x] **Display Transcript**
  - [x] Ensure that the transcript is shown alongside the video on its detail or playback page.
- [x] **Testing**
  - [x] Verify that transcript data is captured and displayed correctly.

## Phase 5: Feed Presentation

- [x] **Enhance Feed UI**
  - [x] Refine the feed layout to mimic a TikTok-like experience using Ionic cards or slides.
  - [x] Enable smooth scrolling or swiping through video posts.
- [x] **Implement Video Playback**
  - [x] Ensure videos are playable within the feed.
  - [x] Configure auto-play (muted) with tap-to-unmute functionality.


## Phase 6: Job Application Features

- [ ] **CV Upload and Processing**
  - [x] Create CV upload component
  - [x] Implement CV parsing using OpenAI API
  - [x] Store structured CV data in Firestore
  - [x] Add validation and error handling for CV uploads
  - [x] Support multiple file formats (PDF, DOC, DOCX)
  
- [ ] **Video Application System**
  - [x] Create video recording interface for job applications
  - [x] Allow candidates to review and re-record their videos
  - [ ] Implement video processing pipeline (compression, thumbnails)
  - [ ] Store application metadata (CV + video) in Firestore
  - [ ] Add progress tracking for video upload and processing

- [ ] **Recruiter Dashboard**
  - [ ] Create a dedicated recruiter view for managing job postings
  - [ ] Implement job posting creation and editing
  - [ ] Add application tracking system
  - [ ] Create candidate review interface
  - [ ] Add sorting and filtering options for applications
  - [ ] Implement status tracking (new, reviewed, shortlisted, rejected)

- [ ] **Candidate Feed and Applications**
  - [ ] Create separate feeds for recruiters and candidates
  - [ ] Implement job search and filtering
  - [ ] Add application status tracking for candidates
  - [ ] Create "My Applications" section for candidates
  - [ ] Add job recommendations based on CV content

- [ ] **Video Enhancement Features**
  - [ ] Add job description overlay options for videos
  - [ ] Implement clickable links within videos
  - [ ] Add custom branding options for recruiter videos
  - [ ] Create video templates for different job types
  - [ ] Add caption/subtitle support

- [ ] **Security and Privacy**
  - [ ] Implement role-based access control (recruiter vs candidate)
  - [ ] Add CV data encryption
  - [ ] Implement video access controls
  - [ ] Add data retention policies
  - [ ] Implement GDPR compliance features

## Phase 7: Optimization

- [ ] **Performance Optimization**
  - [ ] Optimize video loading and playback
  - [ ] Implement lazy loading for feed items
  - [ ] Add caching for frequently accessed data
  - [ ] Optimize CV parsing performance
  - [ ] Implement background processing for heavy tasks
  - [ ] Optimize video playback for mobile
  