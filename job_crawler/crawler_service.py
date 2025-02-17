#!/usr/bin/env python3

"""
Job Crawler Service that periodically crawls configured job sites and stores results in Firestore.
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore
from firecrawl import FirecrawlApp
import time
import hashlib
import json
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.jobstores.memory import MemoryJobStore

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
MINUTES_IN_DAY = 24 * 60
DEFAULT_FIRECRAWL_API_KEY = 'fc-a955803e3b7f48d2af60f25b870506ff'
DEFAULT_CRAWL_CONFIG = {
    'url': 'https://careers.roche.com/global/en/job/',
    'params': {
        'limit': 25,
        'maxDepth': 2,
        'scrapeOptions': {
            'formats': ['markdown'],
            'onlyMainContent': False,
            'waitFor': 2
        }
    },
    'interval_days': 1
}

class JobCrawlerService:
    def __init__(self):
        # Initialize Firebase
        cred = credentials.Certificate("firebase-credentials.json")
        firebase_admin.initialize_app(cred)
        self.db = firestore.client()
        
        # Initialize Firecrawl
        api_key = os.getenv('FIRECRAWL_API_KEY', DEFAULT_FIRECRAWL_API_KEY)
        self.firecrawl = FirecrawlApp(api_key=api_key)
        
        # Initialize scheduler with rate limiting
        self.scheduler = BackgroundScheduler(
            jobstores={'default': MemoryJobStore()},
            job_defaults={
                'coalesce': True, 
                'max_instances': 1,
                'misfire_grace_time': 15*60  # 15 minute grace time for missed jobs
            }
        )
        
        # Load crawler configuration and setup jobs
        self.load_crawler_config()
        self.setup_jobs()

    def load_crawler_config(self):
        """Load crawler configuration from local config file."""
        config_path = os.path.join(os.path.dirname(__file__), 'config.json')
        try:
            with open(config_path, 'r') as f:
                self.config = json.load(f)
            logger.info("Loaded configuration from config.json")
        except FileNotFoundError:
            logger.warning("config.json not found, using default configuration")
            self.config = {
                'urls': [DEFAULT_CRAWL_CONFIG]
            }
            # Save default config
            with open(config_path, 'w') as f:
                json.dump(self.config, f, indent=4)

    def get_interval_minutes(self, url_config: Dict) -> int:
        """Convert interval configuration to minutes."""
        if 'interval_days' in url_config:
            return url_config['interval_days'] * MINUTES_IN_DAY
        return url_config.get('interval_minutes', MINUTES_IN_DAY)  # Default to 1 day

    def generate_job_id(self, url: str) -> str:
        """Generate a unique ID for a job based on its URL."""
        return hashlib.sha256(url.encode()).hexdigest()

    def process_crawl_results(self, crawl_status: Dict, source_url: str):
        """Process and store crawl results in Firestore."""
        jobs_ref = self.db.collection('jobs')
        
        # Process each crawled page
        for page_data in crawl_status.get('data', []):
            metadata = page_data.get('metadata', {})
            url = metadata.get('url')
            
            # Skip 404 pages or pages without URLs
            if not url or metadata.get('statusCode') == 404:
                continue
                
            job_id = self.generate_job_id(url)
            
            # Check if job already exists
            existing_job = jobs_ref.document(job_id).get()
            if not existing_job.exists:
                job_data = {
                    'job_id': job_id,
                    'url': url,
                    'title': metadata.get('ogTitle') or metadata.get('title'),
                    'description': metadata.get('ogDescription'),
                    'raw_content': page_data.get('markdown'),
                    'metadata': metadata,
                    'source_url': source_url,
                    'created_at': firestore.SERVER_TIMESTAMP,
                    'last_updated': firestore.SERVER_TIMESTAMP,
                    'is_active': True,
                    'last_crawled': firestore.SERVER_TIMESTAMP
                }
                
                try:
                    jobs_ref.document(job_id).set(job_data)
                    logger.info(f"Stored new job: {job_id} - {job_data.get('title')}")
                except Exception as e:
                    logger.error(f"Error storing job {job_id}: {str(e)}")

    def crawl_url(self, url_config: Dict):
        """Crawl a single URL and process results."""
        logger.info(f"Starting crawl of {url_config['url']}")
        try:
            crawl_status = self.firecrawl.crawl_url(
                url_config['url'],
                params=url_config.get('params', {})
            )
            
            if crawl_status.get('status') == 'completed':
                self.process_crawl_results(crawl_status, url_config['url'])
                logger.info(f"Completed crawl of {url_config['url']}")
            else:
                logger.error(f"Crawl failed for {url_config['url']}: {crawl_status}")
                
        except Exception as e:
            logger.error(f"Error crawling {url_config['url']}: {str(e)}")

    def setup_jobs(self):
        """Setup crawler jobs for each URL in the configuration."""
        # Remove all existing jobs
        self.scheduler.remove_all_jobs()
        
        # Add a job for each URL with staggered start times
        for i, url_config in enumerate(self.config['urls']):
            interval_minutes = self.get_interval_minutes(url_config)
            job_id = f"crawl_{self.generate_job_id(url_config['url'])}"
            
            # Stagger initial crawls by 2 minutes each to avoid rate limits
            initial_delay_minutes = i * 5
            next_run = datetime.now() + timedelta(minutes=initial_delay_minutes)
            
            self.scheduler.add_job(
                func=self.crawl_url,
                trigger=IntervalTrigger(minutes=interval_minutes),
                args=[url_config],
                id=job_id,
                name=f"Crawl {url_config['url']}",
                next_run_time=next_run  # Staggered start time
            )
            
            logger.info(f"Scheduled job {job_id} to crawl {url_config['url']} every {interval_minutes} minutes, starting in {initial_delay_minutes} minutes")

    def run(self):
        """Start the crawler service."""
        try:
            self.scheduler.start()
            logger.info("Crawler service started")
            
            # Keep the main thread alive
            while True:
                time.sleep(60)
                
        except (KeyboardInterrupt, SystemExit):
            logger.info("Shutting down crawler service...")
            self.scheduler.shutdown()

if __name__ == "__main__":
    crawler = JobCrawlerService()
    crawler.run() 