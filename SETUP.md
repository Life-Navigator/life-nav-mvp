# Life Navigator - Development Setup Guide

This guide walks you through setting up the Life Navigator development environment securely.

## Prerequisites

- Docker and Docker Compose
- Git
- OpenSSL (for generating secrets)

## Quick Start

### 1. Generate Credentials

First, generate strong, unique credentials for your local development environment:

```bash
# Generate SECRET_KEY (64 characters)
openssl rand -hex 32

# Generate POSTGRES_PASSWORD
openssl rand -base64 24

# Generate NEO4J_PASSWORD  
openssl rand -base64 24
```

### 2. Create .env File

Copy the example environment file and fill in the credentials you just generated:

```bash
cp .env.example .env
```

Edit `.env` and set the following REQUIRED variables:

```bash
# Required: Set these values
POSTGRES_PASSWORD=<your-generated-postgres-password>
NEO4J_PASSWORD=<your-generated-neo4j-password>
SECRET_KEY=<your-generated-secret-key>
```

**IMPORTANT**: NEVER commit the `.env` file! It's already in `.gitignore`.

### 3. Start Services

```bash
docker compose up -d
```

This will start:
- PostgreSQL (port 5432)
- Redis (port 6379)
- Neo4j (ports 7474, 7687)
- Qdrant (ports 6333, 6334)
- GraphDB (port 7200)
- GraphRAG service (port 50051)
- Backend API (port 8000)
- Finance API (port 8001)
- Agents service (port 8080)
- MCP Server (port 8090)

### 4. Verify Services

Check that all services are running:

```bash
docker compose ps
```

Test the backend health endpoint:

```bash
curl http://localhost:8000/health
```

## Security Best Practices

### Environment Variables

- **NEVER** commit `.env` files to version control
- Each developer should generate their own local credentials
- Use different credentials for dev/staging/prod environments
- Rotate credentials every 90 days

### Credentials Storage

Store your development credentials securely:
- Use a password manager (1Password, LastPass, Bitwarden)
- Document which credentials are for which environment
- Don't share credentials via Slack/email

### Production Credentials

For production:
- Use GCP Secret Manager or similar
- Enable automatic rotation
- Use separate service accounts with minimal permissions
- Enable audit logging

## API Endpoints

Once running, you can access:

- Backend API: http://localhost:8000
- Backend API Docs: http://localhost:8000/docs  
- Finance API: http://localhost:8001
- Finance API Docs: http://localhost:8001/docs
- Agents Service: http://localhost:8080
- MCP Server: http://localhost:8090
- Neo4j Browser: http://localhost:7474
- GraphDB: http://localhost:7200

## Troubleshooting

### Services Won't Start

If services fail to start with "required variable is missing":
1. Check that `.env` file exists in project root
2. Verify all REQUIRED variables are set (not blank)
3. Check for typos in variable names

### Port Conflicts

If ports are already in use:
1. Check what's using the ports: `lsof -i :<port>`
2. Stop conflicting services
3. Or modify ports in `docker-compose.yml`

### Permission Errors

If you get permission errors:
```bash
# Reset Docker volumes
docker compose down -v
docker compose up -d
```

## Development Workflow

### Making Changes

1. Make code changes
2. Rebuild affected service: `docker compose build <service>`
3. Restart service: `docker compose up -d <service>`

### Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service  
docker compose logs -f backend

# Last 100 lines
docker compose logs --tail=100 backend
```

### Database Access

```bash
# PostgreSQL
docker compose exec postgres psql -U lifenavigator -d lifenavigator_dev

# Redis
docker compose exec redis redis-cli
```

## Clean Up

### Stop Services

```bash
docker compose down
```

### Remove All Data

```bash
# WARNING: This deletes all data in volumes
docker compose down -v
```

## Getting Help

- Check the main README.md for architecture details
- Review REMEDIATION_GUIDE.md for security fixes
- File issues at: https://github.com/your-org/life-navigator/issues

## Security Audit Compliance

This setup follows the security remediation guidelines established in the security audit. All hardcoded credentials have been removed and replaced with environment variables as per **Fix #5: Rotate Exposed Credentials**.

Key security measures:
- ✅ No hardcoded credentials in docker-compose.yml
- ✅ All secrets loaded from `.env` file
- ✅ `.env` file not committed to git
- ✅ Strong password requirements documented
- ✅ Credential rotation guidelines provided

For detailed security information, see `REMEDIATION_GUIDE.md`.
