# OCR & Document Processing Integration

## Overview

Life Navigator uses **Tesseract OCR** (via Pytesseract) for document text extraction and processing. This enables automatic data extraction from scanned documents, PDFs, and images uploaded by users.

## Technology Stack

### Core Libraries

1. **Pytesseract** - Python wrapper for Tesseract OCR
   - Extracts text from images and scanned documents
   - Supports 100+ languages
   - High accuracy for printed text

2. **PyPDF2** - PDF text extraction
   - Extracts text from digital PDFs
   - Handles text-based PDF documents

3. **pdfplumber** - Advanced PDF table extraction
   - Extracts tables from PDFs
   - Better handling of complex layouts
   - Provides table structure preservation

4. **python-docx** - Word document processing
   - Reads .docx files
   - Extracts text and tables
   - Preserves document structure

5. **Pandas** - CSV and data processing
   - Handles CSV transaction imports
   - Auto-detects formats (Chase, BofA, Mint, etc.)
   - Data transformation and cleaning

## Document Types Supported

### Financial Documents

#### 1. Tax Returns (Form 1040, W-2, 1099)
- **Location**: `services/finance-api/app/services/document_parser.py`
- **Method**: `parse_tax_return()`
- **Features**:
  - Extracts AGI, filing status, income sources
  - Parses Schedule 1 (additional income)
  - Parses Schedule A (itemized deductions)
  - Calculates refund/owed amounts
- **Supported Formats**: PDF, scanned images

#### 2. Bank Statements
- **Method**: `parse_bank_statement()`
- **Features**:
  - Extracts account information
  - Parses transaction tables
  - Auto-categorizes transactions
  - Identifies merchants
- **Supported Banks**: Chase, Bank of America, Wells Fargo, etc.

#### 3. Investment Statements
- **Method**: `parse_investment_statement()`
- **Features**:
  - Extracts account value
  - Parses holdings (symbol, shares, value)
  - Captures YTD performance
- **Supported Brokers**: Vanguard, Fidelity, etc.

#### 4. CSV Transactions
- **Method**: `parse_csv_transactions()`
- **Features**:
  - Auto-detects format (Chase, BofA, Mint, generic)
  - Maps columns automatically
  - Auto-categorizes transactions
  - Extracts merchant names
- **Formats**: Bank exports, Mint, YNAB, Personal Capital

### Healthcare Documents

#### Lab Reports, Medical Records
- **OCR Extraction**: Pytesseract for scanned documents
- **Data Mapping**:
  - Identifies SNOMED/ICD-10 codes
  - Extracts vital signs
  - Parses lab result values
  - Captures provider information

### Career Documents

#### Resumes, Certificates
- **PDF/DOCX parsing**: Extracts structured information
- **LLM Integration**: Uses Maverick for entity extraction
  - Job titles and companies
  - Skills and technologies
  - Education credentials
  - Dates and durations

## Document Processing Pipeline

### 1. Upload & Storage
```
User Upload → Cloud Storage (GCS) → Metadata to Database
```

### 2. OCR Processing
```
Document → Format Detection → OCR/Text Extraction → Pattern Matching
```

### 3. Data Extraction
```
Raw Text → Regex Patterns → Structured Data → Validation → Database
```

### 4. AI Enhancement (Optional)
```
Structured Data → Maverick LLM → Entity Extraction → Relationship Mapping
```

## Integration Points

### Finance API
- **Path**: `services/finance-api/app/services/document_parser.py`
- **Endpoints**:
  - `POST /api/v1/documents/upload` - Document upload
  - `POST /api/v1/documents/parse` - Parse specific document
  - `GET /api/v1/documents/{id}/data` - Retrieve extracted data

### Main API
- **Path**: `services/api/app/api/v1/endpoints/documents.py` (to be implemented)
- **Integration**: Calls Finance API for financial docs, uses direct OCR for others

### MCP Server (Agent Integration)
- **Path**: `services/agents/mcp-server/ingestion/`
- **Components**:
  - `extractors.py` - Entity extraction using Maverick
  - `parsers.py` - Document parsing
  - `pipeline.py` - Ingestion orchestration

## Pattern Matching Examples

### Tax Form 1040
```python
TAX_FORM_PATTERNS = {
    '1040': {
        'agi': r'adjusted gross income.*?\$?([\d,]+)',
        'wages': r'wages.*?box 1.*?\$?([\d,]+)',
        'taxable_income': r'taxable income.*?\$?([\d,]+)',
        # ... more patterns
    }
}
```

### Transaction Categorization
```python
CATEGORY_RULES = {
    'food': ['restaurant', 'grocery', 'uber eats', 'doordash'],
    'transportation': ['uber', 'lyft', 'gas', 'parking'],
    'healthcare': ['pharmacy', 'cvs', 'walgreens', 'doctor'],
    # ... more categories
}
```

## Demo User Upload Opportunities

