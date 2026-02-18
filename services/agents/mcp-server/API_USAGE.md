# MCP Server API - Ingestion Endpoints

Complete REST API for the Life Navigator data ingestion pipeline.

## Base URL

```
http://localhost:8000
```

## Endpoints

### 1. Upload Document

Upload and ingest a document into the knowledge graph and vector store.

**Endpoint:** `POST /ingest/upload`

**Content-Type:** `multipart/form-data`

**Parameters:**
- `file` (file, required): Document file to upload
- `user_id` (string, required): User ID for row-level security
- `is_centralized` (boolean, optional): If true, adds to centralized knowledge base (default: false)

**Supported Formats:**
- Text: `.txt`, `.md`
- Documents: `.pdf`, `.docx`, `.doc`
- Web: `.html`, `.htm`
- Data: `.csv`, `.json`

**Response:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "file_name": "document.pdf",
  "file_size": 1024000,
  "status": "pending",
  "message": "Document upload successful. Ingestion job 550e8400... created."
}
```

**Example (curl):**
```bash
curl -X POST "http://localhost:8000/ingest/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/document.pdf" \
  -F "user_id=user123" \
  -F "is_centralized=false"
```

**Example (Python):**
```python
import requests

url = "http://localhost:8000/ingest/upload"

files = {"file": open("document.pdf", "rb")}
data = {
    "user_id": "user123",
    "is_centralized": False
}

response = requests.post(url, files=files, data=data)
job = response.json()
print(f"Job ID: {job['job_id']}")
```

---

### 2. Get Job Status

Get the status and progress of an ingestion job.

**Endpoint:** `GET /ingest/jobs/{job_id}`

**Parameters:**
- `job_id` (path, required): Job ID returned from upload

**Response:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "progress": 50.0,
  "total_steps": 6,
  "completed_steps": 3,
  "errors": [],
  "started_at": "2024-01-15T10:30:00",
  "completed_at": null,
  "result": null
}
```

**Status Values:**
- `pending`: Job created, not yet started
- `processing`: Job in progress
- `completed`: Job completed successfully
- `failed`: Job failed with errors

**Progress Steps:**
1. Parse document
2. Extract entities
3. Extract concepts
4. Generate embeddings
5. Load into Neo4j
6. Load into Qdrant

**Example (curl):**
```bash
curl "http://localhost:8000/ingest/jobs/550e8400-e29b-41d4-a716-446655440000"
```

**Example (Python):**
```python
import requests
import time

job_id = "550e8400-e29b-41d4-a716-446655440000"
url = f"http://localhost:8000/ingest/jobs/{job_id}"

while True:
    response = requests.get(url)
    job = response.json()

    print(f"Status: {job['status']}, Progress: {job['progress']}%")

    if job['status'] in ['completed', 'failed']:
        break

    time.sleep(2)

if job['status'] == 'completed':
    print(f"Entities: {job['result']['entities']}")
    print(f"Concepts: {job['result']['concepts']}")
```

---

### 3. List Jobs

List all ingestion jobs with pagination and filtering.

**Endpoint:** `GET /ingest/jobs`

**Query Parameters:**
- `page` (integer, optional): Page number (default: 1)
- `page_size` (integer, optional): Items per page (default: 20)
- `status_filter` (string, optional): Filter by status (pending, processing, completed, failed)

**Response:**
```json
{
  "jobs": [
    {
      "job_id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "completed",
      "progress": 100.0,
      "total_steps": 6,
      "completed_steps": 6,
      "errors": [],
      "started_at": "2024-01-15T10:30:00",
      "completed_at": "2024-01-15T10:31:30",
      "result": {
        "doc_id": "doc_123",
        "entities": 25,
        "relationships": 15,
        "concepts": 8,
        "chunks": 50
      }
    }
  ],
  "total": 100,
  "page": 1,
  "page_size": 20
}
```

**Example (curl):**
```bash
# List first page
curl "http://localhost:8000/ingest/jobs?page=1&page_size=20"

# Filter by completed jobs
curl "http://localhost:8000/ingest/jobs?status_filter=completed"
```

**Example (Python):**
```python
import requests

url = "http://localhost:8000/ingest/jobs"
params = {
    "page": 1,
    "page_size": 20,
    "status_filter": "completed"
}

response = requests.get(url, params=params)
data = response.json()

print(f"Total jobs: {data['total']}")
for job in data['jobs']:
    print(f"Job {job['job_id']}: {job['status']}")
```

---

### 4. Get Ingestion Statistics

