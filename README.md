# QueryFlow AI – Structured Questionnaire Answering Tool

> AI-powered tool that reads your reference documents and automatically answers structured questionnaires — with citations, confidence scores, and a review/export workflow.

---

## 🏢 Fictional Company

**Industry:** Healthcare Technology (SaaS)

**Company:** NovaMed Health — A B2B SaaS platform for mid-size hospitals and outpatient clinics. NovaMed enables healthcare providers to digitize patient intake, automate insurance eligibility verification, and manage clinical documentation through a unified cloud-based dashboard. It serves 350+ healthcare organizations across the US.

The sample questionnaire (`sample_questionnaire/`) and reference documents (`reference_docs/`) are pre-built for NovaMed's security vendor assessment scenario.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Backend | Python 3.11 + FastAPI |
| Database | MongoDB Atlas |
| LLM | Groq (Llama-3.3-70B) |
| Embeddings | Google Gemini (`gemini-embedding-001`) |
| Vector Search | FAISS (in-memory, per-run) |
| Auth | JWT + bcrypt |
| Export | python-docx |

---

## 🗂 Project Structure

```
gtm-questionnaire-ai/
├── backend/
│   ├── main.py          # FastAPI app + all routes
│   ├── auth.py          # JWT signup/login
│   ├── db.py            # MongoDB connection
│   ├── rag.py           # FAISS vector search + RAG pipeline
│   ├── embeddings.py    # Gemini embedding wrapper
│   ├── llm.py           # Groq LLM wrapper
│   ├── utils.py         # Text extraction + chunking + question parsing
│   ├── export.py        # .docx export generator
│   ├── requirements.txt
│   └── .env             # API keys (DO NOT COMMIT)
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Router
│   │   ├── Login.jsx        # Auth page (signup + login)
│   │   ├── Dashboard.jsx    # Main screen
│   │   ├── UploadDocs.jsx   # Manage reference documents
│   │   ├── Results.jsx      # View generated answers
│   │   └── Review.jsx       # Edit, regenerate, export
│   │   ├── api.js           # Axios API client
│   │   └── index.css        # Global styles + design tokens
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── reference_docs/          # Sample reference documents for NovaMed
│   ├── security_policy.txt
│   ├── data_privacy_hipaa.txt
│   ├── infrastructure_sla.txt
│   ├── vendor_integrations.txt
│   └── product_overview.txt
│
├── sample_questionnaire/
│   └── security_vendor_questionnaire.txt
│
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB Atlas account (free tier works)
- Groq API key (free at console.groq.com)
- Google AI API key (for Gemini embeddings — aistudio.google.com)

### 1. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Edit `.env`:
```env
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AI...
JWT_SECRET=your-random-secret-string
```

Run the backend:
```bash
uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

> The Vite dev server proxies `/api/*` → `http://localhost:8000` automatically.

### 3. Quick Demo

1. **Sign up** at `/login`
2. Go to **Manage Documents** → upload all files from `reference_docs/`
3. Back on Dashboard → upload `sample_questionnaire/security_vendor_questionnaire.txt`
4. Click **⚡ Generate** on the questionnaire
5. Wait ~30–60 seconds for RAG to process all 15 questions
6. You'll be redirected to **Review** — edit any answers, then **Export .docx**

---

## ✨ Features

### Phase 1 – Core Workflow ✅
- User signup + login (JWT auth)
- Upload questionnaire (PDF, Excel, TXT)
- Upload reference documents (multiple, any format)
- Auto-parse questions from questionnaire
- RAG pipeline: embed docs → FAISS vector search → Groq LLM
- Each answer grounded with citations from source documents
- "Not found in references." returned when no relevant context found

### Phase 2 – Review & Export ✅
- Review all answers before exporting
- Inline editing of any answer
- Export as `.docx` preserving original question order, with answers + citations

### Optional Features Implemented ✅
- **Confidence Score** — Cosine similarity of best retrieved chunk used as confidence; LLM also provides its own assessment
- **Coverage Summary** — Total / Answered / Not Found shown on Dashboard and Results page
- **Partial Regeneration** — "↺ Regen" button on any question to re-run RAG for just that question
- **Evidence Snippets** — Expandable source text snippets shown per answer in Results view

