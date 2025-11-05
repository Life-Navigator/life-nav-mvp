# Docker Setup for Life Navigator

This guide explains how to set up and use Docker for local development with the Life Navigator project.

## Prerequisites

- Docker and Docker Compose installed on your system
- Basic knowledge of Docker and containerization

## Getting Started

1. Run the Docker setup script to ensure your Docker environment is correctly configured:

```bash
./docker-setup.sh
```

This script will:
- Verify Docker is installed
- Add your user to the docker group if necessary
- Start the Docker service if it's not running
- Test Docker functionality
- Check for Docker Compose

**Note:** If the script adds you to the docker group, you'll need to log out and log back in for the changes to take effect.

2. Start the development environment:

```bash
docker-compose up -d
```

This will start all the necessary services for local development:

- PostgreSQL databases (main, financial, healthcare)
- DynamoDB Local
- MinIO (S3-compatible storage)
- Redis
- Frontend Next.js application
- Financial API service
- Adminer for database management

3. Check that all services are running:

```bash
docker-compose ps
```

## Services and Ports

| Service | Description | Port |
|---------|-------------|------|
| postgres | Main PostgreSQL database | 5432 |
| financial-db | Financial domain database | 5433 |
| healthcare-db | Healthcare domain database | 5434 |
| dynamodb-local | DynamoDB Local instance | 8000 |
| minio | S3-compatible storage | 9000, 9001 |
| frontend | Next.js application | 3000 |
| financial-api | FastAPI Financial service | 8080 |
| redis | Redis for caching | 6379 |
| adminer | Database management UI | 8081 |

## Database Access

You can access the databases through Adminer at http://localhost:8081 with the following credentials:

### Main Database
- System: PostgreSQL
- Server: postgres
- Username: lifenavigator
- Password: lifenavigator_password
- Database: lifenavigator

### Financial Database
- System: PostgreSQL
- Server: financial-db
- Username: financial_user
- Password: financial_password
- Database: financial_db

### Healthcare Database
- System: PostgreSQL
- Server: healthcare-db
- Username: healthcare_user
- Password: healthcare_password
- Database: healthcare_db

## MinIO (Document Storage)

MinIO is an S3-compatible object storage used for the Document Vault. You can access the MinIO console at http://localhost:9001 with:

- Username: minio_access_key
- Password: minio_secret_key

## DynamoDB Local

You can interact with DynamoDB Local using AWS CLI with the `--endpoint-url` parameter:

```bash
aws dynamodb list-tables --endpoint-url http://localhost:8000
```

## Stopping the Environment

To stop all services:

```bash
docker-compose down
```

To stop and remove all data volumes (this will delete all data):

```bash
docker-compose down -v
```

## Troubleshooting

### Docker Permission Issues

If you encounter permission issues with Docker, make sure:

1. Your user is in the docker group:
   ```bash
   sudo usermod -aG docker $USER
   ```

2. You've logged out and logged back in after adding your user to the docker group

3. Docker service is running:
   ```bash
   sudo systemctl start docker
   sudo systemctl enable docker
   ```

### Database Connection Issues

If services can't connect to the databases, check:

1. The databases are running:
   ```bash
   docker-compose ps
   ```

2. The connection strings are correct in the environment variables

3. Network connectivity between containers:
   ```bash
   docker network inspect lifenavigator_default
   ```

## Development Workflow

1. Frontend development:
   - Code changes in the source files will be automatically detected and hot-reloaded
   - Access the Next.js application at http://localhost:3000

2. Backend API development:
   - The FastAPI service automatically reloads when code changes
   - Access the Financial API at http://localhost:8080
   - View API documentation at http://localhost:8080/docs

## Next Steps

After setting up Docker, continue with the main setup script to configure the application:

```bash
./setup.sh
```

This will install dependencies, set up environment variables, and prepare the database for use.

Refer to the [Implementation Guide](./IMPLEMENTATION_GUIDE.md) for detailed information about the project architecture and development guidelines.