John Doe's account has **intentional gaps** to demonstrate upload features:

### 1. Health Records (Ready to Upload)
- ❌ Recent lab reports (CBC, cholesterol panel)
- ❌ X-ray or imaging reports
- ❌ Prescription records from pharmacy
- ✅ Existing: Annual physical, blood work, vaccinations

### 2. Financial Documents (Ready to Connect)
- ❌ Recent bank statements (can upload PDF or connect via Plaid)
- ❌ Investment statements from Vanguard
- ❌ Tax returns (2023, 2024)
- ❌ Pay stubs
- ✅ Existing: Accounts, transactions, investments

### 3. Career Documents (Ready to Upload)
- ❌ Updated resume (PDF/DOCX)
- ❌ Performance reviews
- ❌ Offer letters
- ✅ Existing: Profile, 3 job experiences, 14 skills

### 4. Education Documents (Ready to Upload)
- ❌ Certificate PDFs (AWS, Kubernetes)
- ❌ Transcripts
- ❌ Course completion certificates
- ✅ Existing: Degree, 3 courses, 2 certifications

## How to Process a Document

### Example: Upload Bank Statement

```python
from app.services.document_parser import DocumentParserService

parser = DocumentParserService()

# Upload PDF
with open('statement.pdf', 'rb') as f:
    file_content = f.read()

# Parse
account, transactions = await parser.parse_bank_statement(
    file_content=file_content,
    file_type='pdf'
)

# Save to database
for transaction in transactions:
    db_transaction = Transaction(
        user_id=user.id,
        tenant_id=user.tenant_id,
        account_id=account.id,
        transaction_type=transaction.transaction_type,
        amount=transaction.amount,
        category=transaction.category,
        description=transaction.description,
        transaction_date=transaction.date,
        merchant=transaction.merchant
    )
    db.add(db_transaction)

await db.commit()
```

## OCR Accuracy Tips

### For Best Results:
1. **Resolution**: 300+ DPI for scanned documents
2. **Format**: Clear, high-contrast images
3. **Orientation**: Correct page orientation
4. **File Types**: PDF (preferred), PNG, JPG
5. **Quality**: Avoid blurry or low-quality scans

### Common Issues:
- **Handwriting**: Tesseract works best with printed text
- **Complex Layouts**: Use pdfplumber for tables
- **Multiple Columns**: May require preprocessing
- **Faded Text**: Increase contrast before OCR

## Future Enhancements

### Planned Features:
1. **Vision AI Integration**: Use Google Cloud Vision API for better accuracy
2. **Handwriting Recognition**: Support handwritten forms
3. **Document Classification**: Auto-detect document types
4. **Batch Processing**: Upload multiple documents at once
5. **Real-time Preview**: Show extracted data before saving
6. **Confidence Scores**: Show OCR confidence for each field
7. **Manual Correction**: Allow users to fix OCR errors
8. **Template Learning**: Improve accuracy over time for common docs

## Installation & Setup

### Install Tesseract OCR

#### macOS
```bash
brew install tesseract
```

#### Ubuntu/Debian
```bash
sudo apt-get install tesseract-ocr
sudo apt-get install libtesseract-dev
```

#### Windows
Download from: https://github.com/UB-Mannheim/tesseract/wiki

### Install Python Dependencies

```bash
# Finance API
cd services/finance-api
pip install pytesseract PyPDF2 pdfplumber python-docx Pillow pandas

# Or via requirements.txt
pip install -r requirements.txt
```

## Testing OCR

### Test Script
```python
# test_ocr.py
import pytesseract
from PIL import Image

# Test basic OCR
image = Image.open('test_document.png')
text = pytesseract.image_to_string(image)
print(text)

# Test with specific language
text = pytesseract.image_to_string(image, lang='eng')
print(text)

# Get detailed information
data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
print(data)
```

## Security Considerations

1. **PII Protection**: All documents contain sensitive data
2. **Encryption**: Encrypt documents at rest and in transit
3. **Access Control**: Role-based access to documents
4. **Audit Logging**: Log all document access
5. **Retention Policy**: Auto-delete after processing (optional)
6. **Compliance**: HIPAA for health records, PCI-DSS for financial

## Performance Metrics

- **Processing Time**: 2-5 seconds per page (PDF)
- **OCR Time**: 5-10 seconds per image page
- **Accuracy**: 95%+ for printed text
- **Throughput**: 100+ documents/hour

## Support & Troubleshooting

### Common Errors

1. **"tesseract not found"**
   - Install Tesseract OCR system package
   - Add to PATH

2. **Low accuracy**
   - Check image quality/resolution
   - Try preprocessing (grayscale, contrast)
   - Use pdfplumber for tables

3. **Memory errors**
   - Process large PDFs page-by-page
   - Reduce image resolution

---

**Last Updated**: 2025-11-07
**Maintained By**: Life Navigator Engineering Team
