from typing import List, Dict
import json

REAG_SYSTEM_PROMPT = """You are an AI assistant that helps analyze and extract information from documents.
Your task is to:
1. Analyze the provided document content
2. Determine if the document is relevant to the query
3. Extract or summarize relevant information
4. Provide reasoning for your analysis

Format your response with <think> tags around your reasoning process.

# Instructions
1. Analyze the user's query carefully to identify key concepts and requirements.
2. Search through the provided sources for relevant information and output the relevant parts in the 'content' field.
3. If you cannot find the necessary information in the documents, return 'isIrrelevant: true', otherwise return 'isIrrelevant: false'.

# Constraints
- Do not make assumptions beyond available data
- Clearly indicate if relevant information is not found
- Maintain objectivity in source selection

"""

RANKING_SYSTEM_PROMPT = """You are a document ranking assistant. Your task is to analyze documents and rank them by relevance to a query.

For each document, output in exactly this format:
Document: [document name]
Score: [score from 0.0 to 1.0, where 1.0 is most relevant]
Reasoning: [brief explanation for the score]

Keep your responses concise and focused on the ranking task. Do not add any additional text or formatting."""

def create_ranking_prompt(query: str, documents: List[Dict]) -> str:
    """Create a prompt for ranking documents by relevance.
    
    Args:
        query: The query to rank documents against (contains user profile)
        documents: List of documents with name (ID), content, and initial analysis
    """
    # Extract user profile from query if it exists
    try:
        profile_start = query.find("{")
        if profile_start != -1:
            profile_text = query[profile_start:]
            user_profile = json.loads(profile_text)
            profile_section = f"""
User Profile:
- Experience: {', '.join(str(exp) for exp in user_profile.get('experience', []))}
- Skills: {', '.join(str(skill) for skill in user_profile.get('skills', []))}
- Education: {', '.join(str(edu) for edu in user_profile.get('education', []))}
- Preferences: {json.dumps(user_profile.get('preferences', {}), indent=2)}

"""
        else:
            profile_section = ""
    except:
        profile_section = ""

    prompt = f"""Given the following candidate profile and job listings, rank the jobs by relevance.
{profile_section}
For each job, consider:
1. Skills match
2. Experience level match
3. Educational requirements match
4. Location and other preferences match

Please analyze the following jobs and rank them by relevance. For each job, provide:
1. The document ID (exactly as shown in the Document ID field)
2. A score from 0.0 to 1.0 (1.0 being most relevant)
3. Brief reasoning explaining the match or mismatch with the candidate's profile

Jobs to analyze:

"""
    for i, doc in enumerate(documents, 1):
        prompt += f"""Job {i}:
Document ID: {doc["name"]}
Content: {doc["content"]}
Initial Analysis: {doc["reasoning"]}

"""
    
    return prompt