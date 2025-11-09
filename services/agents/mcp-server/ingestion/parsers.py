"""Document Parsers for Multiple Formats"""

from typing import Dict, List, Any, Optional
from pathlib import Path
import structlog

logger = structlog.get_logger(__name__)


class DocumentParser:
    """Base class for document parsers"""

    def parse(self, file_path: str) -> Dict[str, Any]:
        """
        Parse a document and extract text and metadata.

        Args:
            file_path: Path to the document

        Returns:
            Dictionary with:
                - text: Extracted text content
                - metadata: Document metadata (title, author, etc.)
                - chunks: Text split into chunks
        """
        raise NotImplementedError


class TextParser(DocumentParser):
    """Parser for plain text files (.txt)"""

    def parse(self, file_path: str) -> Dict[str, Any]:
        """Parse plain text file"""
        logger.info("parsing_text_file", file_path=file_path)

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                text = f.read()

            # Split into chunks (paragraphs)
            chunks = [chunk.strip() for chunk in text.split('\n\n') if chunk.strip()]

            return {
                "text": text,
                "metadata": {
                    "file_path": file_path,
                    "file_type": "text",
                    "size": len(text),
                },
                "chunks": chunks,
            }

        except Exception as e:
            logger.error("text_parsing_failed", error=str(e), file_path=file_path)
            raise


class MarkdownParser(DocumentParser):
    """Parser for Markdown files (.md)"""

    def parse(self, file_path: str) -> Dict[str, Any]:
        """Parse Markdown file"""
        logger.info("parsing_markdown_file", file_path=file_path)

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                text = f.read()

            # Extract title from first heading
            title = None
            lines = text.split('\n')
            for line in lines:
                if line.startswith('# '):
                    title = line[2:].strip()
                    break

            # Split into chunks by headings
            chunks = self._split_by_headings(text)

            return {
                "text": text,
                "metadata": {
                    "file_path": file_path,
                    "file_type": "markdown",
                    "title": title,
                    "size": len(text),
                },
                "chunks": chunks,
            }

        except Exception as e:
            logger.error("markdown_parsing_failed", error=str(e), file_path=file_path)
            raise

    def _split_by_headings(self, text: str) -> List[str]:
        """Split markdown by headings"""
        chunks = []
        current_chunk = []

        for line in text.split('\n'):
            if line.startswith('#'):
                if current_chunk:
                    chunks.append('\n'.join(current_chunk).strip())
                current_chunk = [line]
            else:
                current_chunk.append(line)

        if current_chunk:
            chunks.append('\n'.join(current_chunk).strip())

        return [c for c in chunks if c]


class PDFParser(DocumentParser):
    """Parser for PDF files (.pdf)"""

    def parse(self, file_path: str) -> Dict[str, Any]:
        """Parse PDF file"""
        logger.info("parsing_pdf_file", file_path=file_path)

        try:
            import PyPDF2

            text_chunks = []
            metadata = {}

            with open(file_path, 'rb') as f:
                pdf_reader = PyPDF2.PdfReader(f)

                # Extract metadata
                if pdf_reader.metadata:
                    metadata.update({
                        "title": pdf_reader.metadata.get('/Title', ''),
                        "author": pdf_reader.metadata.get('/Author', ''),
                        "subject": pdf_reader.metadata.get('/Subject', ''),
                    })

                metadata["pages"] = len(pdf_reader.pages)

                # Extract text from each page
                for page_num, page in enumerate(pdf_reader.pages):
                    page_text = page.extract_text()
                    if page_text.strip():
                        text_chunks.append({
                            "text": page_text,
                            "page": page_num + 1
                        })

            # Combine all text
            full_text = '\n\n'.join(chunk["text"] for chunk in text_chunks)

            # Create chunks (by page or paragraph)
            chunks = [chunk["text"] for chunk in text_chunks]

            metadata.update({
                "file_path": file_path,
                "file_type": "pdf",
                "size": len(full_text),
            })

            return {
                "text": full_text,
                "metadata": metadata,
                "chunks": chunks,
            }

        except ImportError:
            logger.error("pypdf2_not_installed")
            raise ImportError("PyPDF2 is required for PDF parsing. Install with: pip install PyPDF2")

        except Exception as e:
            logger.error("pdf_parsing_failed", error=str(e), file_path=file_path)
            raise


class DOCXParser(DocumentParser):
    """Parser for Word documents (.docx)"""

    def parse(self, file_path: str) -> Dict[str, Any]:
        """Parse DOCX file"""
        logger.info("parsing_docx_file", file_path=file_path)

        try:
            from docx import Document

            doc = Document(file_path)

            # Extract metadata
            metadata = {
                "file_path": file_path,
                "file_type": "docx",
            }

            # Try to get document properties
            try:
                core_props = doc.core_properties
                metadata.update({
                    "title": core_props.title or '',
                    "author": core_props.author or '',
                    "subject": core_props.subject or '',
                })
            except Exception as e:
                # Log error for debugging
                import logging
                logger = logging.getLogger(__name__)
                logger.debug(f"Operation failed: {e}")
                pass

            # Extract text from paragraphs
            chunks = []
            for paragraph in doc.paragraphs:
                text = paragraph.text.strip()
                if text:
                    chunks.append(text)

            # Combine all text
            full_text = '\n\n'.join(chunks)

            metadata["size"] = len(full_text)
            metadata["paragraphs"] = len(chunks)

            return {
                "text": full_text,
                "metadata": metadata,
                "chunks": chunks,
            }

        except ImportError:
            logger.error("python_docx_not_installed")
            raise ImportError("python-docx is required for DOCX parsing. Install with: pip install python-docx")

        except Exception as e:
            logger.error("docx_parsing_failed", error=str(e), file_path=file_path)
            raise


