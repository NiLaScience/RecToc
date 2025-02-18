Below is a step‐by‐step proposal for integrating a user‐specific job‐recommendation flow into your current Firebase + ReAG codebase. It is intentionally minimal and reuses as much of your existing functionality (embeddings, vector search, ranking, etc.) as possible.

---

## 1. Create a new Python script for generating recommendations

**File to add:**  
`matching/scripts/recommend_jobs.py` (or similar location under `matching/scripts/`)

**Purpose:**  
A standalone Python script (runnable via `python recommend_jobs.py` or `poetry run python recommend_jobs.py`) that:
1. Iterates over all users in Firestore
2. Fetches each user’s embedding from Firestore
3. Uses your existing `FirebaseVectorSearch` to retrieve top matching job openings
4. Excludes jobs the user has already rejected or applied to
5. Writes a final list of recommended job IDs to a new Firestore collection (e.g. `recommendations/{userId}`)

### Outline for `recommend_jobs.py`:

```py
import asyncio
import json
from google.cloud import firestore
from matching.src.reag.firebase_search import FirebaseVectorSearch, FirebaseConfig

# 1. Initialize Firestore + VectorSearch
db = firestore.Client()  # Adjust if you have a custom constructor
config = FirebaseConfig(
    collection_name="job_openings",  # The Firestore collection storing your job documents
    embedding_field="embedding",
    content_field="jobDescription",  # If needed, or set to an empty string if the job content is stored differently
    name_field="title",              # Or whatever field you consider the job "name"
    metadata_field="metadata",       # Possibly not used if you keep job docs simpler
    distance_measure="EUCLIDEAN",    # Or whatever you’re using
)
vector_search = FirebaseVectorSearch(config=config, db=db)

async def generate_recommendations_for_user(user_doc):
    """Generates and stores a list of recommended job IDs for a single user."""
    user_data = user_doc.to_dict()
    user_id = user_doc.id

    # (A) Get user embedding from user profile doc
    user_embedding = user_data.get("embedding")
    if not user_embedding:
        # No embedding? skip
        print(f"User {user_id} has no embedding, skipping.")
        return
    
    # (B) Gather job IDs the user has rejected
    #     'rejectedJobs' docs store { userId, jobId }, so filter by userId==user_id
    rejected_jobs_query = db.collection("rejectedJobs").where("userId", "==", user_id)
    rejected_docs = rejected_jobs_query.get()
    rejected_job_ids = {doc.to_dict().get("jobId") for doc in rejected_docs}

    # (C) Gather job IDs the user has applied to
    applications_query = db.collection("applications").where("candidateId", "==", user_id)
    application_docs = applications_query.get()
    applied_job_ids = {doc.to_dict().get("jobId") for doc in application_docs if doc.to_dict().get("jobId")}

    # (D) Use vector search to find nearest job openings
    #     "find_nearest_documents" returns Document objects from ReAG’s schema
    #     That schema expects "embedding" in the job doc, so it should find nearest docs by user embedding
    similar_docs = await vector_search.find_nearest_documents(
        query_vector=user_embedding,
        limit=10  # or however many top results you want
    )

    # (E) Filter out rejected or applied jobs
    #     Each returned Document object has doc.name / doc.content / doc.metadata. 
    #     You must ensure you have the job’s ID in one of those fields. 
    #     If your 'job_openings' docs have an 'id' field, you can store it in 'metadata' or check doc_snapshot.id
    recommended_job_ids = []
    for doc in similar_docs:
        # If you used 'id' as the job doc ID, you need to store it or retrieve it from doc.metadata
        # Suppose we keep job IDs in doc.metadata["jobId"]. Adjust to your actual usage:
        job_id = doc.metadata.get("jobId") if doc.metadata else None
        if not job_id:
            # Fallback if you store doc name as the ID:
            job_id = doc.name
        
        if job_id not in rejected_job_ids and job_id not in applied_job_ids:
            recommended_job_ids.append(job_id)

    # (F) Write final recommended job IDs to 'recommendations/{userId}' doc
    recommendations_ref = db.collection("recommendations").document(user_id)
    recommendations_ref.set({
        "userId": user_id,
        "jobIds": recommended_job_ids,
        "updatedAt": firestore.SERVER_TIMESTAMP
    })
    print(f"User {user_id} -> recommended job IDs: {recommended_job_ids}")

async def main():
    # 2. Query all users
    users = db.collection("users").get()
    
    # 3. Generate recs for each user concurrently
    tasks = []
    for user_doc in users:
        tasks.append(generate_recommendations_for_user(user_doc))
    await asyncio.gather(*tasks)

if __name__ == "__main__":
    asyncio.run(main())
```

