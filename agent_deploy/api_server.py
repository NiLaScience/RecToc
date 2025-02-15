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
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

import firebase_admin
from firebase_admin import credentials, storage, firestore
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, HttpUrl
from redis import Redis
from rq import Queue
import requests

from llm_apply_o1_login import (
    CandidateProfile,
    run_job_application,
    load_login_credentials
)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load agent credentials from environment
AGENT_EMAIL = os.getenv('AGENT_EMAIL')
AGENT_PASSWORD = os.getenv('AGENT_PASSWORD')
if not AGENT_EMAIL or not AGENT_PASSWORD:
    raise ValueError("AGENT_EMAIL and AGENT_PASSWORD environment variables must be set")

# Initialize Firebase Admin SDK
cred = credentials.Certificate("firebase-credentials.json")
firebase_admin.initialize_app(cred, {
    'storageBucket': 'your-bucket-name.appspot.com'
})
db = firestore.client()
bucket = storage.bucket()

# Initialize Firebase Auth for the agent
FIREBASE_API_KEY = os.getenv('FIREBASE_API_KEY')
if not FIREBASE_API_KEY:
    raise ValueError("FIREBASE_API_KEY environment variable must be set")

def get_agent_token():
    """Get a Firebase ID token for the agent service account."""
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
    payload = {
        "email": AGENT_EMAIL,
        "password": AGENT_PASSWORD,
        "returnSecureToken": True
    }
    response = requests.post(url, json=payload)
    response.raise_for_status()
    return response.json()['idToken']

# Get initial token
try:
    agent_token = get_agent_token()
    logger.info("Successfully authenticated agent with Firebase")
except Exception as e:
    logger.error(f"Failed to authenticate agent: {e}")
    raise

# Initialize Redis and RQ
redis_conn = Redis(
    host=os.getenv('REDIS_HOST', 'redis'),
    port=int(os.getenv('REDIS_PORT', 6379)),
    password=os.getenv('REDIS_PASSWORD', None)
)
queue = Queue('applications', connection=redis_conn)

# Initialize FastAPI
app = FastAPI(title="Job Application API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# No rate limiting for now
@app.on_event("startup")
async def startup():
    pass

class ApplicationRequest(BaseModel):
    request_id: str
    user_id: str
    job_id: str
    cv: Dict
    job_description: Dict
    job_url: HttpUrl
    cv_file_url: HttpUrl
    login_credentials: Optional[Dict[str, Dict[str, str]]] = None

async def process_application(
    request_id: str,
    user_id: str,
    job_id: str,
    job_url: str,
    cv: Dict,
    job_description: Dict,
    cv_file_url: str,
    login_credentials: Optional[Dict] = None
) -> None:
    """
    Background task to process the job application and upload results to Firebase.
    """
    try:
        # Pass the complete data to the agent
        await run_job_application(str(job_url), {
            'cv': cv,
            'cv_file_url': cv_file_url,
            'job_description': job_description,
            'login_credentials': login_credentials
        })

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
        doc_ref.update({
            'status': 'completed',
            'job_url': str(job_url),
            'timestamp': datetime.utcnow(),
            'agentGifUrl': gif_url,
            'error': None
        })

    except Exception as e:
        logger.error(f"Error processing application {request_id}: {str(e)}")
        # Store error in Firestore
        doc_ref = db.collection('applications').document(request_id)
        doc_ref.update({
            'status': 'failed',
            'job_url': str(job_url),
            'timestamp': datetime.utcnow(),
            'error': str(e)
        })

@app.post("/apply")
async def apply_to_job(
    request: ApplicationRequest
) -> JSONResponse:
    """
    Endpoint to start a job application process.
    Returns a request ID that can be used to check the status.
    """
    # Initialize document in Firestore
    doc_ref = db.collection('applications').document(request.request_id)
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
            request.request_id,
            request.user_id,
            request.job_id,
            str(request.job_url),
            request.cv,
            request.job_description,
            request.cv_file_url,
            request.login_credentials
        ),
        job_id=request.request_id,
        job_timeout='1h'  # Set timeout to 1 hour
    )

    return JSONResponse({
        'request_id': request.request_id,
        'status': 'queued',
        'position_in_queue': queue.count,
        'message': 'Application queued for processing'
    })

@app.get("/status/{request_id}")
async def get_status(
    request_id: str
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
async def get_queue_status() -> JSONResponse:
    """
    Get the current status of the application queue.
    """
    return JSONResponse({
        'queue_length': queue.count,
        'failed_jobs': len(queue.failed_job_registry),
        'scheduled_jobs': len(queue.scheduled_job_registry),
        'started_jobs': len(queue.started_job_registry)
    })

# Add error handler for validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    body = await request.json()
    logger.error(f"Validation error details: {exc.errors()}")
    logger.error(f"Request body: {json.dumps(body, indent=2)}")
    logger.error(f"Missing fields: {[err['loc'] for err in exc.errors() if err['type'] == 'missing']}")
    logger.error(f"Field types: {[(k, type(v).__name__) for k,v in body.items()]}")
    return JSONResponse(
        status_code=422,
        content={
            "detail": exc.errors(),
            "body": body,
            "missing_fields": [err['loc'] for err in exc.errors() if err['type'] == 'missing'],
            "field_types": {k: type(v).__name__ for k,v in body.items()}
        },
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 