import json
from datetime import datetime
from google.cloud import firestore
from reag.client import ReagClient
from reag.config import RagConfig, FirebaseConfig
from reag.utils import FirestoreEncoder

db = firestore.Client()

async def generate_recommendations_for_user(user_doc):
    """Generates and stores a list of recommended job IDs for a single user."""
    user_data = user_doc.to_dict()
    user_id = user_doc.id

    # Skip users without embeddings
    if "embedding" not in user_data:
        print(f"User {user_id} has no embedding, skipping.")
        return

    # Get excluded jobs (rejected + applied)
    excluded_jobs = set()
    
    # Get rejected jobs
    rejected_docs = db.collection("rejectedJobs").where("userId", "==", user_id).get()
    excluded_jobs.update(doc.to_dict().get("jobId") for doc in rejected_docs)
    
    # Get applied jobs
    application_docs = db.collection("applications").where("candidateId", "==", user_id).get()
    excluded_jobs.update(doc.to_dict().get("jobId") for doc in application_docs)
    
    print(f"- Found {len(excluded_jobs)} excluded jobs")

    # Initialize ReagClient with RAG config
    rag_config = RagConfig(
        enabled=True,
        firebase_config=FirebaseConfig(collection_name="job_openings"),
        top_k=VECTOR_SEARCH_LIMIT
    )

    async with ReagClient(rag_config=rag_config) as client:
        try:
            # Create a clean version of user_data for the prompt
            user_profile = {
                "experience": user_data.get("experience", []),
                "skills": user_data.get("skills", []),
                "preferences": user_data.get("preferences", {}),
                "education": user_data.get("education", [])
            }

            print("- Starting vector search...")
            # First, load all job documents
            job_docs = await client._vector_search.load_documents()
            print(f"- Loaded {len(job_docs)} job documents")

            # Let ReagClient handle the matching using vector search + LLM ranking
            results = await client.query(
                prompt=f"Find jobs matching this candidate's profile:\n{json.dumps(user_profile, cls=FirestoreEncoder)}",
                documents=job_docs,  # Pass the loaded documents
                query_vector=user_data["embedding"],
                store_metadata={"userId": user_id}
            )
            print(f"- Vector search returned {len(results)} results")

            # Filter out excluded jobs and apply score threshold
            filtered_results = [
                r for r in results 
                if (r.score >= MINIMUM_SCORE and  # Only keep high-scoring results
                    r.document.metadata.get("jobId", r.document.name) not in excluded_jobs)  # Try metadata jobId first, fallback to document name
            ]
            print(f"- After filtering: {len(filtered_results)} results")

            filtered_results.sort(key=lambda x: x.score, reverse=True)
            filtered_results = filtered_results[:MAX_RECOMMENDATIONS]
            print(f"- Final recommendations: {len(filtered_results)}")

            if filtered_results:
                print("\nTop 3 recommendations:")
                for i, r in enumerate(filtered_results[:3], 1):
                    print(f"{i}. {r.document.metadata.get('title', 'Unknown Title')} at {r.document.metadata.get('company', 'Unknown Company')} (score: {r.score:.2f})")
                    print(f"   Reason: {r.reasoning[:100]}...")

            # Store recommendations in Firestore
            created_at = datetime.utcnow()
            recommendations_ref = db.collection("recommendations").document(user_id)
            recommendations_ref.set({
                "userId": user_id,
                "created_at": created_at,
                "job_ids": [r.document.metadata.get("jobId", r.document.name) for r in filtered_results],  # Try metadata jobId first, fallback to document name
                "recommendations": [
                    {
                        "jobId": r.document.metadata.get("jobId", r.document.name),  # Try metadata jobId first, fallback to document name
                        "jobDescription": r.document.content,
                        "score": r.score,
                        "reasoning": r.reasoning,
                        "timestamp": created_at
                    }
                    for r in filtered_results
                ]
            })

        except Exception as e:
            print(f"Error generating recommendations for user {user_id}: {str(e)}")
            raise e 