Get aggregate statistics for the ingestion system.

**Endpoint:** `GET /ingest/stats`

**Response:**
```json
{
  "total_jobs": 150,
  "active_jobs": 3,
  "completed_jobs": 140,
  "failed_jobs": 7,
  "total_documents_processed": 140,
  "total_entities_extracted": 3500,
  "total_concepts_extracted": 1200,
  "total_embeddings_generated": 7000
}
```

**Example (curl):**
```bash
curl "http://localhost:8000/ingest/stats"
```

**Example (Python):**
```python
import requests

url = "http://localhost:8000/ingest/stats"
response = requests.get(url)
stats = response.json()

print(f"Documents processed: {stats['total_documents_processed']}")
print(f"Entities extracted: {stats['total_entities_extracted']}")
print(f"Active jobs: {stats['active_jobs']}")
```

---

## Complete Workflow Example

```python
import requests
import time

BASE_URL = "http://localhost:8000"

# 1. Upload document
upload_url = f"{BASE_URL}/ingest/upload"
files = {"file": open("knowledge_base.pdf", "rb")}
data = {"user_id": "admin", "is_centralized": True}

response = requests.post(upload_url, files=files, data=data)
job = response.json()
job_id = job["job_id"]

print(f"✓ Uploaded: {job['file_name']} ({job['file_size']} bytes)")
print(f"✓ Job ID: {job_id}")

# 2. Monitor progress
status_url = f"{BASE_URL}/ingest/jobs/{job_id}"

while True:
    response = requests.get(status_url)
    status = response.json()

    progress = status['progress']
    state = status['status']

    print(f"  [{progress:3.0f}%] {state} - Step {status['completed_steps']}/{status['total_steps']}")

    if state in ['completed', 'failed']:
        break

    time.sleep(2)

# 3. Check results
if status['status'] == 'completed':
    result = status['result']
    print(f"\n✓ Ingestion Complete!")
    print(f"  - Document ID: {result['doc_id']}")
    print(f"  - Entities: {result['entities']}")
    print(f"  - Relationships: {result.get('relationships', 0)}")
    print(f"  - Concepts: {result['concepts']}")
    print(f"  - Chunks: {result['chunks']}")

    # 4. Get overall statistics
    stats_url = f"{BASE_URL}/ingest/stats"
    response = requests.get(stats_url)
    stats = response.json()

    print(f"\nSystem Stats:")
    print(f"  - Total Documents: {stats['total_documents_processed']}")
    print(f"  - Total Entities: {stats['total_entities_extracted']}")
    print(f"  - Active Jobs: {stats['active_jobs']}")
else:
    print(f"\n✗ Ingestion Failed: {status['errors']}")
```

---

## Integration with Reflex Admin UI

The Reflex admin UI can use these endpoints:

```python
import httpx

class AdminState(rx.State):
    async def upload_file(self, file: UploadFile):
        async with httpx.AsyncClient() as client:
            # Upload to API
            files = {"file": (file.filename, await file.read())}
            data = {
                "user_id": self.selected_user_id,
                "is_centralized": self.is_centralized
            }

            response = await client.post(
                "http://localhost:8000/ingest/upload",
                files=files,
                data=data
            )

            job = response.json()
            self.current_jobs.append(job)

            # Poll for status
            await self.poll_job_status(job["job_id"])

    async def poll_job_status(self, job_id: str):
        async with httpx.AsyncClient() as client:
            while True:
                response = await client.get(
                    f"http://localhost:8000/ingest/jobs/{job_id}"
                )
                status = response.json()

                # Update job in UI
                self.update_job_status(job_id, status)

                if status["status"] in ["completed", "failed"]:
                    break

                await asyncio.sleep(2)
```

---

## Error Handling

All endpoints return standard HTTP status codes:

- **200 OK**: Success
- **404 Not Found**: Job not found
- **500 Internal Server Error**: Server error

Error response format:
```json
{
  "detail": "Error message describing what went wrong"
}
```

---

## Authentication (Future)

Currently, the API does not require authentication. For production deployment, add:

- API keys
- OAuth2 / JWT tokens
- User session management
- Rate limiting

---

## Health Check

Before using ingestion endpoints, verify the server is healthy:

```bash
curl http://localhost:8000/health
```

Should return:
```json
{
  "status": "healthy",
  "databases": {
    "postgres": "ok",
    "redis": "ok",
    "neo4j": "ok",
    "qdrant": "ok"
  },
  "plugins": { ... }
}
```