**Key Points / Minimal Invasiveness**  
- Reuses `FirebaseVectorSearch` for similarity lookups.  
- Leverages user embeddings in Firestore.  
- Respects user “rejectedJobs” + “applications” to exclude unwanted openings.  
- Stores results in a new `recommendations/{userId}` doc with an array of job IDs.  

You could optionally also apply your `DocumentRanker` if you want a further LLM ranking pass, but the above handles the main vector matching plus user rejections/applications filter.

---

## 2. Firestore Security Rules for `recommendations` collection

**File to update:**  
`firestore.rules`

**Add a new match block** so that:
1. The user can read their own recommendations.
2. You (or a server/admin) can write them, if you run the script with admin privileges.  
   If the script runs with a privileged service account, it can bypass these rules altogether.  
   
Example minimal snippet in `firestore.rules`:

```diff
service cloud.firestore {
  match /databases/{database}/documents {

+   match /recommendations/{userId} {
+     allow read: if request.auth != null && request.auth.uid == userId;
+     // If your python script uses admin credentials, it bypasses rules. 
+     // If you want "agent" or "admin" claims to be able to write, do:
+     allow write: if request.auth != null && request.auth.token.admin == true;
+     // Or if the script has a custom claim isAgent():
+     // allow write: if isAgent();
+   }

    // existing rules below...
  }
}
```

---

## 3. Client‐side / Front‐end: Modify the job feed to show recommended jobs only

You likely have a function or React hook that loads `job_openings` from Firestore to display them in the user’s feed. Now that you have a `recommendations/{userId}` doc with `jobIds`, you can do one of two patterns:

1. **Pattern A:** Query `recommendations/{uid}` first, then fetch those `job_openings` by ID.  
2. **Pattern B:** Store a subcollection with detailed references if you prefer.  

**Example minimal approach** (using your existing `src/config/firebase.ts` style) might look like:

```ts
// Pseudocode example snippet:
import { getDocument, getCollection } from "@/config/firebase";

// getRecommendedJobs.ts
export const getRecommendedJobs = async (userId: string) => {
  // (A) Get the recommended job IDs
  const recDoc = await getDocument(`recommendations/${userId}`);
  if (!recDoc) return [];
  const jobIds = recDoc.jobIds || [];

  // (B) Then query those specific doc IDs from "job_openings"
  // You can use your existing pattern, e.g. pass a filter to getCollection
  if (jobIds.length === 0) return [];

  // Query by doc ID with "in" filter
  // matching the approach used in addSnapshotListener or getCollection
  const chunkSize = 10;
  let allJobs = [];
  for (let i = 0; i < jobIds.length; i += chunkSize) {
    const subset = jobIds.slice(i, i + chunkSize);
    const partialJobs = await getCollection("job_openings", {
      where: [["id", "in", subset]]
    });
    allJobs = [...allJobs, ...partialJobs];
  }

  return allJobs;
};
```

Finally, wherever you load the feed (e.g. a `useEffect` or data‐loading function in your React code), replace direct calls to `getCollection("job_openings")` with a call to `getRecommendedJobs(userId)`.

---

## 4. Optional: Data Model Adjustments

- If each job document in `job_openings` has a field `id` that matches the doc ID, ensure you store it consistently. The vector search expects your doc ID or a known metadata field. 
- Double‐check your existing embed logic places embeddings in the correct `embedding` field for “job_openings”.

---

## 5. Summary of File Changes

Below is a concise list of all the file modifications/additions:

1. **`matching/scripts/recommend_jobs.py`**  
   - **Create** this new Python script.  
   - Contains logic to:
     - Iterate over all users
     - Load user embeddings
     - Vector search for jobs
     - Filter out rejections/applications
     - Store recommended job IDs in `recommendations/{userId}`

2. **`firestore.rules`**  
   - **Add** a new match block for `recommendations/{userId}`.  
   - Grant read access for the owner, write access for the script or admin.

3. **Front‐end code** (likely in `src/config/firebase.ts` or a new helper file)  
   - **Create** or **modify** a function like `getRecommendedJobs(userId: string)` that:
     - Reads `recommendations/{userId}`
     - Retrieves and returns the matching docs from `job_openings`
   - **Update** your feed UI to call that function instead of listing all `job_openings` directly.

With these three changes, your system will generate user‐specific job lists (stored in `recommendations`), exclude unwanted jobs, and display them in the feed.