class HTMLParser(DocumentParser):
    """Parser for HTML files (.html, .htm)"""

    def parse(self, file_path: str) -> Dict[str, Any]:
        """Parse HTML file"""
        logger.info("parsing_html_file", file_path=file_path)

        try:
            from bs4 import BeautifulSoup

            with open(file_path, 'r', encoding='utf-8') as f:
                html_content = f.read()

            soup = BeautifulSoup(html_content, 'html.parser')

            # Extract title
            title = soup.title.string if soup.title else None

            # Remove script and style elements
            for script in soup(["script", "style"]):
                script.decompose()

            # Extract text
            text = soup.get_text()

            # Clean up text
            lines = (line.strip() for line in text.splitlines())
            chunks = [line for line in lines if line]

            full_text = '\n'.join(chunks)

            metadata = {
                "file_path": file_path,
                "file_type": "html",
                "title": title,
                "size": len(full_text),
            }

            # Split into semantic chunks (paragraphs)
            paragraphs = [p.get_text().strip() for p in soup.find_all('p') if p.get_text().strip()]

            return {
                "text": full_text,
                "metadata": metadata,
                "chunks": paragraphs if paragraphs else chunks,
            }

        except ImportError:
            logger.error("beautifulsoup_not_installed")
            raise ImportError("beautifulsoup4 is required for HTML parsing. Install with: pip install beautifulsoup4")

        except Exception as e:
            logger.error("html_parsing_failed", error=str(e), file_path=file_path)
            raise


class CSVParser(DocumentParser):
    """Parser for CSV files (.csv)"""

    def parse(self, file_path: str) -> Dict[str, Any]:
        """Parse CSV file"""
        logger.info("parsing_csv_file", file_path=file_path)

        try:
            import csv

            rows = []
            headers = None

            with open(file_path, 'r', encoding='utf-8') as f:
                csv_reader = csv.reader(f)
                headers = next(csv_reader, None)

                for row in csv_reader:
                    rows.append(row)

            # Convert to text representation
            chunks = []
            for row in rows:
                if headers:
                    row_text = ', '.join(f"{h}: {v}" for h, v in zip(headers, row))
                else:
                    row_text = ', '.join(row)
                chunks.append(row_text)

            full_text = '\n'.join(chunks)

            metadata = {
                "file_path": file_path,
                "file_type": "csv",
                "headers": headers,
                "rows": len(rows),
                "size": len(full_text),
            }

            return {
                "text": full_text,
                "metadata": metadata,
                "chunks": chunks,
            }

        except Exception as e:
            logger.error("csv_parsing_failed", error=str(e), file_path=file_path)
            raise


class JSONParser(DocumentParser):
    """Parser for JSON files (.json)"""

    def parse(self, file_path: str) -> Dict[str, Any]:
        """Parse JSON file"""
        logger.info("parsing_json_file", file_path=file_path)

        try:
            import json

            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # Convert JSON to readable text
            text = json.dumps(data, indent=2)

            # Create chunks from top-level keys
            chunks = []
            if isinstance(data, dict):
                for key, value in data.items():
                    chunk_text = f"{key}: {json.dumps(value, indent=2)}"
                    chunks.append(chunk_text)
            elif isinstance(data, list):
                for i, item in enumerate(data):
                    chunk_text = f"Item {i}: {json.dumps(item, indent=2)}"
                    chunks.append(chunk_text)

            metadata = {
                "file_path": file_path,
                "file_type": "json",
                "structure": type(data).__name__,
                "size": len(text),
            }

            return {
                "text": text,
                "metadata": metadata,
                "chunks": chunks if chunks else [text],
            }

        except Exception as e:
            logger.error("json_parsing_failed", error=str(e), file_path=file_path)
            raise


class ParserFactory:
    """Factory for creating document parsers"""

    PARSERS = {
        '.txt': TextParser,
        '.md': MarkdownParser,
        '.pdf': PDFParser,
        '.docx': DOCXParser,
        '.doc': DOCXParser,
        '.html': HTMLParser,
        '.htm': HTMLParser,
        '.csv': CSVParser,
        '.json': JSONParser,
    }

    @classmethod
    def get_parser(cls, file_path: str) -> Optional[DocumentParser]:
        """
        Get appropriate parser for file type.

        Args:
            file_path: Path to file

        Returns:
            Parser instance or None if unsupported
        """
        suffix = Path(file_path).suffix.lower()
        parser_class = cls.PARSERS.get(suffix)

        if parser_class:
            return parser_class()

        logger.warning("unsupported_file_type", suffix=suffix, file_path=file_path)
        return None

    @classmethod
    def supported_extensions(cls) -> List[str]:
        """Get list of supported file extensions"""
        return list(cls.PARSERS.keys())

    @classmethod
    def parse_document(cls, file_path: str) -> Optional[Dict[str, Any]]:
        """
        Parse a document using the appropriate parser.

        Args:
            file_path: Path to document

        Returns:
            Parsed document data or None if unsupported
        """
        parser = cls.get_parser(file_path)
        if parser:
            return parser.parse(file_path)
        return None