---

## 🧠 Architecture: How the RAG Pipeline Works

```
User uploads reference docs
        ↓
   Extract text (pdfplumber / openpyxl)
        ↓
   Chunk text (500-word windows, 100-word overlap)
        ↓
   Embed each chunk (Gemini gemini-embedding-001, dim=3072)
        ↓
   Store chunks + embeddings in MongoDB

User clicks Generate
        ↓
   For each question:
     → Embed question (Gemini)
     → FAISS cosine search → top 4 chunks
     → Send to Groq (Llama 3.3 70B) with chunks as context
     → LLM returns: answer, citation, confidence (JSON)
     → Store result in MongoDB "runs" collection
        ↓
   Compute coverage summary
        ↓
   Redirect to Review page
```

---

## 📐 Assumptions

1. **FAISS is rebuilt in-memory per generation run** — no persistence needed since embeddings are stored in MongoDB. This is acceptable for the scale of this project (< 1000 chunks per user).

2. **Gemini `gemini-embedding-001` returns 3072-dimensional vectors** — hardcoded in `rag.py`. If this changes, update `EMBED_DIM`.

3. **Questions are parsed heuristically** — numbered lists (1. / 1) / Q1:), lines with "?", or fallback sentence splitting. Works well for standard vendor questionnaire formats.

4. **Confidence score** comes from two sources: the LLM's self-reported confidence (in JSON response) and the cosine similarity of the best-matched chunk. If the LLM returns the default 0.5, the retrieval score is used instead.

5. **One FAISS index per generation run** — all documents for a user are pooled into one index. This means if a user has documents from different projects, they're all searched together. In production, you'd want per-questionnaire document sets.

6. **No streaming** — LLM responses are collected in full before displaying. For very long questionnaires (50+ questions), this could take 2–3 minutes. A streaming/progress approach would be better for UX.

---

## ⚖️ Trade-offs

| Decision | Trade-off |
|---|---|
| FAISS in-memory (not Pinecone/Weaviate) | Simpler setup, no extra infra cost. Rebuilds on every run — fine for small-medium doc sets |
| Groq Llama 3.3 70B | Fast + free for dev. GPT-4o or Claude would likely yield higher citation accuracy |
| JSON-mode LLM output | Reliable structure, but occasionally LLM returns `"N/A"` citations even when context is present |
| MongoDB for chunk storage | Flexible schema, easy setup. For very large doc libraries, a dedicated vector DB would be more efficient |
| Single-file frontend components | Easier to read and deploy. For a production app, split into hooks + components |

---

## 🔮 What I'd Improve With More Time

1. **Streaming progress** — Show a live progress bar as each question is answered, rather than waiting for all 15 to complete.

2. **Per-questionnaire document sets** — Let users assign specific reference docs to a questionnaire, rather than searching all their docs.

3. **Re-ranking** — Add a cross-encoder re-ranker (e.g., Cohere Rerank) after FAISS retrieval to improve citation accuracy before passing to the LLM.

4. **Version history UI** — The backend already saves every run, but the frontend doesn't yet show a diff view comparing two runs side-by-side.

5. **Better question parser** — Use an LLM to extract questions from complex PDFs (e.g., multi-column Excel questionnaires) more reliably.

6. **Authentication hardening** — Add refresh tokens, rate limiting on `/login`, and email verification.

7. **Admin panel** — Usage metrics, document management across users, subprocessor list management.

8. **Production deployment** — Backend to Railway/Render, frontend to Vercel, MongoDB Atlas M10+ for production workloads.

---

## 🌐 Deployment

**Backend (Railway / Render):**
```bash
# Procfile
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```
Set environment variables in the platform dashboard.

**Frontend (Vercel):**
```bash
# In frontend/
vercel --prod
```
Set `VITE_API_URL=https://your-backend.railway.app` in Vercel environment variables.

---

## 📄 License

MIT — built as a take-home assignment demonstration.
