from typing import List, Dict, Optional, Union
from litellm import acompletion
import json
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from .schema import Document, QueryResult, RankedDocument, RankingResponse
from .prompt import RANKING_SYSTEM_PROMPT, create_ranking_prompt
from .ranking_storage import RankingStorage

class DocumentRanker:
    """Ranks documents based on LLM reasoning."""
    
    def __init__(
        self,
        model: str = "gpt-4o-mini",
        model_kwargs: Optional[Dict] = None,
        store_results: bool = False,
        storage_collection: str = "ranking_results"
    ):
        self.model = model
        self.model_kwargs = model_kwargs or {}
        self.store_results = store_results
        self._storage = RankingStorage(collection_name=storage_collection) if store_results else None
    
    async def rank_documents(
        self,
        query: str,
        results: List[QueryResult],
        store_metadata: Optional[Dict[str, Union[str, int]]] = None
    ) -> List[RankedDocument]:
        """
        Rank documents based on their relevance to the query using LLM reasoning.
        
        Args:
            query: The original query string
            results: List of QueryResult objects containing documents and initial analysis
            store_metadata: Optional metadata to store with ranking results
            
        Returns:
            List of RankedDocument objects sorted by score (highest first)
        """
        try:
            # Skip ranking if no results
            if not results:
                return []
            
            # Log input data
            logger.info(f"Starting document ranking for query: {query}")
            logger.info(f"Number of documents to rank: {len(results)}")
            
            # Prepare documents for ranking prompt
            docs_for_prompt = [
                {
                    "name": r.document.name,
                    "content": r.document.content,
                    "reasoning": r.reasoning
                }
                for r in results
            ]
            
            # Log document names being ranked
            logger.info("Documents being ranked:")
            for doc in docs_for_prompt:
                logger.info(f"- Document name: {doc['name']}")
            
            # Create ranking prompt
            prompt = create_ranking_prompt(query, docs_for_prompt)
            logger.info(f"Generated ranking prompt length: {len(prompt)} characters")
            
            # Get LLM response
            logger.info(f"Calling {self.model} for ranking")
            response = await acompletion(
                model=self.model,
                messages=[
                    {"role": "system", "content": RANKING_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                **self.model_kwargs
            )
            
            # Parse response
            content = response.choices[0].message.content
            logger.info("Raw model response:")
            logger.info(content)
            
            # Extract rankings from the response
            rankings = []
            
            # Try parsing as JSON first
            try:
                data = json.loads(content)
                if "source" in data:
                    # Single document format
                    rankings.append({
                        "document_name": data["source"].get("content", "").split("\n")[0].replace("Title: ", "").strip(),
                        "score": float(data.get("score", 0.0)),
                        "reasoning": data["source"].get("reasoning", "")
                    })
                else:
                    # Multiple documents format
                    for rank in data.get("rankings", []):
                        rankings.append({
                            "document_name": rank.get("document_name", ""),
                            "score": float(rank.get("score", 0.0)),
                            "reasoning": rank.get("reasoning", "")
                        })
            except json.JSONDecodeError:
                # Fall back to text format parsing
                current_doc = {}
                for line in content.split('\n'):
                    line = line.strip()
                    if line.startswith('Document:'):
                        if current_doc:
                            logger.info(f"Parsed document: {json.dumps(current_doc)}")
                            rankings.append(current_doc)
                        current_doc = {"document_name": line.split('Document:')[1].strip()}
                    elif line.startswith('Score:'):
                        try:
                            current_doc["score"] = float(line.split('Score:')[1].strip())
                        except Exception as e:
                            logger.error(f"Error parsing score from line: {line}")
                            logger.error(str(e))
                            current_doc["score"] = 0.0
                    elif line.startswith('Reasoning:'):
                        current_doc["reasoning"] = line.split('Reasoning:')[1].strip()
                
                if current_doc:
                    logger.info(f"Parsed final document: {json.dumps(current_doc)}")
                    rankings.append(current_doc)
            
            logger.info(f"Total rankings parsed: {len(rankings)}")
            
            # Create RankedDocument objects
            ranked_docs = []
            doc_map = {r.document.name: r.document for r in results}
            print(f"[DEBUG] Document map keys: {list(doc_map.keys())}")
            print(f"[DEBUG] First document metadata: {next(iter(results)).document.metadata if results else 'No results'}")
            
            for rank in rankings:
                doc_id = rank.get("document_name")
                print(f"[DEBUG] Processing ranking for document: {doc_id}")
                
                if not doc_id:
                    logger.error(f"Missing document_name in ranking: {json.dumps(rank)}")
                    continue
                
                if doc_id not in doc_map:
                    logger.error(f"Document ID {doc_id} not found in document map")
                    print(f"[DEBUG] Available document IDs: {list(doc_map.keys())}")
                    continue
                    
                if "score" not in rank:
                    logger.error(f"Missing score in ranking: {json.dumps(rank)}")
                    continue
                    
                if "reasoning" not in rank:
                    logger.error(f"Missing reasoning in ranking: {json.dumps(rank)}")
                    continue
                
                ranked_docs.append(
                    RankedDocument(
                        document=doc_map[doc_id],
                        score=float(rank["score"]),
                        reasoning=rank["reasoning"]
                    )
                )
            
            # Sort by score descending
            ranked_docs.sort(key=lambda x: x.score, reverse=True)
            logger.info(f"Final number of ranked documents: {len(ranked_docs)}")
            
            # Store results if enabled
            if self.store_results and self._storage:
                # Add model info to metadata
                metadata = store_metadata or {}
                metadata.update({
                    "model": self.model,
                    **{f"model_param_{k}": str(v) for k, v in self.model_kwargs.items()}
                })
                
                await self._storage.store_ranking_results(
                    query=query,
                    ranked_docs=ranked_docs,
                    metadata=metadata
                )
            
            return ranked_docs
            
        except Exception as e:
            logger.error(f"Document ranking failed: {str(e)}")
            raise Exception(f"Document ranking failed: {str(e)}") 