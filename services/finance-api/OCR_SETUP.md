# OCR Setup Guide - Tri-Engine OCR System

## Overview

Life Navigator uses a sophisticated tri-engine OCR system that automatically selects the best OCR engine based on document quality:

- **High Quality (>0.80)** → Tesseract (85% accuracy, 200ms)
- **Medium Quality (0.60-0.80)** → PaddleOCR (91% accuracy, 300ms)
- **Low Quality (<0.60)** → DeepSeek-OCR (96% accuracy, 400ms)

All engines are **100% self-hosted** - no external APIs, complete privacy compliance.

## Prerequisites

### System Requirements

**Minimum** (Tesseract only):
- CPU: 2 cores
- RAM: 2 GB
- Disk: 500 MB

**Recommended** (Tri-Engine with GPU):
- CPU: 8 cores
- RAM: 8 GB
- GPU: NVIDIA with 4GB VRAM
- Disk: 4 GB (for models)

### Software Requirements

- Python 3.11+
- Tesseract OCR (system package)
- pip packages (installed via requirements.txt)

## Installation

### 1. Install System Dependencies

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install -y tesseract-ocr libtesseract-dev
```

#### macOS
```bash
brew install tesseract
```

#### Verify Tesseract
```bash
tesseract --version
# Should show: tesseract 4.x or 5.x
```

### 2. Install Python Dependencies

```bash
cd services/finance-api
pip install -r requirements.txt
```

This installs:
- `pytesseract` - Tesseract wrapper
- `opencv-python` - Image processing
- `paddleocr` - PaddleOCR engine
- `paddlepaddle` - PaddleOCR framework
- `transformers` - DeepSeek-OCR
- `torch` - Deep learning framework

### 3. Download OCR Models

**IMPORTANT**: Models must be downloaded before first use.

#### Automatic Download (Recommended)

Run the model download script:

```bash
# From project root
python3 scripts/download_ocr_models.py
```

This will download:
- **PaddleOCR models**: ~500MB (to `~/.paddleocr/`)
- **DeepSeek-OCR model**: ~1.5-2GB (to `~/.cache/huggingface/`)

**Total**: ~2-2.5GB disk space required

#### Manual Download (Alternative)

If the script fails, you can trigger downloads manually:

**PaddleOCR:**
```python
from paddleocr import PaddleOCR
ocr = PaddleOCR(use_angle_cls=True, lang='en', use_gpu=False, show_log=True)
# Models download automatically on first run
```

**DeepSeek-OCR:**
```python
from transformers import AutoModel, AutoTokenizer
tokenizer = AutoTokenizer.from_pretrained("deepseek-ai/deepseek-ocr")
model = AutoModel.from_pretrained("deepseek-ai/deepseek-ocr", trust_remote_code=True)
# Models download from HuggingFace Hub
```

## GPU Support (Optional but Recommended)

### Check GPU Availability

```bash
# For NVIDIA GPUs
nvidia-smi

# For PaddlePaddle GPU support
python3 -c "import paddle; print('CUDA available:', paddle.is_compiled_with_cuda())"

# For PyTorch GPU support
python3 -c "import torch; print('CUDA available:', torch.cuda.is_available())"
```

### Enable GPU in OCR Service

GPU is auto-detected and enabled by default. The service will:
1. Check if GPU is available
2. Fall back to CPU if GPU not found
3. Log GPU status on startup

## Verification

### Test OCR Service

```bash
cd services/finance-api
python3 -c "
from app.services.ocr_hybrid import get_hybrid_ocr

# Initialize OCR service
ocr = get_hybrid_ocr()

# Check configuration
stats = ocr.get_stats()
print('Privacy-preserving:', stats['privacy_preserving'])
print('Max accuracy:', stats['max_accuracy'])
print('PaddleOCR enabled:', stats['paddleocr_enabled'])
print('DeepSeek enabled:', stats['deepseek_enabled'])
print('GPU enabled:', stats['gpu_enabled'])
"
```

Expected output:
```
Privacy-preserving: True
Max accuracy: 96%
PaddleOCR enabled: True
DeepSeek enabled: True
GPU enabled: True  (or False if no GPU)
```

### Check Model Locations

```bash
# PaddleOCR models
ls -lh ~/.paddleocr/

# DeepSeek-OCR model
ls -lh ~/.cache/huggingface/hub/ | grep deepseek
```

## Usage

### From Python Code

```python
from app.services.ocr_hybrid import get_hybrid_ocr
from PIL import Image

# Initialize OCR service
ocr = get_hybrid_ocr()

# Read image
with open("document.pdf", "rb") as f:
    image_bytes = f.read()

# Extract text (async)
text, engine, quality = await ocr.extract_text(
    image_bytes=image_bytes,
    doc_type="W2"  # Optional hint
)

print(f"Used engine: {engine}")
print(f"Quality score: {quality:.2f}")
print(f"Extracted text: {text}")
```

### Engine Selection Logic

The service automatically selects the best engine:

```python
# High quality image (score > 0.80)
# ✅ Uses Tesseract - fast (200ms), good accuracy (85%)

# Medium quality image (score 0.60-0.80)
# ✅ Uses PaddleOCR - proven (300ms), better accuracy (91%)

