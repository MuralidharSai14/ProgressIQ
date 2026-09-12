"""
PROGRESSIQ — Document Processors
Extracts raw text from PDF, TXT, CSV files.
"""
import io
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def extract_text_from_pdf(content: bytes) -> tuple[str, list[dict]]:
    """
    Extract text from a PDF file.
    Returns (full_text, pages) where pages is a list of {page_num, text}.
    """
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(stream=content, filetype="pdf")
        pages = []
        full_text_parts = []
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text("text")
            pages.append({"page_num": page_num + 1, "text": text})
            full_text_parts.append(text)
        doc.close()
        return "\n".join(full_text_parts), pages
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
        return "", []


def extract_text_from_txt(content: bytes) -> str:
    """Extract text from a plain text file."""
    try:
        return content.decode("utf-8", errors="replace")
    except Exception as e:
        logger.error(f"TXT extraction error: {e}")
        return ""


def split_into_paragraphs(text: str, min_length: int = 30) -> list[str]:
    """
    Split field report text into meaningful paragraphs/chunks.
    Each chunk will be processed as a separate field update.
    """
    if not text:
        return []
    # Split on double newlines first
    paragraphs = [p.strip() for p in text.split("\n\n")]
    result = []
    for para in paragraphs:
        if len(para) >= min_length:
            result.append(para)
        elif result:
            # Append short lines to previous paragraph
            result[-1] += " " + para
    return [p for p in result if len(p.strip()) >= min_length]


def sanitize_filename(filename: str) -> str:
    """Remove dangerous characters from uploaded filenames."""
    import re
    # Keep only alphanumeric, dots, underscores, hyphens
    safe = re.sub(r'[^\w.\-]', '_', Path(filename).name)
    return safe[:200]  # Limit length
