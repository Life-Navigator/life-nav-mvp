"""
Hybrid OCR Service - Tesseract + Claude Vision Fallback

Strategy:
- 90% of volume → Tesseract OCR (free, fast)
- 10% of volume → Claude Vision API (high quality, handles complex/poor scans)

Quality assessment determines routing:
- High quality scans (>0.8 score) → Tesseract
- Low quality/complex documents → Claude Vision
"""
import io
import os
from typing import Tuple, Optional
from enum import Enum
import logging

import pytesseract
from PIL import Image, ImageEnhance, ImageFilter
import cv2
import numpy as np

logger = logging.getLogger(__name__)


class OCREngine(str, Enum):
    """OCR engine selection"""
    TESSERACT = "tesseract"
    CLAUDE_VISION = "claude_vision"


class ImageQuality(str, Enum):
    """Image quality assessment"""
    HIGH = "high"        # >0.8 - Clean scans, good contrast
    MEDIUM = "medium"    # 0.5-0.8 - Acceptable quality
    LOW = "low"          # <0.5 - Poor scans, handwritten, complex layouts


class HybridOCRService:
    """
    Hybrid OCR with automatic quality-based routing.

    Features:
    - Image quality assessment (contrast, noise, resolution)
    - Tesseract OCR for high-quality scans (90% of volume)
    - Claude Vision fallback for poor quality (10% of volume)
    - Pre-processing pipeline (denoise, enhance, deskew)
    - Cost tracking and optimization
    """

    def __init__(
        self,
        claude_api_key: Optional[str] = None,
        fallback_enabled: bool = True,
        quality_threshold: float = 0.75
    ):
        """
        Initialize hybrid OCR service.

        Args:
            claude_api_key: Anthropic API key for Claude Vision
            fallback_enabled: Enable Claude Vision fallback
            quality_threshold: Quality score threshold for Tesseract (0-1)
        """
        self.claude_api_key = claude_api_key or os.getenv("ANTHROPIC_API_KEY")
        self.fallback_enabled = fallback_enabled and self.claude_api_key is not None
        self.quality_threshold = quality_threshold

        # Cost tracking
        self.tesseract_count = 0
        self.claude_count = 0

        logger.info(
            f"Hybrid OCR initialized",
            extra={
                "fallback_enabled": self.fallback_enabled,
                "quality_threshold": quality_threshold
            }
        )

    async def extract_text(
        self,
        image_bytes: bytes,
        doc_type: Optional[str] = None,
        force_engine: Optional[OCREngine] = None
    ) -> Tuple[str, OCREngine, float]:
        """
        Extract text from image using hybrid OCR strategy.

        Args:
            image_bytes: Image file content (PNG, JPG, PDF page)
            doc_type: Document type hint (W2, 1099, bank_statement, etc.)
            force_engine: Force specific OCR engine (bypass quality check)

        Returns:
            Tuple of (extracted_text, engine_used, quality_score)

        Example:
            >>> text, engine, quality = await ocr.extract_text(
            ...     image_bytes=pdf_page,
            ...     doc_type="W2"
            ... )
            >>> print(f"Used {engine}, quality {quality:.2f}")
        """
        # Load and pre-process image
        image = Image.open(io.BytesIO(image_bytes))
        quality_score = self._assess_image_quality(image)

        logger.debug(
            f"Image quality assessed",
            extra={
                "quality_score": quality_score,
                "doc_type": doc_type,
                "size": image.size
            }
        )

        # Determine OCR engine
        if force_engine:
            engine = force_engine
        elif quality_score >= self.quality_threshold and doc_type in ["W2", "1099", "bank_statement"]:
            engine = OCREngine.TESSERACT
        elif self.fallback_enabled:
            engine = OCREngine.CLAUDE_VISION
        else:
            # Fallback to Tesseract if Claude not available
            engine = OCREngine.TESSERACT

        # Route to appropriate OCR engine
        if engine == OCREngine.TESSERACT:
            text = self._tesseract_ocr(image)
            self.tesseract_count += 1
        else:
            text = await self._claude_vision_ocr(image_bytes, doc_type)
            self.claude_count += 1

        logger.info(
            f"OCR completed",
            extra={
                "engine": engine,
                "quality": quality_score,
                "text_length": len(text),
                "doc_type": doc_type
            }
        )

        return (text, engine, quality_score)

    def _assess_image_quality(self, image: Image.Image) -> float:
        """
        Assess image quality using multiple metrics.

        Factors:
        - Resolution (DPI)
        - Contrast ratio
        - Noise level
        - Sharpness (Laplacian variance)

        Returns:
            Quality score 0.0-1.0 (higher is better)
        """
        # Convert to numpy array for OpenCV processing
        img_array = np.array(image.convert('L'))  # Grayscale

        # 1. Resolution check (normalized to 300 DPI standard)
        dpi = image.info.get('dpi', (72, 72))[0]
        resolution_score = min(dpi / 300.0, 1.0)

        # 2. Contrast ratio (standard deviation of pixel intensities)
        contrast = img_array.std() / 128.0  # Normalize to 0-1
        contrast_score = min(contrast, 1.0)

        # 3. Noise level (using local variance)
        noise_score = self._calculate_noise_score(img_array)

        # 4. Sharpness (Laplacian variance)
        laplacian_var = cv2.Laplacian(img_array, cv2.CV_64F).var()
        sharpness_score = min(laplacian_var / 1000.0, 1.0)

        # Weighted average (contrast and sharpness most important)
        quality = (
            0.2 * resolution_score +
            0.35 * contrast_score +
            0.15 * noise_score +
            0.30 * sharpness_score
        )

        return min(quality, 1.0)

    def _calculate_noise_score(self, img_array: np.ndarray) -> float:
        """Calculate noise score (lower noise = higher score)"""
        # Use median filter to estimate noise
        median = cv2.medianBlur(img_array, 5)
        noise = np.abs(img_array.astype(float) - median.astype(float)).mean()

        # Invert and normalize (less noise = higher score)
        noise_score = 1.0 - min(noise / 50.0, 1.0)
        return noise_score

    def _tesseract_ocr(self, image: Image.Image) -> str:
        """
        Enhanced Tesseract OCR with pre-processing.

        Pre-processing steps:
        1. Convert to grayscale
        2. Increase contrast
        3. Denoise
        4. Sharpen
        5. Threshold/binarize
        """
        # Convert to grayscale
        gray = image.convert('L')

        # Enhance contrast
        enhancer = ImageEnhance.Contrast(gray)
        contrast = enhancer.enhance(1.5)

        # Denoise
        denoised = contrast.filter(ImageFilter.MedianFilter(size=3))

        # Sharpen
        sharpener = ImageEnhance.Sharpness(denoised)
        sharp = sharpener.enhance(2.0)

        # OCR with Tesseract
        text = pytesseract.image_to_string(sharp, config='--psm 6')

        return text.strip()

    async def _claude_vision_ocr(
        self,
        image_bytes: bytes,
        doc_type: Optional[str] = None
    ) -> str:
        """
        Claude Vision API for complex/poor-quality documents.

        Handles:
        - Handwritten forms
        - Low-quality scans
        - Complex table structures
        - Multi-column layouts
        """
        if not self.claude_api_key:
            raise ValueError("Claude API key not configured")

        import anthropic
        import base64

        # Encode image to base64
        image_b64 = base64.standard_b64encode(image_bytes).decode('utf-8')

        # Build prompt based on document type
        if doc_type == "W2":
            prompt = """Extract all text from this W-2 tax form.
            Focus on: employer name, employee info, wages, taxes withheld.
            Preserve the structure and numeric values exactly."""
        elif doc_type == "1099":
            prompt = """Extract all text from this 1099 form.
            Focus on: payer info, recipient info, income amounts, tax withheld.
            Preserve numeric values exactly."""
        elif doc_type == "bank_statement":
            prompt = """Extract all text from this bank statement.
            Focus on: account info, transactions (date, description, amount).
            Preserve transaction table structure."""
        else:
            prompt = """Extract all text from this financial document.
            Preserve structure, formatting, and numeric values exactly."""

        # Call Claude Vision API
        client = anthropic.Anthropic(api_key=self.claude_api_key)

        try:
            response = client.messages.create(
                model="claude-3-5-sonnet-20241022",  # Latest vision model
                max_tokens=4096,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": image_b64
                                }
                            },
                            {
                                "type": "text",
                                "text": prompt
                            }
                        ]
                    }
                ]
            )

            text = response.content[0].text
            return text.strip()

        except Exception as e:
            logger.error(f"Claude Vision OCR failed: {e}", exc_info=True)
            # Fallback to Tesseract on API error
            logger.warning("Falling back to Tesseract after Claude API error")
            return self._tesseract_ocr(Image.open(io.BytesIO(image_bytes)))

    def get_stats(self) -> dict:
        """
        Get OCR usage statistics.

        Returns:
            Dict with cost breakdown and volume metrics
        """
        total_requests = self.tesseract_count + self.claude_count

        if total_requests == 0:
            tesseract_pct = 0.0
            claude_pct = 0.0
        else:
            tesseract_pct = (self.tesseract_count / total_requests) * 100
            claude_pct = (self.claude_count / total_requests) * 100

        # Cost estimate (Claude Vision ~$0.025 per image)
        estimated_cost = self.claude_count * 0.025

        return {
            "total_requests": total_requests,
            "tesseract_count": self.tesseract_count,
            "tesseract_percentage": f"{tesseract_pct:.1f}%",
            "claude_count": self.claude_count,
            "claude_percentage": f"{claude_pct:.1f}%",
            "estimated_monthly_cost_usd": f"${estimated_cost:.2f}",
            "fallback_enabled": self.fallback_enabled
        }


# Global instance
_hybrid_ocr = None


def get_hybrid_ocr() -> HybridOCRService:
    """Get or create global hybrid OCR instance"""
    global _hybrid_ocr
    if _hybrid_ocr is None:
        _hybrid_ocr = HybridOCRService()
    return _hybrid_ocr
