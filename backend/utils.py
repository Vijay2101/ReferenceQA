import re
import io
import pdfplumber
import openpyxl


# ─── Text extraction ─────────────────────────────────────────────────────────

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract all text from a PDF byte string."""
    text_parts = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                text_parts.append(t)
    return "\n".join(text_parts)


def extract_text_from_excel(file_bytes: bytes) -> str:
    """Flatten an Excel workbook into plain text."""
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    lines = []
    for sheet in wb.worksheets:
        lines.append(f"[Sheet: {sheet.title}]")
        for row in sheet.iter_rows(values_only=True):
            row_text = "\t".join(str(c) if c is not None else "" for c in row)
            if row_text.strip():
                lines.append(row_text)
    return "\n".join(lines)


def extract_text(filename: str, file_bytes: bytes) -> str:
    name_lower = filename.lower()
    if name_lower.endswith(".pdf"):
        return extract_text_from_pdf(file_bytes)
    if name_lower.endswith((".xlsx", ".xls")):
        return extract_text_from_excel(file_bytes)
    # Plain text / txt / csv
    return file_bytes.decode("utf-8", errors="replace")


# ─── Question parsing ────────────────────────────────────────────────────────

def parse_questions(text: str) -> list[str]:
    """
    Heuristic parser: split text into individual questions.
    Handles numbered lists (1. / 1) / Q1:), and standalone sentences ending in ?.
    """
    # Try numbered list first
    numbered = re.split(r"\n\s*(?:\d+[\.\)]\s+|Q\d+[:\.\)]\s*)", text)
    questions = [q.strip() for q in numbered if q.strip()]

    # If only 1 item, fall back to sentence splitting
    if len(questions) <= 1:
        sentences = re.split(r"(?<=[?])\s+", text)
        questions = [s.strip() for s in sentences if s.strip() and len(s.strip()) > 10]

    # Remove lines that look like headers (no "?" and very short)
    questions = [
        q for q in questions
        if "?" in q or len(q.split()) >= 5
    ]

    # Remove any empty or pure-whitespace entries
    questions = [q for q in questions if q]

    return questions


# ─── Chunking ────────────────────────────────────────────────────────────────

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 100) -> list[str]:
    """Split text into overlapping word-window chunks."""
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunks.append(" ".join(words[start:end]))
        if end == len(words):
            break
        start += chunk_size - overlap
    return chunks
