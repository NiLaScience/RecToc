#!/usr/bin/env python3

"""
API server that wraps the job application script and exposes it as an HTTP endpoint.
Also handles Firebase integration for results and Redis for queue management.
"""

import json
import logging
import os
from datetime import datetime
from typing import Dict, Optional

import firebase_admin
from firebase_admin import credentials, storage, firestore
from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import JSONResponse
from fastapi_limiter import FastAPILimiter
from fastapi_limiter.depends import RateLimiter
from pydantic import BaseModel, HttpUrl
from redis import Redis
from rq import Queue

from llm_apply_o1_login import (
    CandidateProfile,
    run_job_application,
    load_login_credentials
)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Firebase
cred = credentials.Certificate("firebase-credentials.json")
firebase_admin.initialize_app(cred, {
    'storageBucket': 'your-bucket-name.appspot.com'
})
db = firestore.client()
bucket = storage.bucket()

# Initialize Redis and RQ
redis_conn = Redis(
    host=os.getenv('REDIS_HOST', 'redis'),
    port=int(os.getenv('REDIS_PORT', 6379)),
    password=os.getenv('REDIS_PASSWORD', None)
)
queue = Queue('applications', connection=redis_conn)

# Initialize FastAPI
app = FastAPI(title="Job Application API")

# Setup rate limiting
@app.on_event("startup")
async def startup():
    await FastAPILimiter.init(redis_conn)

class ApplicationRequest(BaseModel):
    job_url: HttpUrl
    candidate_info: Dict
    login_credentials: Optional[Dict[str, Dict[str, str]]] = None

async def process_application(
    request_id: str,
    job_url: str,
    candidate_info: Dict,
    login_credentials: Optional[Dict] = None
) -> None:
    """
    Background task to process the job application and upload results to Firebase.
    """
    try:
        # Create a temporary credentials file if login credentials provided
        if login_credentials:
            temp_creds_file = f"temp_creds_{request_id}.json"
            with open(temp_creds_file, "w") as f:
                json.dump(login_credentials, f)
            load_login_credentials(temp_creds_file)
            os.remove(temp_creds_file)  # Clean up

        # Create candidate profile
        candidate_profile = CandidateProfile(**candidate_info)

        # Run the application process
        await run_job_application(str(job_url), candidate_profile)

        # Upload GIF to Firebase Storage if it exists
        gif_path = "agent_history.gif"
        if os.path.exists(gif_path):
            blob = bucket.blob(f"application_recordings/{request_id}.gif")
            blob.upload_from_filename(gif_path)
            gif_url = blob.public_url
            os.remove(gif_path)  # Clean up
        else:
            gif_url = None

        # Store application result in Firestore
        doc_ref = db.collection('applications').document(request_id)
        doc_ref.set({
            'status': 'completed',
            'job_url': str(job_url),
            'timestamp': datetime.utcnow(),
            'recording_url': gif_url,
            'error': None
        })

    except Exception as e:
        logger.error(f"Error processing application {request_id}: {str(e)}")
        # Store error in Firestore
        doc_ref = db.collection('applications').document(request_id)
        doc_ref.set({
            'status': 'failed',
            'job_url': str(job_url),
            'timestamp': datetime.utcnow(),
            'error': str(e)
        })

@app.post("/apply")
async def apply_to_job(
    request: ApplicationRequest,
    _: str = Depends(RateLimiter(times=2, seconds=60))  # Rate limit: 2 requests per minute
) -> JSONResponse:
    """
    Endpoint to start a job application process.
    Returns a request ID that can be used to check the status.
    """
    # Generate unique request ID
    request_id = f"app_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"

    # Initialize document in Firestore
    doc_ref = db.collection('applications').document(request_id)
    doc_ref.set({
        'status': 'queued',
        'job_url': str(request.job_url),
        'queued_at': datetime.utcnow(),
        'position_in_queue': queue.count
    })

    # Add job to queue
    queue.enqueue(
        'worker.process_application',
        args=(
            request_id,
            str(request.job_url),
            request.candidate_info,
            request.login_credentials
        ),
        job_id=request_id,
        job_timeout='1h'  # Set timeout to 1 hour
    )

    return JSONResponse({
        'request_id': request_id,
        'status': 'queued',
        'position_in_queue': queue.count,
        'message': 'Application queued for processing'
    })

@app.get("/status/{request_id}")
async def get_status(
    request_id: str,
    _: str = Depends(RateLimiter(times=10, seconds=60))  # Rate limit: 10 requests per minute
) -> JSONResponse:
    """
    Get the status of a job application request.
    """
    # Check Firestore for status
    doc_ref = db.collection('applications').document(request_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Request ID not found")
    
    # Get job from queue if it's still there
    job = queue.fetch_job(request_id)
    
    response_data = doc.to_dict()
    if job:
        response_data.update({
            'queue_position': queue.get_job_position(job),
            'enqueued_at': job.enqueued_at,
            'started_at': job.started_at,
            'ended_at': job.ended_at
        })
    
    return JSONResponse(response_data)

@app.get("/queue/status")
async def get_queue_status(
    _: str = Depends(RateLimiter(times=30, seconds=60))  # Rate limit: 30 requests per minute
) -> JSONResponse:
    """
    Get the current status of the application queue.
    """
    return JSONResponse({
        'queue_length': queue.count,
        'failed_jobs': len(queue.failed_job_registry),
        'scheduled_jobs': len(queue.scheduled_job_registry),
        'started_jobs': len(queue.started_job_registry)
    })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 