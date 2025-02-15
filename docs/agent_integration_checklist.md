- [x] **Set Up the Agent Trigger in the App**  
  - [x] Add a new submission method (e.g., `submitApplicationToAIAgent`) that sends the application data to the EC2 endpoint.  
  - [x] Modify the submit button logic to call this method and capture the resulting status or request identifier.  

- [x] **Adjust the Data Format and Request Body**  
  - [x] Include a field for `applicationId` or `request_id` to link the Firestore document.  
  - [x] Pass only essential CV data or a storage URL instead of large files.  
  - [x] Send complete CV and job description objects to the agent.
  - [x] Add CV file storage and URL transmission to the agent.
  - [x] Structure login credentials as platform-keyed object (e.g., `{linkedin: {username, password}, indeed: {username, password}}`)

- [x] **Refine the `/apply` Endpoint on the EC2 Server**  
  - [x] Update the Pydantic model to include:
    - `request_id`
    - `user_id`
    - `job_id`
    - Complete `cv` object
    - Complete `job_description` object
    - `cv_file_url`
    - Platform-keyed `login_credentials` object
  - [x] Write or update the Firestore document using the provided `request_id`, setting `agentStatus` to "queued."  
  - [x] Enqueue the processing job in a worker or background task.  

- [x] **Implement the Worker Logic**  
  - [x] Accept the `request_id` and any other needed fields (e.g., `job_url`, `cv`, `job_description`, `cv_file_url`, credentials).  
  - [x] Download CV file from Firebase Storage URL.
  - [x] Update Firestore to `agentStatus` = "processing" when the job starts.  
  - [x] Perform the automated application steps and generate the GIF.  
  - [x] Upload the GIF to Firebase Storage and store the public URL in Firestore (`agentGifUrl`).  
  - [x] Update Firestore to `agentStatus` = "completed" or "failed" when done.  

- [x] **Integrate Firebase Updates in the App**  
  - [x] Extend the Firestore document schema to include fields like `agentRequestId`, `agentStatus`, and `agentGifUrl`.  
  - [x] Listen for real-time updates on these fields in the application's UI.  
  - [x] Display a progress indicator for "queued" or "processing," and show the GIF when `agentStatus` = "completed."  

- [x] **Modify the Application Service Layer**  
  - [x] Create a function to build the request payload with complete CV and job description objects.
  - [x] Post the payload to the EC2 `/apply` endpoint.  
  - [x] Write initial Firestore fields (e.g., `agentStatus` = "queued") after a successful request.  
  - [x] Add CV file URL validation before submission.

- [x] **Securely Handle Login Credentials**  
  - [x] Create a dedicated JobBoardCredentials component with platform selection.
  - [x] Use device-level secure storage (Preferences) for credentials.
  - [x] Store credentials in platform-keyed format for easy lookup.
  - [x] Support multiple platform credentials simultaneously.
  - [x] Implement credential management UI with add/delete functionality.
  - [x] Send complete credentials object to agent for flexible platform handling.

- [ ] **Security and Infrastructure**
  - [ ] Configure TLS on the EC2 endpoint
  - [ ] Set up proper Firestore rules for agent access
  - [ ] Implement rate limiting and request validation
  - [ ] Add monitoring and error tracking
  - [ ] Set up automated backups for Redis queue

- [ ] **Ensure End-to-End HTTPS**  
  - [ ] Verify all communication between the Capacitor app, EC2 server, and Firebase is over secure channels.  

- [ ] **Confirm Firestore Rules**  
  - [ ] Allow the agent to update `agentStatus`, `agentGifUrl`, and any other application fields.  
  - [ ] Restrict access to credentials or sensitive fields that should remain private.  
  - [ ] Ensure CV files in Firebase Storage are properly secured.

- [ ] **Validate Error Handling and Edge Cases**  
  - [ ] Verify the app displays an error if the job application fails (`agentStatus` = "failed").  
  - [ ] Handle missing or invalid credentials gracefully.  
  - [ ] Handle missing or invalid CV files gracefully.
  - [ ] Confirm large CV files or PDFs are handled via storage references rather than direct upload.  

- [ ] **Finalize and Test the End-to-End Flow**  
  - [ ] Submit a test application from the Capacitor app.  
  - [ ] Confirm it appears in Firestore with `agentStatus` = "queued."  
  - [ ] Verify CV file is accessible via the provided URL.
  - [ ] Observe the worker updating status to "processing," then "completed," and uploading the GIF.  
  - [ ] Display the final GIF and status in the app's UI.