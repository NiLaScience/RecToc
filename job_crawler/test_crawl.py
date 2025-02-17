#!/usr/bin/env python3

import os
from dotenv import load_dotenv
from firecrawl import FirecrawlApp
import json
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

def main():
    # Initialize Firecrawl
    firecrawl = FirecrawlApp(api_key=os.getenv('FIRECRAWL_API_KEY'))
    
    # Test URL
    url = "https://headcount.ch/job/"
    
    # Crawl with limited params
    params = {
        'limit': 2,  # Limit to 2 pages
        'scrapeOptions': {
            'formats': ['markdown']
        }
    }
    
    logger.info(f"Starting test crawl of {url}")
    try:
        # Perform the crawl
        crawl_status = firecrawl.crawl_url(url, params=params)
        
        # Pretty print the raw results
        print("\nRaw crawl status:")
        print(json.dumps(crawl_status, indent=2))
        
        if 'results' in crawl_status:
            print("\nSample of first result:")
            first_result = crawl_status['results'].get('jobs', [])[0] if crawl_status['results'].get('jobs') else None
            if first_result:
                print(json.dumps(first_result, indent=2))
            else:
                print("No jobs found in results")
        
    except Exception as e:
        logger.error(f"Error during test crawl: {str(e)}")

if __name__ == "__main__":
    main() 