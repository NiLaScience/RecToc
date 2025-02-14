- [ ] **Set Up the Agent Trigger in the App**  
  - [ ] Add a new submission method (e.g., `submitApplicationToAIAgent`) that sends the application data to the EC2 endpoint.  
  - [ ] Modify the submit button logic to call this method and capture the resulting status or request identifier.  

- [ ] **Adjust the Data Format and Request Body**  
  - [ ] Include a field for `applicationId` or `request_id` to link the Firestore document.  
  - [ ] Pass only essential CV data or a storage URL instead of large files.  
  - [ ] Provide optional `login_credentials` as a dictionary for job boards.  

- [ ] **Refine the `/apply` Endpoint on the EC2 Server**  
  - [ ] Update the Pydantic model to include `request_id`, `candidate_info`, and optional `login_credentials`.  
  - [ ] Write or update the Firestore document using the provided `request_id`, setting `agentStatus` to "queued."  
  - [ ] Enqueue the processing job in a worker or background task.  

- [ ] **Implement the Worker Logic**  
  - [ ] Accept the `request_id` and any other needed fields (e.g., `job_url`, `candidate_info`, credentials).  
  - [ ] Update Firestore to `agentStatus` = "processing" when the job starts.  
  - [ ] Perform the automated application steps and generate the GIF.  
  - [ ] Upload the GIF to Firebase Storage and store the public URL in Firestore (`agentGifUrl`).  
  - [ ] Update Firestore to `agentStatus` = "completed" or "failed" when done.  

- [ ] **Integrate Firebase Updates in the App**  
  - [ ] Extend the Firestore document schema to include fields like `agentRequestId`, `agentStatus`, and `agentGifUrl`.  
  - [ ] Listen for real-time updates on these fields in the application’s UI.  
  - [ ] Display a progress indicator for "queued" or "processing," and show the GIF when `agentStatus` = "completed."  

- [ ] **Modify the Application Service Layer**  
  - [ ] Create a function to build the request payload (job URL, candidate info, credentials).  
  - [ ] Post the payload to the EC2 `/apply` endpoint.  
  - [ ] Write initial Firestore fields (e.g., `agentStatus` = "queued") after a successful request.  

- [ ] **Securely Handle Login Credentials**  
  - [ ] Provide a profile or settings screen to let users store and manage their credentials.  
  - [ ] Use device-level secure storage for usernames and passwords.  
  - [ ] Retrieve credentials at submission time and attach them under `login_credentials` in the request body.  

- [ ] **Ensure End-to-End HTTPS**  
  - [ ] Configure TLS on the EC2 endpoint to protect credentials and application data.  
  - [ ] Verify all communication between the Capacitor app, EC2 server, and Firebase is over secure channels.  

- [ ] **Confirm Firestore Rules**  
  - [ ] Allow the agent to update `agentStatus`, `agentGifUrl`, and any other application fields.  
  - [ ] Restrict access to credentials or sensitive fields that should remain private.  

- [ ] **Validate Error Handling and Edge Cases**  
  - [ ] Verify the app displays an error if the job application fails (`agentStatus` = "failed").  
  - [ ] Handle missing or invalid credentials gracefully.  
  - [ ] Confirm large CV files or PDFs are handled via storage references rather than direct upload.  

- [ ] **Finalize and Test the End-to-End Flow**  
  - [ ] Submit a test application from the Capacitor app.  
  - [ ] Confirm it appears in Firestore with `agentStatus` = "queued."  
  - [ ] Observe the worker updating status to "processing," then "completed," and uploading the GIF.  
  - [ ] Display the final GIF and status in the app’s UI.