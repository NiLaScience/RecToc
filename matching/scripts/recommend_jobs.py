import asyncio
import json
from datetime import datetime
from google.cloud import firestore
from reag.client import ReagClient, RagConfig
from reag.firebase_search import FirebaseConfig
from reag.utils import format_job_content

# Constants for controlling document flow
VECTOR_SEARCH_LIMIT = 50  # How many candidates to get from vector search
MINIMUM_SCORE = 0.6      # Minimum score threshold for final recommendations
MAX_RECOMMENDATIONS = 10  # Maximum number of jobs to recommend per user

# Initialize Firestore
db = firestore.Client()

class FirestoreEncoder(json.JSONEncoder):
    """JSON encoder that can handle Firestore types."""
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, (firestore.SERVER_TIMESTAMP, firestore._helpers.DatetimeWithNanoseconds)):
            return obj.isoformat() if hasattr(obj, 'isoformat') else str(obj)
        return super().default(obj)

def format_job_content(job_dict):
    """Format job fields into a readable string."""
    desc = job_dict.get("jobDescription", {})
    return f"""Title: {desc.get('title', 'No Title')}
Company: {desc.get('company', 'Not Specified')}
Location: {desc.get('location', 'Not Specified')}
Employment Type: {desc.get('employmentType', 'Not Specified')}
Experience Level: {desc.get('experienceLevel', 'Not Specified')}
Salary: {desc.get('salary', {})}

Requirements:
{desc.get('requirements', [])}

Responsibilities:
{desc.get('responsibilities', [])}

Skills:
{desc.get('skills', [])}

Benefits:
{desc.get('benefits', [])}"""

# Initialize ReagClient with RAG and ranking enabled
client = ReagClient(
    model="gpt-4o-mini",
    rag_config=RagConfig(
        enabled=True,
        firebase_config=FirebaseConfig(
            collection_name="job_openings",
            embedding_field="embedding",
            content_field="",  # We'll format the content ourselves
            name_field="title",
            metadata_field="metadata",
            distance_measure="EUCLIDEAN"
        ),
        top_k=VECTOR_SEARCH_LIMIT,  # Get more candidates for ranking
        min_similarity_score=0.4,    # Minimum vector similarity to consider
        rank_results=True,           # Enable LLM-based ranking
        ranking_model="o3-mini"      # Added ranking model specification
    ),
    model_kwargs={
        "temperature": 0.7,
        "max_tokens": 500
    }
)

def has_valid_embedding(doc_dict):
    """Check if a document has valid embedding fields."""
    embedding = doc_dict.get("embedding")
    last_embedded = doc_dict.get("last_embedded")
    return (embedding is not None and isinstance(embedding, list) and len(embedding) > 0 
            and last_embedded is not None)

async def get_valid_users():
    """Get all users that have valid embeddings."""
    # Query users that have embeddings (we'll check last_embedded after)
    users_query = db.collection("users").where("embedding", "!=", None).get()
    
    valid_users = []
    skipped_users = 0
    
    for user_doc in users_query:
        user_data = user_doc.to_dict()
        # Check both embedding format and last_embedded
        if has_valid_embedding(user_data):
            valid_users.append(user_doc)
        else:
            skipped_users += 1
            
    print(f"Found {len(valid_users)} users with valid embeddings (skipped {skipped_users})")
    return valid_users

async def generate_recommendations_for_user(user_doc):
    """Generates and stores a list of recommended job IDs for a single user."""
    user_data = user_doc.to_dict()
    user_id = user_doc.id

    # Get user embedding (double-check even though we filtered earlier)
    if not has_valid_embedding(user_data):
        print(f"User {user_id} has no valid embedding, skipping.")
        return

    print(f"\nProcessing user {user_id}:")
    print(f"- User embedding length: {len(user_data['embedding'])}")

    # Get rejected and applied jobs for filtering
    rejected_jobs = {
        doc.to_dict()["jobId"] 
        for doc in db.collection("rejectedJobs").where("userId", "==", user_id).get()
    }
    applied_jobs = {
        doc.to_dict()["jobId"] 
        for doc in db.collection("applications").where("candidateId", "==", user_id).get()
        if doc.to_dict().get("jobId")
    }
    excluded_jobs = rejected_jobs | applied_jobs
    print(f"- Found {len(excluded_jobs)} excluded jobs")

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
                r.document.metadata.get("jobId", r.document.name) not in excluded_jobs)
        ]
        print(f"- After filtering: {len(filtered_results)} results")

        filtered_results.sort(key=lambda x: x.score, reverse=True)
        filtered_results = filtered_results[:MAX_RECOMMENDATIONS]
        print(f"- Final recommendations: {len(filtered_results)}")

        if filtered_results:
            print("\nTop 3 recommendations:")
            for i, r in enumerate(filtered_results[:3], 1):
                # Extract job details from the content string
                content_lines = r.document.content.split('\n')
                title = next((line.split(': ')[1] for line in content_lines if line.startswith('Title: ')), 'No Title')
                company = next((line.split(': ')[1] for line in content_lines if line.startswith('Company: ')), 'Unknown Company')
                print(f"{i}. {title} at {company} (score: {r.score:.2f})")
                print(f"   Reason: {r.reasoning[:100]}...")

        # Store recommendations
        recommendations_ref = db.collection("recommendations").document(user_id)
        created_at = datetime.utcnow()
        recommendations_ref.set({
            "userId": user_id,
            "created_at": created_at,
            "job_ids": [r.document.metadata['jobId'] for r in filtered_results],  # Use jobId from metadata
            "recommendations": [
                {
                    "jobId": r.document.metadata['jobId'],  # Use jobId from metadata
                    "jobDescription": r.document.content,
                    "score": r.score,
                    "reasoning": r.reasoning,
                    "timestamp": created_at.isoformat()
                }
                for r in filtered_results
            ]
        })

    except Exception as e:
        print(f"Error generating recommendations for user {user_id}: {str(e)}")
        raise  # Re-raise to see full traceback

async def main():
    async with client:  # Use context manager for proper cleanup
        # Get only users with valid embeddings
        valid_users = await get_valid_users()
        
        # Generate recommendations concurrently
        await asyncio.gather(*[
            generate_recommendations_for_user(user_doc) 
            for user_doc in valid_users
        ])

if __name__ == "__main__":
    asyncio.run(main()) 