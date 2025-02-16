Below is a high-level implementation plan for adding OpenAI-based text embedding to your **job_openings** documents and user **profile** documents. This plan focuses on where the changes go in your Firebase Functions and how to store the resulting vectors so you can later create a Firestore Vector Index. It also covers how to detect relevant text changes so you do not re-embed on every write.

---

## 1. Add or Update Configuration for OpenAI Embeddings

1. **Use existing OpenAI key or set a new config variable**  
   - Confirm that `functions.config().openai?.key` (or a similar config entry) is available.  
   - If it is not already in place, you can add it via the Firebase CLI:  
     ```bash
     firebase functions:config:set openai.key="YOUR_KEY_HERE"
     ```

2. **Import and instantiate the OpenAI library**  
   - You already have `node-fetch` dynamically imported, but for embeddings, you will import `openai`.  
   - Because you are using TypeScript, install types if needed:
     ```bash
     npm install openai
     npm install --save-dev @types/openai
     ```

3. **Reference the environment variable**  
   - In your functions code (e.g., `functions/src/index.ts`), retrieve the key:
     ```ts
     const openaiApiKey = functions.config().openai?.key;
     ```
   - Create an instance:
     ```ts
     import OpenAI from "openai";

     const openai = new OpenAI({ apiKey: openaiApiKey });
     ```

---

## 2. Outline of New Cloud Functions

You will create two new Firestore trigger functions:

1. **onJobOpeningWrite**  
   Triggered on **create or update** of any document in `job_openings/{docId}`.

2. **onUserProfileWrite**  
   Triggered on **create or update** of `users/{uid}` or whichever user-profile location you store your user documents in.

Each function will:
- Collect relevant text fields (title, description, responsibilities, etc. for job openings; displayName, user description, CV summary, etc. for users).
- Combine them into a single text string to embed.
- Compare the old vs. new text fields to see if an update is needed (if the text is unchanged, skip embedding).
- Call the OpenAI embeddings API with `model: "text-embedding-3-small"`.
- Write an array of floats into the `embedding` (or `vector_embedding`) field on the document.

### 2.1 `onJobOpeningWrite` function

**File**: `functions/src/index.ts` (or a new file, e.g., `jobOpeningFunctions.ts`)

**Location**: After your existing exports, add something like:

```ts
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: functions.config().openai?.key,
});

export const onJobOpeningWrite = functions.firestore
  .document("job_openings/{docId}")
  .onWrite(async (change, context) => {
    // 1. Determine if this is a create or an update
    const beforeData = change.before.exists ? change.before.data() : {};
    const afterData = change.after.data() || {};

    // 2. Extract relevant text fields from afterData
    // e.g. title, responsibilities, requirements, etc.
    const { title, responsibilities, requirements, description } = afterData;
    const combinedText = [
      title,
      description,
      responsibilities ? responsibilities.join(". ") : "",
      requirements ? requirements.join(". ") : "",
    ].join(". ");

    // 3. Check if text changed from beforeData
    // if text is unchanged, skip the re-embedding
    const oldCombinedText = [
      beforeData.title,
      beforeData.description,
      beforeData.responsibilities
        ? beforeData.responsibilities.join(". ")
        : "",
      beforeData.requirements ? beforeData.requirements.join(". ") : "",
    ].join(". ");

    if (combinedText === oldCombinedText) {
      console.log("No relevant text changes detected. Skipping embedding.");
      return;
    }

    // 4. Call the OpenAI embedding endpoint
    //    model: "text-embedding-3-small", encoding_format: "float"
    try {
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: combinedText,
        encoding_format: "float",
      });
      
      // The float array is in embeddingResponse.data[0].embedding
      const embeddingArray = embeddingResponse.data[0].embedding; 
      // embeddingArray is an array of float values.

      // 5. Save embedding to Firestore
      await change.after.ref.update({
        embedding: embeddingArray,
      });
      
      console.log(
        `Embedding stored successfully for job_openings/${context.params.docId}`
      );
    } catch (err) {
      console.error(
        `Error creating embedding for job_openings/${context.params.docId}`,
        err
      );
    }
  });
```

### 2.2 `onUserProfileWrite` function

**File**: `functions/src/index.ts` (or a dedicated `userFunctions.ts`)

