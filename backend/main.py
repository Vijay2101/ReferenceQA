"""
main.py – FastAPI entry point for the GTM Questionnaire AI tool.
"""

import os
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from bson import ObjectId
from typing import Optional

from auth import router as auth_router, get_current_user
from db import documents_col, questionnaires_col, runs_col
from utils import extract_text, parse_questions, chunk_text
from embeddings import get_embedding
from rag import run_rag_pipeline
from export import generate_docx

app = FastAPI(title="GTM Questionnaire AI", version="1.0.0")

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _oid(s: str) -> ObjectId:
    try:
        return ObjectId(s)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID format")


# ─── Reference Documents ──────────────────────────────────────────────────────

@app.post("/upload-documents")
async def upload_documents(
    files: list[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload one or more reference documents. Chunks + embeds each."""
    inserted = []
    for file in files:
        raw = await file.read()
        text = extract_text(file.filename, raw)
        chunks_text = chunk_text(text)

        chunks_with_embeddings = []
        for chunk in chunks_text:
            emb = get_embedding(chunk)
            chunks_with_embeddings.append({"text": chunk, "embedding": emb})

        doc = {
            "user_email": current_user["email"],
            "filename":   file.filename,
            "text":       text[:2000],   # store preview
            "chunks":     chunks_with_embeddings,
            "uploaded_at": datetime.utcnow(),
        }
        result = documents_col.insert_one(doc)
        inserted.append({"id": str(result.inserted_id), "filename": file.filename})

    return {"uploaded": inserted}


@app.get("/documents")
def list_documents(current_user: dict = Depends(get_current_user)):
    docs = list(documents_col.find(
        {"user_email": current_user["email"]},
        {"_id": 1, "filename": 1, "uploaded_at": 1},
    ))
    for d in docs:
        d["_id"] = str(d["_id"])
    return docs


@app.delete("/documents/{doc_id}")
def delete_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    result = documents_col.delete_one({
        "_id": _oid(doc_id),
        "user_email": current_user["email"],
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"deleted": doc_id}


# ─── Questionnaires ───────────────────────────────────────────────────────────

@app.post("/upload-questionnaire")
async def upload_questionnaire(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    raw = await file.read()
    text = extract_text(file.filename, raw)
    questions = parse_questions(text)

    if not questions:
        raise HTTPException(status_code=422, detail="Could not parse any questions from the file.")

    doc = {
        "user_email": current_user["email"],
        "filename":   file.filename,
        "raw_text":   text,
        "questions":  questions,
        "uploaded_at": datetime.utcnow(),
    }
    result = questionnaires_col.insert_one(doc)
    return {
        "questionnaire_id": str(result.inserted_id),
        "filename":         file.filename,
        "question_count":   len(questions),
        "questions":        questions,
    }


@app.get("/questionnaires")
def list_questionnaires(current_user: dict = Depends(get_current_user)):
    items = list(questionnaires_col.find(
        {"user_email": current_user["email"]},
        {"_id": 1, "filename": 1, "question_count": 1, "uploaded_at": 1, "latest_run_id": 1},
    ))
    for it in items:
        it["_id"] = str(it["_id"])
        it["question_count"] = len(
            questionnaires_col.find_one(
                {"_id": ObjectId(it["_id"])}, {"questions": 1}
            ).get("questions", [])
        )
    return items


# ─── Generate Answers ─────────────────────────────────────────────────────────

@app.post("/generate-answers/{questionnaire_id}")
def generate_answers(
    questionnaire_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Run the RAG pipeline and return the run_id."""
    run_id = run_rag_pipeline(questionnaire_id, current_user["email"])
    return {"run_id": run_id, "status": "completed"}


# ─── Run results ──────────────────────────────────────────────────────────────

@app.get("/run/{run_id}")
def get_run(run_id: str, current_user: dict = Depends(get_current_user)):
    run = runs_col.find_one({"_id": _oid(run_id), "user_email": current_user["email"]})
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    run["_id"] = str(run["_id"])
    return run


@app.get("/runs")
def list_runs(current_user: dict = Depends(get_current_user)):
    items = list(runs_col.find(
        {"user_email": current_user["email"]},
        {"_id": 1, "questionnaire_name": 1, "coverage": 1, "created_at": 1},
    ))
    for it in items:
        it["_id"] = str(it["_id"])
    return items


# ─── Edit answer ──────────────────────────────────────────────────────────────

class EditAnswerBody(BaseModel):
    question_index: int
    answer: str


@app.patch("/run/{run_id}/edit")
def edit_answer(
    run_id: str,
    body: EditAnswerBody,
    current_user: dict = Depends(get_current_user),
):
    run = runs_col.find_one({"_id": _oid(run_id), "user_email": current_user["email"]})
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    results = run["results"]
    idx = body.question_index
    if idx < 0 or idx >= len(results):
        raise HTTPException(status_code=400, detail="Invalid question index")

    results[idx]["answer"] = body.answer
    results[idx]["edited"] = True

    # Recompute coverage
    answered = sum(1 for r in results if r["answer"] != "Not found in references.")
    coverage = {
        "total":     len(results),
        "answered":  answered,
        "not_found": len(results) - answered,
    }

    runs_col.update_one(
        {"_id": _oid(run_id)},
        {"$set": {"results": results, "coverage": coverage}},
    )
    return {"updated": True, "coverage": coverage}


# ─── Regenerate single answer ─────────────────────────────────────────────────

class RegenerateBody(BaseModel):
    question_index: int


@app.post("/run/{run_id}/regenerate")
def regenerate_answer(
    run_id: str,
    body: RegenerateBody,
    current_user: dict = Depends(get_current_user),
):
    """Regenerate the answer for a single question (partial regeneration)."""
    from rag import _build_faiss_index, _search
    from llm import generate_answer as llm_gen

    run = runs_col.find_one({"_id": _oid(run_id), "user_email": current_user["email"]})
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    results = run["results"]
    idx = body.question_index
    if idx < 0 or idx >= len(results):
        raise HTTPException(status_code=400, detail="Invalid question index")

    question = results[idx]["question"]

    # Rebuild index from docs
    doc_chunks = list(documents_col.find(
        {"user_email": current_user["email"]},
        {"_id": 0, "chunks": 1, "filename": 1},
    ))
    all_chunks = []
    for doc in doc_chunks:
        for chunk in doc.get("chunks", []):
            all_chunks.append({
                "text":      chunk["text"],
                "source":    doc["filename"],
                "embedding": chunk["embedding"],
            })

    if all_chunks:
        index, chunk_list = _build_faiss_index(all_chunks)
        q_emb = get_embedding(question)
        top_chunks = _search(index, chunk_list, q_emb, top_k=4)
    else:
        top_chunks = []

    llm_result = llm_gen(question, top_chunks)

    snippets = [
        {"source": c["source"], "text": c["text"][:300]}
        for c in top_chunks[:2]
    ]

    results[idx].update({
        "answer":     llm_result["answer"],
        "citation":   llm_result["citation"],
        "confidence": llm_result["confidence"],
        "snippets":   snippets,
        "edited":     False,
    })

    # Recompute coverage
    answered = sum(1 for r in results if r["answer"] != "Not found in references.")
    coverage = {
        "total":     len(results),
        "answered":  answered,
        "not_found": len(results) - answered,
    }

    runs_col.update_one(
        {"_id": _oid(run_id)},
        {"$set": {"results": results, "coverage": coverage}},
    )
    return {"updated": True, "result": results[idx], "coverage": coverage}


# ─── Export ───────────────────────────────────────────────────────────────────

@app.get("/export/{run_id}")
def export_run(run_id: str, current_user: dict = Depends(get_current_user)):
    run = runs_col.find_one({"_id": _oid(run_id), "user_email": current_user["email"]})
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    doc_bytes = generate_docx(run)
    q_name = run.get("questionnaire_name", "answers").replace(" ", "_").replace(".pdf", "").replace(".xlsx", "")
    filename = f"{q_name}_answered.docx"

    return Response(
        content=doc_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}
