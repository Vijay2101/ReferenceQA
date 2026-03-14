import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    return _client


SYSTEM_PROMPT = """You are an expert questionnaire answering assistant for a company.
Your job is to answer questions using ONLY the provided reference document context.

Rules:
1. Use ONLY information found in the provided context.
2. Always cite the source document name(s) you used.
3. If the answer is not found in the context, respond with exactly: "Not found in references."
4. Be concise, professional, and accurate.
5. Always respond in valid JSON matching the schema exactly.

Response schema:
{
  "answer": "<your answer or 'Not found in references.'>",
  "citation": "<document name(s) used, comma-separated, or 'N/A'>",
  "confidence": <float between 0.0 and 1.0>
}"""


def generate_answer(question: str, context_chunks: list[dict]) -> dict:
    """
    Generate an answer for `question` using retrieved `context_chunks`.
    Each chunk: {"text": str, "source": str, "score": float}
    Returns: {"answer": str, "citation": str, "confidence": float}
    """
    if not context_chunks:
        return {
            "answer": "Not found in references.",
            "citation": "N/A",
            "confidence": 0.0,
        }

    context_text = "\n\n".join(
        f"[Source: {c['source']}]\n{c['text']}"
        for c in context_chunks
    )

    user_prompt = f"""Question:
{question}

Reference Context:
{context_text}

Answer the question using only the context above. Respond in JSON."""

    client = _get_client()
    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
        response_format={"type": "json_object"},
        max_tokens=600,
    )

    raw = completion.choices[0].message.content
    try:
        result = json.loads(raw)
        # Normalise keys
        return {
            "answer":     result.get("answer", "Not found in references."),
            "citation":   result.get("citation", "N/A"),
            "confidence": float(result.get("confidence", 0.5)),
        }
    except (json.JSONDecodeError, ValueError):
        return {
            "answer":     raw.strip() or "Not found in references.",
            "citation":   "N/A",
            "confidence": 0.3,
        }
