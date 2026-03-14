"""
rag.py
RAG pipeline: build a per-questionnaire FAISS index from stored document
chunks, retrieve top-k for each question, then call the LLM.
"""

import os
import pickle
import tempfile
import numpy as np
import faiss
from bson import ObjectId

from db import documents_col, questionnaires_col, answers_col, runs_col
from embeddings import get_embedding
from llm import generate_answer
from datetime import datetime

# Dimension for gemini-embedding-001
EMBED_DIM = 3072


# ─── Index helpers ───────────────────────────────────────────────────────────

def _build_faiss_index(chunks: list[dict]) -> tuple:
    """
    Build a flat L2 FAISS index from a list of chunk dicts.
    Each chunk: {"text": str, "source": str, "embedding": list[float]}
    Returns (index, chunks_list)
    """
    vectors = np.array([c["embedding"] for c in chunks], dtype="float32")
    # Normalise for cosine similarity via inner product
    faiss.normalize_L2(vectors)
    index = faiss.IndexFlatIP(vectors.shape[1])
    index.add(vectors)
    return index, chunks


def _search(index, chunks, query_embedding: list[float], top_k: int = 3):
    """Return top_k chunks with similarity scores."""
    vec = np.array([query_embedding], dtype="float32")
    faiss.normalize_L2(vec)
    scores, indices = index.search(vec, top_k)
    results = []
    for score, idx in zip(scores[0], indices[0]):
        if idx == -1:
            continue
        chunk = chunks[idx].copy()
        chunk["score"] = float(score)
        results.append(chunk)
    return results


# ─── Main pipeline ────────────────────────────────────────────────────────────

def run_rag_pipeline(questionnaire_id: str, user_email: str) -> str:
    """
    Run full RAG for every question in a questionnaire.
    Returns a run_id string.
    """
    q_doc = questionnaires_col.find_one({"_id": ObjectId(questionnaire_id)})
    if not q_doc:
        raise ValueError("Questionnaire not found")

    questions: list[str] = q_doc["questions"]

    # Fetch all document chunks for this user
    doc_chunks = list(documents_col.find(
        {"user_email": user_email},
        {"_id": 0, "chunks": 1, "filename": 1},
    ))

    if not doc_chunks:
        # No reference docs → all "Not found"
        all_chunks = []
    else:
        all_chunks = []
        for doc in doc_chunks:
            for chunk in doc.get("chunks", []):
                all_chunks.append({
                    "text":      chunk["text"],
                    "source":    doc["filename"],
                    "embedding": chunk["embedding"],
                })

    # Build FAISS index (if we have chunks)
    if all_chunks:
        index, chunk_list = _build_faiss_index(all_chunks)
    else:
        index, chunk_list = None, []

    # Answer each question
    answered_results = []
    for i, question in enumerate(questions):
        if index is not None:
            q_emb = get_embedding(question)
            top_chunks = _search(index, chunk_list, q_emb, top_k=4)
            # Use best score as confidence proxy if LLM doesn't override
            best_score = top_chunks[0]["score"] if top_chunks else 0.0
        else:
            top_chunks = []
            best_score = 0.0

        llm_result = generate_answer(question, top_chunks)

        # If LLM confidence is default (0.5) and we have a retrieval score, use it
        if llm_result["confidence"] == 0.5 and best_score > 0:
            llm_result["confidence"] = round(float(best_score), 4)

        # Collect evidence snippets (first 300 chars of each chunk)
        snippets = [
            {"source": c["source"], "text": c["text"][:300]}
            for c in top_chunks[:2]
        ]

        answered_results.append({
            "index":      i,
            "question":   question,
            "answer":     llm_result["answer"],
            "citation":   llm_result["citation"],
            "confidence": llm_result["confidence"],
            "snippets":   snippets,
            "edited":     False,
        })

    # Compute coverage summary
    answered_count = sum(
        1 for r in answered_results
        if r["answer"] != "Not found in references."
    )
    not_found_count = len(answered_results) - answered_count

    coverage = {
        "total":     len(answered_results),
        "answered":  answered_count,
        "not_found": not_found_count,
    }

    # Persist run
    run_doc = {
        "questionnaire_id":   questionnaire_id,
        "questionnaire_name": q_doc.get("filename", ""),
        "user_email":         user_email,
        "results":            answered_results,
        "coverage":           coverage,
        "created_at":         datetime.utcnow(),
    }
    inserted = runs_col.insert_one(run_doc)
    run_id = str(inserted.inserted_id)

    # Also update questionnaire with latest run_id
    questionnaires_col.update_one(
        {"_id": ObjectId(questionnaire_id)},
        {"$set": {"latest_run_id": run_id}},
    )

    return run_id
