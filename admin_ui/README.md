# Life Navigator Admin UI

Beautiful admin interface for uploading and managing documents in the Life Navigator GraphRAG system.

## Features

- **Beautiful Modern UI**: Clean, professional interface built with Reflex
- **Drag & Drop Upload**: Easy file uploads with drag-and-drop support
- **Multiple File Formats**: Support for TXT, MD, PDF, DOCX, HTML, CSV, JSON
- **Real-Time Progress**: Live progress tracking for ingestion jobs
- **Dual Mode**:
  - **Centralized Knowledge**: Shared knowledge base (no RLS)
  - **User-Specific**: Per-user document vaults with row-level security
- **Job Management**: View active jobs and ingestion history
- **Statistics Dashboard**: Track documents, entities, and concepts

## Supported File Types

- **Text**: `.txt`, `.md`
- **Documents**: `.pdf`, `.docx`, `.doc`
- **Web**: `.html`, `.htm`
- **Data**: `.csv`, `.json`

## Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Or using the run script (handles installation automatically)
./run_admin.sh
```

## Usage

### Start the Admin UI

```bash
./run_admin.sh
```

The admin interface will be available at **http://localhost:3000**

### Upload Documents

1. **Select Upload Type**:
   - Toggle "Centralized" for shared knowledge base
   - Keep off for user-specific documents (RLS enabled)

2. **Choose Files**:
   - Click "Select Files" or drag & drop
   - Multiple files supported

3. **Process**:
   - Click "Process Uploads"
   - Watch real-time progress

4. **Monitor**:
   - Track active jobs in real-time
   - View completion status
   - Check extraction statistics

## Pipeline Process

When you upload a document, it goes through:

1. **Parsing**: Extract text and metadata from file
2. **Entity Extraction**: Identify people, organizations, locations, concepts using Maverick LLM
3. **Concept Extraction**: Extract high-level themes and topics
4. **Embedding Generation**: Create vector embeddings (using local sentence-transformers or API)
5. **Graph Loading**: Store entities and relationships in Neo4j
6. **Vector Loading**: Store embeddings in Qdrant

## Architecture

```
Document Upload
     ↓
[Parser Factory]
     ↓
[Entity Extractor] ← Maverick LLM
     ↓
[Embedding Generator] ← sentence-transformers / API
     ↓
[Pipeline Processor]
     ├→ Neo4j (Knowledge Graph)
     └→ Qdrant (Vector Store)
```

## Configuration

### User ID
For user-specific uploads, enter the User ID. This ensures:
- Row-level security in Neo4j
- User-specific collections in Qdrant
- Isolated data access

### Centralized Mode
Enable centralized mode for:
- Shared knowledge base
- Company-wide documentation
- Public information

## Development

### File Structure

```
admin_ui/
├── admin_app.py          # Main Reflex application
├── requirements.txt      # Python dependencies
├── run_admin.sh         # Run script
└── README.md            # This file
```

### Customization

Edit `admin_app.py` to customize:
- UI theme and colors
- Upload limits
- File type restrictions
- Statistics displayed

## Integration

The admin UI integrates with:

- **MCP Server**: Document ingestion pipeline
- **Neo4j**: Knowledge graph storage
- **Qdrant**: Vector database
- **Maverick LLM**: Entity and concept extraction

## Troubleshooting

### Port Already in Use

If port 3000 is busy:
```bash
reflex run --port 3001
```

### Missing Dependencies

```bash
pip install reflex httpx sentence-transformers
```

### Upload Directory

Uploads are saved to `./uploads/` directory. Create it if needed:
```bash
mkdir -p uploads
```

## Security Notes

- **Row-Level Security**: User-specific uploads are isolated
- **File Validation**: Only allowed file types accepted
- **Size Limits**: Configure in `admin_app.py`
- **Access Control**: Add authentication as needed

## Next Steps

1. **Add Authentication**: Integrate user login
2. **Batch Processing**: Upload multiple files at once
3. **Advanced Filters**: Filter documents by type, date, user
4. **Export**: Export knowledge graph data
5. **Analytics**: Advanced statistics and visualizations

## Support

For issues or questions:
- Check the main project README
- Review MCP server documentation
- Check Reflex docs: https://reflex.dev
