#!/usr/bin/env python3

"""
Worker process that handles queued job applications.
"""

import json
import logging
import os
from datetime import datetime
import requests
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

import firebase_admin
from firebase_admin import credentials, storage, firestore
from rq import Queue, Worker
from redis import Redis

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
FIREBASE_API_KEY = os.getenv('FIREBASE_API_KEY')

if not all([AGENT_EMAIL, AGENT_PASSWORD, FIREBASE_API_KEY]):
    raise ValueError("AGENT_EMAIL, AGENT_PASSWORD, and FIREBASE_API_KEY environment variables must be set")

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

# Initialize Firebase with agent credentials
cred = credentials.Certificate("firebase-credentials.json")
try:
    app = firebase_admin.initialize_app(cred, {
        'storageBucket': 'your-bucket-name.appspot.com'
    }, name='worker-app')
    db = firestore.client(app)
    bucket = storage.bucket(app=app)
except ValueError:
    # App already exists, get the existing one
    app = firebase_admin.get_app(name='worker-app')
    db = firestore.client(app)
    bucket = storage.bucket(app=app)

# Get initial token
try:
    agent_token = get_agent_token()
    logger.info("Successfully authenticated agent with Firebase")
except Exception as e:
    logger.error(f"Failed to authenticate agent: {e}")
    raise

async def process_application(
    request_id: str,
    user_id: str,
    job_id: str,
    job_url: str,
    cv: dict,
    job_description: dict,
    cv_file_url: str,
    login_credentials: dict = None
) -> None:
    """
    Process a single job application request.
    This function is called by the worker when processing queue items.
    """
    try:
        logger.info(f"Processing application {request_id} for {job_url}")
        
        # Update status to processing
        doc_ref = db.collection('applications').document(request_id)
        doc_ref.update({
            'status': 'processing',
            'started_at': datetime.utcnow(),
            'user_id': user_id,
            'job_id': job_id
        })

        # Create a proper CandidateProfile model
        candidate_profile = CandidateProfile(
            name=cv['personalInfo']['name'],
            email=cv['personalInfo']['email'],
            phone=cv['personalInfo']['phone'],
            address=cv['personalInfo'].get('location'),
            cv_file_url=cv_file_url,
            summary=None,  # Optional fields
            work_experiences=cv.get('experience', []),
            education=cv.get('education', []),
            skills=cv.get('skills', []),
            additional_info=None
        )

        # Pass the complete data to the agent
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

        # Store success result
        doc_ref.update({
            'status': 'completed',
            'completed_at': datetime.utcnow(),
            'agentGifUrl': gif_url,
            'error': None
        })

    except Exception as e:
        logger.error(f"Error processing application {request_id}: {str(e)}")
        # Store error result
        doc_ref.update({
            'status': 'failed',
            'error': str(e),
            'completed_at': datetime.utcnow()
        })

def main():
    """
    Main worker process that listens for jobs on the Redis queue.
    """
    redis_conn = Redis(
        host=os.getenv('REDIS_HOST', 'redis'),
        port=int(os.getenv('REDIS_PORT', 6379)),
        password=os.getenv('REDIS_PASSWORD', None)
    )
    
    queue = Queue('applications', connection=redis_conn)
    worker = Worker([queue], connection=redis_conn)
    worker.work()

if __name__ == "__main__":
    main() 