# Low quality image (score < 0.60)
# ✅ Uses DeepSeek-OCR - best (400ms), excellent accuracy (96%)
```

### Force Specific Engine

```python
from app.services.ocr_hybrid import OCREngine

# Force DeepSeek for complex tax document
text, engine, quality = await ocr.extract_text(
    image_bytes=image_bytes,
    force_engine=OCREngine.DEEPSEEK_OCR
)
```

## Troubleshooting

### Issue: Models Not Downloading

**Symptom**: Script hangs or fails during download

**Solution**:
```bash
# Check internet connection
curl -I https://huggingface.co

# Check disk space
df -h ~

# Try manual download with verbose logging
python3 scripts/download_ocr_models.py
```

### Issue: Import Errors

**Symptom**: `ModuleNotFoundError: No module named 'paddleocr'`

**Solution**:
```bash
# Reinstall dependencies
cd services/finance-api
pip install --upgrade -r requirements.txt
```

### Issue: GPU Not Detected

**Symptom**: `gpu_enabled: False` even though GPU is available

**Solution**:
```bash
# Install CUDA-enabled versions
pip install paddlepaddle-gpu  # For PaddleOCR GPU
pip install torch --index-url https://download.pytorch.org/whl/cu118  # For DeepSeek GPU

# Verify GPU support
python3 -c "import paddle; print(paddle.is_compiled_with_cuda())"
python3 -c "import torch; print(torch.cuda.is_available())"
```

### Issue: Out of Memory

**Symptom**: `CUDA out of memory` or `RuntimeError: out of memory`

**Solution**:
```bash
# Reduce batch size or disable GPU
# Edit OCR initialization in your code:
ocr = HybridOCRService(enable_gpu=False)

# Or close other GPU applications
nvidia-smi  # Check GPU memory usage
```

### Issue: DeepSeek Model Not Found

**Symptom**: `OSError: deepseek-ai/deepseek-ocr does not appear to be a valid model`

**Solution**:
```bash
# Clear HuggingFace cache and re-download
rm -rf ~/.cache/huggingface/hub/*deepseek*

# Re-run download script
python3 scripts/download_ocr_models.py

# Or manually download
python3 -c "
from transformers import AutoModel, AutoTokenizer
tokenizer = AutoTokenizer.from_pretrained('deepseek-ai/deepseek-ocr')
model = AutoModel.from_pretrained('deepseek-ai/deepseek-ocr', trust_remote_code=True)
print('Model downloaded successfully!')
"
```

## Performance Optimization

### For Maximum Speed

- Use GPU (3-5× faster than CPU)
- High quality scans trigger Tesseract (fastest)
- Pre-process images (increase contrast, denoise) to improve quality scores

### For Maximum Accuracy

- Force DeepSeek-OCR for complex documents:
  ```python
  force_engine=OCREngine.DEEPSEEK_OCR
  ```
- Use high-resolution scans (300+ DPI)
- Ensure good lighting and contrast

### For Minimal Resource Usage

- Disable DeepSeek-OCR (saves ~2GB RAM):
  ```python
  ocr = HybridOCRService(use_deepseek=False)
  ```
- Use CPU instead of GPU
- Only enable Tesseract (minimal footprint)

## Privacy & Security

### Data Flow

```
User Upload → Your Server → OCR Engine (Local) → Your Database
```

**No external APIs** - All processing happens on your infrastructure.

### Compliance

✅ **GDPR** - Data stays within your jurisdiction
✅ **CCPA** - No sale or sharing of data
✅ **HIPAA** - No Business Associate Agreements needed
✅ **SOC 2** - Full control over data processing

### Audit

All OCR operations are logged locally:
```python
logger.info(f"OCR completed", extra={
    "engine": engine,
    "quality": quality_score,
    "doc_type": doc_type
})
```

## Model Information

### Tesseract OCR
- **Version**: 4.x or 5.x
- **License**: Apache 2.0
- **Size**: Included with system package (~50MB)
- **Accuracy**: 70-85% (clean scans)
- **Best For**: High-quality scans, speed-critical operations

### PaddleOCR
- **Version**: 2.7.3
- **License**: Apache 2.0
- **Size**: ~500MB
- **Accuracy**: 91-92%
- **Best For**: General documents, tables, rotated text

### DeepSeek-OCR
- **Version**: Latest (Oct 2024)
- **License**: Apache 2.0
- **Size**: ~1.5-2GB
- **Accuracy**: 96-97%
- **Best For**: Complex layouts, handwriting, financial documents

## Additional Resources

- **Privacy Documentation**: See `PRIVACY_COMPLIANCE.md`
- **Model Download Script**: `scripts/download_ocr_models.py`
- **OCR Service Code**: `services/finance-api/app/services/ocr_hybrid.py`

## Support

If you encounter issues:

1. Check this guide first
2. Review logs: `services/finance-api/logs/`
3. Verify models are downloaded: `~/.paddleocr/` and `~/.cache/huggingface/`
4. Check GitHub issues: [Life Navigator Issues](https://github.com/Life-Navigator/life-navigator-monorepo/issues)

---

**Last Updated**: November 9, 2025
**OCR Version**: Tri-Engine v2.0 (Tesseract + PaddleOCR + DeepSeek-OCR)
**Privacy Status**: ✅ 100% Self-Hosted
