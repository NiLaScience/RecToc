#!/usr/bin/env python3

"""
Worker process that handles queued job applications.
"""

import json
import logging
import os
from datetime import datetime

import firebase_admin
from firebase_admin import credentials, storage, firestore
from rq import Queue, Connection, Worker
from redis import Redis

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

async def process_application(
    request_id: str,
    job_url: str,
    candidate_info: dict,
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
            'started_at': datetime.utcnow()
        })

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

        # Store success result
        doc_ref.update({
            'status': 'completed',
            'completed_at': datetime.utcnow(),
            'recording_url': gif_url,
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
    
    with Connection(redis_conn):
        queue = Queue('applications')
        worker = Worker([queue])
        worker.work()

if __name__ == "__main__":
    main() 