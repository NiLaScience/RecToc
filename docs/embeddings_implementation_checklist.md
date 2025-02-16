# OpenAI Embeddings Implementation Checklist

## 1. OpenAI Configuration Setup
- [x] Verify existing OpenAI key in Firebase config
- [x] If not present, set OpenAI key via Firebase CLI:
  ```bash
  firebase functions:config:set openai.key="YOUR_KEY_HERE"
  ```
- [x] Install required dependencies:
  ```bash
  npm install openai
  ```

## 2. Cloud Functions Implementation

### 2.1 Setup
- [x] Create/update functions file structure
- [x] Import OpenAI library
- [x] Initialize OpenAI client with API key

### 2.2 Job Openings Function
- [x] Implement `onJobOpeningWrite` function
- [x] Add text field extraction (title, responsibilities, requirements, description)
- [x] Implement text change detection logic
- [x] Add OpenAI embedding API call
- [x] Implement embedding storage in Firestore
- [x] Add error handling and logging

### 2.3 User Profile Function
- [x] Implement `onUserProfileWrite` function
- [x] Add text field extraction (displayName, description, CV data)
- [x] Implement text change detection logic
- [x] Add OpenAI embedding API call
- [x] Implement embedding storage in Firestore
- [x] Add error handling and logging

## 3. Firestore Vector Index Setup

### 3.1 Job Openings Index
- [x] Verify embedding dimension for text-embedding-3-small model
- [x] Create vector index for job_openings collection:
  ```bash
  gcloud firestore indexes composite create \
  --collection-group=job_openings \
  --query-scope=COLLECTION \
  --field-config field-path=embedding,vector-config='{"dimension":"1536", "flat": "{}"}' \
  --database=(default)
  ```

### 3.2 Users Index
- [x] Create vector index for users collection:
  ```bash
  gcloud firestore indexes composite create \
  --collection-group=users \
  --query-scope=COLLECTION \
  --field-config field-path=embedding,vector-config='{"dimension":"1536", "flat": "{}"}' \
  --database=(default)
  ```

## 4. Security & Optimization

### 4.1 Security
- [x] Update Firestore security rules to protect embedding fields
- [x] Implement rate limiting for embedding generation
- [x] Add error handling for API failures

### 4.2 Optimization
- [x] Implement efficient text change detection
- [x] Add caching if necessary
- [x] Optimize field combination strategy for embeddings

## 5. Testing & Validation

### 5.1 Function Testing
- [ ] Test job opening document creation
- [ ] Test job opening document updates
- [ ] Test user profile creation
- [ ] Test user profile updates
- [ ] Verify embedding generation
- [ ] Validate embedding storage

### 5.2 Index Testing
- [ ] Verify vector index creation
- [ ] Test KNN queries on job_openings
- [ ] Test KNN queries on users
- [ ] Validate query performance

## 6. Deployment & Monitoring

### 6.1 Deployment
- [x] Deploy updated Firebase Functions
- [x] Verify index deployment
- [x] Confirm security rules deployment

### 6.2 Monitoring
- [x] Set up logging for embedding generation
- [x] Monitor OpenAI API usage
- [x] Track embedding generation performance
- [x] Monitor query performance