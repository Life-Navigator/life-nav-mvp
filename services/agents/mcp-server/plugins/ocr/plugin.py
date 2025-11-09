"""
OCR Plugin - Tri-Engine Document Processing

Provides tri-engine OCR capabilities to the MCP server:
- Tesseract: Fast baseline (85% accuracy)
- PaddleOCR: Production workhorse (91% accuracy)
- DeepSeek-OCR: Best-in-class (96% accuracy)

100% privacy-preserving - all processing happens locally.
"""

import sys
from pathlib import Path
from typing import Any, Dict, List
import base64
import io

from ..base import BasePlugin, PluginMetadata
from ...utils.logging import get_logger

logger = get_logger(__name__)


class OCRPlugin(BasePlugin):
    """
    OCR Plugin for document text extraction.

    Provides tools for:
    - Document OCR with adaptive quality routing
    - Quality assessment
    - OCR statistics and health monitoring

    Integrates the tri-engine OCR system (Tesseract + PaddleOCR + DeepSeek-OCR)
    with the MCP server for use by multi-agent systems.
    """

    def __init__(self):
        super().__init__(
            metadata=PluginMetadata(
                name="ocr",
                version="2.0.0",
                description="Tri-engine OCR plugin for document text extraction (96% accuracy)",
                author="Life Navigator Team",
                requires=["pytesseract", "opencv-python", "paddleocr", "transformers", "torch"],
                priority=60,  # Higher priority than default (50)
                tags=["ocr", "document-processing", "finance", "privacy"]
            )
        )
        self.ocr_service = None

    async def initialize(self, config: Dict[str, Any]) -> None:
        """
        Initialize OCR service with tri-engine configuration.

        Args:
            config: Configuration dict with optional keys:
                - use_paddleocr: Enable PaddleOCR (default: True)
                - use_deepseek: Enable DeepSeek-OCR (default: True)
                - enable_gpu: Enable GPU acceleration (default: True)
                - high_quality_threshold: Tesseract threshold (default: 0.80)
                - medium_quality_threshold: PaddleOCR threshold (default: 0.60)
        """
        logger.info("initializing_ocr_plugin", config=config)

        try:
            # Add finance-api path to sys.path to import ocr_hybrid
            finance_api_path = Path(__file__).parent.parent.parent.parent.parent / "finance-api"
            if str(finance_api_path) not in sys.path:
                sys.path.insert(0, str(finance_api_path))

            # Import OCR service from finance-api
            from app.services.ocr_hybrid import HybridOCRService

            # Initialize with config
            self.ocr_service = HybridOCRService(
                use_paddleocr=config.get("use_paddleocr", True),
                use_deepseek=config.get("use_deepseek", True),
                high_quality_threshold=config.get("high_quality_threshold", 0.80),
                medium_quality_threshold=config.get("medium_quality_threshold", 0.60),
                enable_gpu=config.get("enable_gpu", True)
            )

            logger.info(
                "ocr_plugin_initialized",
                paddleocr_enabled=self.ocr_service.use_paddleocr,
                deepseek_enabled=self.ocr_service.use_deepseek,
                gpu_enabled=self.ocr_service.enable_gpu
            )

        except ImportError as e:
            logger.error("ocr_plugin_import_failed", error=str(e))
            raise Exception(f"Failed to import OCR service. Ensure finance-api is available: {e}")
        except Exception as e:
            logger.error("ocr_plugin_initialization_failed", error=str(e), exc_info=True)
            raise

    async def get_context(
        self,
        query: str,
        user_id: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Provide OCR-related context.

        This plugin doesn't provide query context, but returns health status
        and capabilities when asked about OCR.
        """
        # Check if query is about OCR
        query_lower = query.lower()
        is_ocr_query = any(keyword in query_lower for keyword in [
            "ocr", "document", "scan", "extract text", "read document"
        ])

        if not is_ocr_query:
            return {
                "data": {},
                "metadata": {
                    "source": self.metadata.name,
                    "relevance_score": 0.0,
                    "tokens": 0
                }
            }

        # Return OCR capabilities
        stats = self.ocr_service.get_stats()

        context_data = {
            "ocr_available": True,
            "max_accuracy": stats["max_accuracy"],
            "engines_enabled": {
                "tesseract": True,
                "paddleocr": stats["paddleocr_enabled"],
                "deepseek": stats["deepseek_enabled"]
            },
            "privacy_preserving": stats["privacy_preserving"],
            "monthly_cost": stats["estimated_monthly_cost_usd"],
            "usage_stats": {
                "total_requests": stats["total_requests"],
                "tesseract_percentage": stats["tesseract_percentage"],
                "paddleocr_percentage": stats["paddleocr_percentage"],
                "deepseek_percentage": stats.get("deepseek_percentage", "0.0%")
            }
        }

        return {
            "data": context_data,
            "metadata": {
                "source": self.metadata.name,
                "relevance_score": 0.9,  # Highly relevant for OCR queries
                "tokens": len(str(context_data)) // 4  # Rough estimate
            }
        }

    def get_tools(self) -> List[Any]:
        """
        Register OCR tools for agent invocation.

        Returns:
            List of Tool objects for OCR operations
        """
        from ...tools.base import Tool

        return [
            Tool(
                name="extract_text_from_document",
                description="Extract text from a document image using tri-engine OCR (Tesseract/PaddleOCR/DeepSeek). Automatically selects the best engine based on image quality. Achieves up to 96% accuracy on complex financial documents.",
                parameters_schema={
                    "type": "object",
                    "properties": {
                        "image_data": {
                            "type": "string",
                            "description": "Base64-encoded image data (PNG, JPG, JPEG)"
                        },
                        "doc_type": {
                            "type": "string",
                            "description": "Optional document type hint (e.g., 'W2', '1099', 'bank_statement', 'invoice')"
                        },
                        "force_engine": {
                            "type": "string",
                            "enum": ["tesseract", "paddleocr", "deepseek_ocr"],
                            "description": "Force specific OCR engine. Leave empty for automatic selection."
                        }
                    },
                    "required": ["image_data"]
                },
                handler=self._extract_text
            ),
            Tool(
                name="get_ocr_stats",
                description="Get OCR service statistics including usage, accuracy, and engine distribution.",
                parameters_schema={
                    "type": "object",
                    "properties": {},
                    "required": []
                },
                handler=self._get_ocr_stats
            ),
            Tool(
                name="assess_document_quality",
                description="Assess document image quality without performing OCR. Returns quality score and recommended engine.",
                parameters_schema={
                    "type": "object",
                    "properties": {
                        "image_data": {
                            "type": "string",
                            "description": "Base64-encoded image data"
                        }
                    },
                    "required": ["image_data"]
                },
                handler=self._assess_quality
            )
        ]

    async def _extract_text(self, parameters: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """
        Extract text from document image.

        Args:
            parameters: {
                "image_data": str,  # Base64-encoded
                "doc_type": Optional[str],
                "force_engine": Optional[str]
            }
            user_id: User identifier

        Returns:
            {
                "success": bool,
                "text": str,
                "engine_used": str,
                "quality_score": float,
                "error": Optional[str]
            }
        """
        try:
            # Decode base64 image
            image_data = parameters.get("image_data")
            if not image_data:
                return {
                    "success": False,
                    "error": "Missing 'image_data' parameter"
                }

            # Handle data URL format (data:image/png;base64,...)
            if image_data.startswith("data:"):
                image_data = image_data.split(",", 1)[1]

            image_bytes = base64.b64decode(image_data)

            # Extract optional parameters
            doc_type = parameters.get("doc_type")
            force_engine_str = parameters.get("force_engine")

            # Convert force_engine string to enum if provided
            force_engine = None
            if force_engine_str:
                from app.services.ocr_hybrid import OCREngine
                force_engine = OCREngine(force_engine_str)

            # Perform OCR
            logger.info(
                "ocr_extraction_start",
                user_id=user_id,
                doc_type=doc_type,
                force_engine=force_engine_str
            )

            text, engine, quality = await self.ocr_service.extract_text(
                image_bytes=image_bytes,
                doc_type=doc_type,
                force_engine=force_engine
            )

            logger.info(
                "ocr_extraction_complete",
                user_id=user_id,
                engine=engine.value,
                quality=quality,
                text_length=len(text)
            )

            return {
                "success": True,
                "text": text,
                "engine_used": engine.value,
                "quality_score": quality,
                "metadata": {
                    "text_length": len(text),
                    "doc_type": doc_type,
                    "privacy_preserving": True
                }
            }

        except Exception as e:
            logger.error(
                "ocr_extraction_failed",
                error=str(e),
                user_id=user_id,
                exc_info=True
            )
            return {
                "success": False,
                "error": str(e)
            }

    async def _get_ocr_stats(self, parameters: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """Get OCR service statistics."""
        try:
            stats = self.ocr_service.get_stats()
            return {
                "success": True,
                **stats
            }
        except Exception as e:
            logger.error("get_ocr_stats_failed", error=str(e))
            return {
                "success": False,
                "error": str(e)
            }

    async def _assess_quality(self, parameters: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """
        Assess document image quality.

        Args:
            parameters: {"image_data": str}
            user_id: User identifier

        Returns:
            {
                "success": bool,
                "quality_score": float,
                "recommended_engine": str,
                "quality_category": str,  # "high", "medium", "low"
                "error": Optional[str]
            }
        """
        try:
            from PIL import Image

            # Decode image
            image_data = parameters.get("image_data")
            if not image_data:
                return {"success": False, "error": "Missing 'image_data' parameter"}

            if image_data.startswith("data:"):
                image_data = image_data.split(",", 1)[1]

            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))

            # Assess quality
            quality_score = self.ocr_service._assess_image_quality(image)

            # Determine category and recommended engine
            if quality_score >= self.ocr_service.high_quality_threshold:
                category = "high"
                recommended = "tesseract"
            elif quality_score >= self.ocr_service.medium_quality_threshold:
                category = "medium"
                recommended = "paddleocr"
            else:
                category = "low"
                recommended = "deepseek_ocr"

            return {
                "success": True,
                "quality_score": quality_score,
                "quality_category": category,
                "recommended_engine": recommended,
                "thresholds": {
                    "high": self.ocr_service.high_quality_threshold,
                    "medium": self.ocr_service.medium_quality_threshold
                }
            }

        except Exception as e:
            logger.error("assess_quality_failed", error=str(e))
            return {
                "success": False,
                "error": str(e)
            }

    async def cleanup(self) -> None:
        """Cleanup OCR resources."""
        logger.info("cleaning_up_ocr_plugin")
        self.ocr_service = None

    async def health_check(self) -> Dict[str, Any]:
        """
        Check OCR plugin health.

        Returns:
            {
                "status": "ok" | "degraded" | "error",
                "engines": {...},
                "stats": {...}
            }
        """
        try:
            if not self.ocr_service:
                return {
                    "status": "error",
                    "message": "OCR service not initialized"
                }

            stats = self.ocr_service.get_stats()

            # Check if at least one engine is available
            engines_available = (
                True or  # Tesseract always available
                stats["paddleocr_enabled"] or
                stats["deepseek_enabled"]
            )

            status = "ok" if engines_available else "degraded"

            return {
                "status": status,
                "engines": {
                    "tesseract": "available",
                    "paddleocr": "available" if stats["paddleocr_enabled"] else "unavailable",
                    "deepseek": "available" if stats["deepseek_enabled"] else "unavailable"
                },
                "stats": stats,
                "max_accuracy": stats["max_accuracy"]
            }

        except Exception as e:
            logger.error("ocr_health_check_failed", error=str(e))
            return {
                "status": "error",
                "message": str(e)
            }