```ts
export const onUserProfileWrite = functions.firestore
  .document("users/{uid}")
  .onWrite(async (change, context) => {
    const beforeData = change.before.exists ? change.before.data() : {};
    const afterData = change.after.data() || {};

    // e.g. displayName, description, or summary from CV
    const { displayName, description } = afterData;
    // If you also embed CV text, concatenate that here (e.g., personalInfo.summary).
    
    const combinedText = [displayName, description].join(". ");

    const oldCombinedText = [
      beforeData.displayName,
      beforeData.description,
    ].join(". ");

    if (combinedText === oldCombinedText) {
      console.log("No relevant text changes detected. Skipping embedding.");
      return;
    }

    try {
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: combinedText,
        encoding_format: "float",
      });
      const embeddingArray = embeddingResponse.data[0].embedding; 

      await change.after.ref.update({
        embedding: embeddingArray,
      });

      console.log(
        `Embedding stored successfully for users/${context.params.uid}`
      );
    } catch (err) {
      console.error(`Error creating embedding for users/${context.params.uid}`, err);
    }
  });
```

---

## 3. Creating a Vector Index in Firestore

Firestore’s Vector Indexing requires a **special index** if you want to do KNN queries. You will need to create or update a composite index that includes a “flat” vector index config referencing your new `embedding` field. For example (using the Google Cloud CLI):

```bash
gcloud firestore indexes composite create \
--collection-group=job_openings \
--query-scope=COLLECTION \
--field-config field-path=embedding,vector-config='{"dimension":"768", "flat": "{}"}' \
--database=(default)
```

> **Important**: The dimension value (e.g., 768) must match the size returned by `"text-embedding-3-small"`. Check the model’s documentation for the correct dimension. If the model uses dimension 1024, you must specify `1024`.

If you want to add a filter (like an ascending field or other constraints) in addition to the vector index, include more `--field-config` lines as needed.

Similarly, if you also want to do vector queries for `users` in Firestore, create a second index:

```bash
gcloud firestore indexes composite create \
--collection-group=users \
--query-scope=COLLECTION \
--field-config field-path=embedding,vector-config='{"dimension":"768", "flat": "{}"}' \
--database=(default)
```

---

## 4. Architectural & Code Notes

1. **Use an Array of Floats**  
   - Storing the embedding as a plain array of floats is generally enough to let Firestore treat it as a vector field. The Node.js Admin SDK does not yet have an `FieldValue.vector()`, but standard arrays are accepted as vector fields if the index is created.

2. **Skip Re-Embedding**  
   - The above pseudo-code checks if the combined text changed. This is important to avoid calling the OpenAI embeddings API unnecessarily. Adjust the logic if you want to re-embed partial changes or if some fields (like the job location) do not matter for the embedding.

3. **Model Dimension**  
   - Make sure to confirm the exact dimension of the `text-embedding-3-small` model so that your Firestore index dimension is identical.

4. **Error Handling**  
   - The above examples log errors to `console.error` but do not store them anywhere else. You could also store an error in the document if the embedding fails, or you can adopt a retry approach.

5. **Security & Cost Considerations**  
   - OpenAI calls can be expensive. If your user or job data changes frequently, consider whether you want to throttle or limit embedding.  
   - In security rules, ensure that normal users can’t overwrite your embedding field maliciously.

6. **Combine Fields Strategically**  
   - For “job_openings”, consider which text fields matter for job similarity. Possibly you do not need to embed extraneous info (like a short ID field).  
   - For “users”, decide how you want the user’s CV or partial experiences combined, or possibly embed them separately if needed.

7. **Index Management**  
   - Remember to update or re-create the Firestore index if your dimension changes or if you rename the field from `embedding` to `vector_embedding`.  
   - In your code, you only add the array of floats. The rest of the steps—like listing the index or describing it—are done at the CLI or Firebase console level, not in code.

---

## 5. Summary of Files to Modify

Below is a concise list of where to place changes:

1. **`functions/src/index.ts`** (or separate function files):  
   - **Add** `import OpenAI from "openai";` near the top.  
   - **Instantiate** an `openai` client.  
   - **Export** two new Firestore triggers: 
     - `onJobOpeningWrite` (listening to `job_openings/{docId}`)  
     - `onUserProfileWrite` (listening to `users/{uid}`)  
   - **Embed** relevant text fields and store them as `embedding: number[]`.

2. **`firebase functions:config:set openai.key="..."`** (CLI)  
   - If you have not already configured your OpenAI key.  
   - Ensure the code references this config as `functions.config().openai?.key`.

3. **Create the Vector Index**  
   - Using the Google Cloud CLI (or the Firebase CLI if it supports the new vector indexing).  
   - `gcloud firestore indexes composite create ...`  
   - For each collection group (`job_openings`, `users`).

---

### Final Remarks

With these steps in place, you will have two triggers that automatically call the OpenAI Embeddings API whenever the relevant text fields in **job_openings** or **users** documents change. They will store the embeddings in an array of floats on the same document. Then, after creating the proper Firestore vector index, you can perform vector KNN queries to find the nearest neighbors for a given embedding.