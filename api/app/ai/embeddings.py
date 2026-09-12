"""
PROGRESSIQ — Semantic Embedding & Matching Engine

WHY embeddings?
The field report says "pump house foundation work".
The schedule says "Construction of reinforced concrete foundation for Pump House".
These mean the SAME thing but have DIFFERENT words.

Embeddings convert text into numerical vectors (arrays of numbers).
Similar meanings → similar vectors → high cosine similarity score.

We use the "all-MiniLM-L6-v2" model from sentence-transformers.
It runs LOCALLY — no API key needed. First run downloads the model (~90MB).
"""
import json
try:
    import numpy as np
    _numpy_available = True
except ImportError:
    np = None
    _numpy_available = False
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Lazy-loaded model (only loaded when first needed, not at import time)
_model = None
_model_available = False
_model_load_attempted = False  # Only log the failure once


def _get_model():
    """Load the sentence-transformer model on first use."""
    global _model, _model_available, _model_load_attempted
    if _model_load_attempted:
        return _model
    _model_load_attempted = True
    try:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer('all-MiniLM-L6-v2')
        _model_available = True
        logger.info("✅ Sentence-transformers model loaded: all-MiniLM-L6-v2")
    except Exception as e:
        logger.warning(f"⚠️ sentence-transformers unavailable: {e}. Using TF-IDF fallback.")
        _model = None
        _model_available = False
    return _model


def encode_text(text: str) -> Optional[list[float]]:
    """
    Convert a text string to an embedding vector.
    Returns a list of floats, or None if model unavailable.
    """
    model = _get_model()
    if model is None:
        return None
    try:
        embedding = model.encode(text, convert_to_numpy=True)
        return embedding.tolist()
    except Exception as e:
        logger.error(f"Embedding error: {e}")
        return None


import math
import re
from collections import Counter


def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """
    Calculate cosine similarity between two vectors.
    Returns a value between -1 and 1 (we normalize to 0-100%).
    """
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0
    try:
        dot = sum(x * y for x, y in zip(vec_a, vec_b))
        norm_a = math.sqrt(sum(x * x for x in vec_a))
        norm_b = math.sqrt(sum(y * y for y in vec_b))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)
    except Exception:
        return 0.0


def _tokenize(text: str) -> list[str]:
    return re.findall(r'\b\w+\b', text.lower())


def tfidf_similarity(text_a: str, text_b: str) -> float:
    """
    TF-IDF based similarity fallback when heavy embeddings are unavailable.
    Pure-Python token frequency cosine similarity (ultra-fast, zero C++ dependencies).
    """
    try:
        tokens_a = _tokenize(text_a)
        tokens_b = _tokenize(text_b)
        if not tokens_a or not tokens_b:
            return 0.0

        counts_a = Counter(tokens_a)
        counts_b = Counter(tokens_b)

        all_words = set(counts_a.keys()).union(set(counts_b.keys()))
        if not all_words:
            return 0.0

        dot = sum(counts_a.get(w, 0) * counts_b.get(w, 0) for w in all_words)
        norm_a = math.sqrt(sum(v * v for v in counts_a.values()))
        norm_b = math.sqrt(sum(v * v for v in counts_b.values()))

        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(dot / (norm_a * norm_b))
    except Exception:
        # Absolute fallback: jaccard similarity on words
        words_a = set(text_a.lower().split())
        words_b = set(text_b.lower().split())
        if not words_a or not words_b:
            return 0.0
        intersection = words_a & words_b
        union = words_a | words_b
        return len(intersection) / len(union)


def compute_similarity(
    query_text: str,
    candidate_text: str,
    query_embedding: Optional[list[float]] = None,
    candidate_embedding: Optional[list[float]] = None,
) -> float:
    """
    Compute similarity between two texts.
    Uses embeddings if available, TF-IDF fallback otherwise.
    Returns 0.0 – 1.0.
    """
    # Try embedding-based similarity first
    if query_embedding and candidate_embedding:
        return cosine_similarity(query_embedding, candidate_embedding)

    model = _get_model()
    if model is not None:
        q_emb = encode_text(query_text)
        c_emb = encode_text(candidate_text)
        if q_emb and c_emb:
            return cosine_similarity(q_emb, c_emb)

    # Fallback
    return tfidf_similarity(query_text, candidate_text)


def match_to_activities(
    query_text: str,
    activities: list[dict],
    query_embedding: Optional[list[float]] = None,
    top_k: int = 5,
) -> list[dict]:
    """
    Match a field report text to the most similar schedule activities.

    Args:
        query_text: Field report text (e.g. "pump house foundation progressing slowly")
        activities: List of dicts with at least 'id', 'activity_id', 'activity_name', 'embedding'
        query_embedding: Pre-computed embedding for query (optional)
        top_k: How many top matches to return

    Returns:
        List of matches sorted by confidence (highest first), each with:
        {id, activity_id, activity_name, confidence_score, rank}
    """
    if not activities:
        return []

    # Compute or use provided query embedding
    if query_embedding is None:
        query_embedding = encode_text(query_text)

    results = []
    for act in activities:
        candidate_emb = None
        if act.get("embedding"):
            try:
                candidate_emb = json.loads(act["embedding"])
            except Exception:
                candidate_emb = None

        sim = compute_similarity(
            query_text,
            act.get("activity_name", ""),
            query_embedding=query_embedding,
            candidate_embedding=candidate_emb,
        )

        results.append({
            "id": act["id"],
            "activity_id": act.get("activity_id", ""),
            "activity_name": act.get("activity_name", ""),
            "confidence_score": round(sim * 100, 2),
            "similarity_raw": sim,
        })

    # Sort by similarity descending
    results.sort(key=lambda x: x["similarity_raw"], reverse=True)

    # Add rank
    for i, r in enumerate(results):
        r["rank"] = i + 1
        del r["similarity_raw"]

    return results[:top_k]


def is_model_available() -> bool:
    """Check if the sentence-transformers model is loaded."""
    global _model_available
    return _model_available
