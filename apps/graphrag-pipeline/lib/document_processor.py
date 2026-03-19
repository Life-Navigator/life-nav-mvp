"""Document processing: PDF text extraction, chunking, and embedding pipeline.

Used by compliance_upload and compliance_process endpoints to ingest
regulatory documents into the Qdrant compliance_knowledge collection.
"""

from __future__ import annotations

import io
import re
import time
import uuid
from typing import Optional

from lib.config import Config


def extract_text_from_pdf(content: bytes) -> str:
    """Extract text from a PDF file using PyPDF2. No network calls."""
    try:
        from PyPDF2 import PdfReader
    except ImportError:
        raise ImportError("PyPDF2 is required for PDF processing: pip install PyPDF2")

    reader = PdfReader(io.BytesIO(content))
    pages: list[str] = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text.strip())
    return "\n\n".join(pages)


def _estimate_tokens(text: str) -> int:
    """Rough token estimate: ~4 chars per token for English."""
    return max(1, len(text) // 4)


def _split_sentences(text: str) -> list[str]:
    """Split text into sentences at period/question/exclamation boundaries."""
    return re.split(r"(?<=[.!?])\s+", text)


def chunk_text(
    text: str,
    max_tokens: int = 500,
    overlap: int = 50,
) -> list[dict]:
    """Split text into overlapping chunks at sentence boundaries.

    Returns list of {chunk_index, section_title, text, token_count}.
    """
    paragraphs = re.split(r"\n{2,}", text)
    chunks: list[dict] = []
    current_sentences: list[str] = []
    current_tokens = 0
    section_title: Optional[str] = None

    def _flush():
        nonlocal current_sentences, current_tokens
        if not current_sentences:
            return
        chunk_text_str = " ".join(current_sentences)
        chunks.append({
            "chunk_index": len(chunks),
            "section_title": section_title,
            "text": chunk_text_str.strip(),
            "token_count": _estimate_tokens(chunk_text_str),
        })
        # Keep last sentences that fit within overlap for next chunk
        overlap_sentences: list[str] = []
        overlap_tokens = 0
        for s in reversed(current_sentences):
            t = _estimate_tokens(s)
            if overlap_tokens + t > overlap:
                break
            overlap_sentences.insert(0, s)
            overlap_tokens += t
        current_sentences = overlap_sentences
        current_tokens = overlap_tokens

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        # Detect section headers (lines that are short and title-case or all-caps)
        if len(para) < 120 and (para.isupper() or para.istitle()):
            _flush()
            section_title = para
            continue

        sentences = _split_sentences(para)
        for sentence in sentences:
            sent_tokens = _estimate_tokens(sentence)
            if current_tokens + sent_tokens > max_tokens and current_sentences:
                _flush()
            current_sentences.append(sentence)
            current_tokens += sent_tokens

    _flush()
    return chunks


def process_regulatory_document(
    document_id: str,
    storage_path: str,
    supabase_client,
    gemini_client,
    qdrant_client,
    max_chunks_inline: int = 20,
) -> dict:
    """Full pipeline: download -> extract -> chunk -> embed -> upsert.

    Processes up to max_chunks_inline chunks synchronously. Remaining
    chunks are left with embedding_status='pending' for the background
    processor.

    Returns {status, chunk_count, embedded_count, error?}.
    """
    sb = supabase_client.get_client()

    # Update status to processing
    sb.schema("compliance").from_("regulatory_documents").update({
        "status": "processing",
        "updated_at": "now()",
    }).eq("id", document_id).execute()

    try:
        # 1. Download file from storage
        file_bytes = sb.storage.from_("regulatory-documents").download(storage_path)

        # 2. Extract text
        if storage_path.lower().endswith(".pdf"):
            text = extract_text_from_pdf(file_bytes)
        else:
            text = file_bytes.decode("utf-8", errors="replace")

        if not text.strip():
            raise ValueError("No text could be extracted from the document")

        # 3. Chunk
        chunks = chunk_text(text, max_tokens=500, overlap=50)

        # 4. Insert chunks into compliance.document_chunks
        chunk_rows = [
            {
                "document_id": document_id,
                "chunk_index": c["chunk_index"],
                "section_title": c["section_title"],
                "text": c["text"],
                "token_count": c["token_count"],
                "embedding_status": "pending",
            }
            for c in chunks
        ]
        if chunk_rows:
            sb.schema("compliance").from_("document_chunks").insert(chunk_rows).execute()

        # 5. Embed and upsert first batch inline
        embedded_count = _embed_and_upsert_chunks(
            document_id=document_id,
            supabase_client=supabase_client,
            gemini_client=gemini_client,
            qdrant_client=qdrant_client,
            limit=max_chunks_inline,
        )

        # 6. Update document metadata
        final_status = "completed" if embedded_count >= len(chunks) else "processing"
        sb.schema("compliance").from_("regulatory_documents").update({
            "status": final_status,
            "chunk_count": len(chunks),
            "updated_at": "now()",
        }).eq("id", document_id).execute()

        return {
            "status": final_status,
            "chunk_count": len(chunks),
            "embedded_count": embedded_count,
        }

    except Exception as e:
        sb.schema("compliance").from_("regulatory_documents").update({
            "status": "failed",
            "error_message": str(e)[:2000],
            "updated_at": "now()",
        }).eq("id", document_id).execute()
        return {"status": "failed", "error": str(e)[:2000]}


def _embed_and_upsert_chunks(
    document_id: str,
    supabase_client,
    gemini_client,
    qdrant_client,
    limit: int = 20,
) -> int:
    """Embed pending chunks and upsert to Qdrant compliance_knowledge.

    Returns number of chunks successfully embedded.
    """
    sb = supabase_client.get_client()

    # Fetch pending chunks
    resp = (
        sb.schema("compliance")
        .from_("document_chunks")
        .select("id, chunk_index, section_title, text, token_count")
        .eq("document_id", document_id)
        .eq("embedding_status", "pending")
        .order("chunk_index")
        .limit(limit)
        .execute()
    )
    pending = resp.data or []
    if not pending:
        return 0

    # Fetch document metadata for payload enrichment
    doc_resp = (
        sb.schema("compliance")
        .from_("regulatory_documents")
        .select("title, document_type, domain, jurisdiction, regulation_code")
        .eq("id", document_id)
        .single()
        .execute()
    )
    doc_meta = doc_resp.data or {}

    # Ensure collection exists
    qdrant_client.ensure_collection(Config.QDRANT_COMPLIANCE_COLLECTION)

    embedded_count = 0
    for chunk in pending:
        try:
            # Embed
            vector = gemini_client.embed_text(chunk["text"][:2000])
            point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"compliance:{document_id}:{chunk['chunk_index']}"))

            # Upsert to Qdrant
            qdrant_client.upsert_points(
                points=[{
                    "id": point_id,
                    "vector": vector,
                    "payload": {
                        "document_id": document_id,
                        "chunk_id": chunk["id"],
                        "chunk_index": chunk["chunk_index"],
                        "section_title": chunk.get("section_title"),
                        "text": chunk["text"],
                        "token_count": chunk.get("token_count"),
                        "document_title": doc_meta.get("title"),
                        "document_type": doc_meta.get("document_type"),
                        "domain": doc_meta.get("domain"),
                        "jurisdiction": doc_meta.get("jurisdiction"),
                        "regulation_code": doc_meta.get("regulation_code"),
                        "source": "compliance_knowledge",
                    },
                }],
                collection=Config.QDRANT_COMPLIANCE_COLLECTION,
            )

            # Mark as embedded
            sb.schema("compliance").from_("document_chunks").update({
                "embedding_status": "embedded",
                "qdrant_point_id": point_id,
            }).eq("id", chunk["id"]).execute()

            embedded_count += 1

            # Rate limiting: 100ms between embedding calls
            time.sleep(0.1)

        except Exception:
            sb.schema("compliance").from_("document_chunks").update({
                "embedding_status": "failed",
            }).eq("id", chunk["id"]).execute()

    return embedded_count
