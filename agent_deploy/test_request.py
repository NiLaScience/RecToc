#!/usr/bin/env python3

import requests
import json
from datetime import datetime

# Test data
test_request = {
    "request_id": f"test-{int(datetime.now().timestamp())}",  # Unique ID
    "user_id": "test-user-1",
    "job_id": "test-job-1",
    "cv": {
        "personalInfo": {
            "name": "John Doe",
            "email": "john@example.com",
            "phone": "+1-555-0123",
            "location": "San Francisco, CA"
        },
        "experience": [
            {
                "title": "Software Engineer",
                "company": "Tech Corp",
                "duration": "2020-2023",
                "description": "Full-stack development"
            }
        ],
        "education": [
            {
                "degree": "BS Computer Science",
                "school": "University of Technology",
                "year": "2020"
            }
        ],
        "skills": ["Python", "JavaScript", "Docker"]
    },
    "job_description": {
        "title": "Senior Software Engineer",
        "company": "Example Corp",
        "location": "Remote",
        "description": "Looking for experienced engineers",
        "requirements": ["5+ years experience", "Python", "Cloud"],
        "responsibilities": ["Backend development", "System design"]
    },
    "job_url": "https://emea2.softfactors.com/job-opening/rgum-WY2twh5EVSqTgaOh5E#!/?lang=en&mw_source=jobs_ethz",
    "cv_file_url": "https://firebasestorage.googleapis.com/v0/b/rec-toc-56a25.firebasestorage.app/o/cvs-to-parse%2F7b4da895-acf5-4410-85f8-19fdab80c846.pdf?alt=media&token=73b2167b-2f01-455d-9218-86d789d203cd",
    "login_credentials": {
        "linkedin": {
            "username": "test@example.com",
            "password": "testpass123"
        }
    }
}

def test_api():
    """Test the local API by sending a job application request."""
    print("Sending test request to local API...")
    
    try:
        response = requests.post(
            "http://localhost:8000/apply",
            json=test_request,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"\nResponse status: {response.status_code}")
        print("Response body:")
        print(json.dumps(response.json(), indent=2))
        
        if response.status_code == 200:
            request_id = response.json().get('request_id')
            print(f"\nRequest ID: {request_id}")
            print("You can check the status using:")
            print(f"curl http://localhost:8000/status/{request_id}")
            
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    test_api() 