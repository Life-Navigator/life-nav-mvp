#!/bin/bash
# PostgreSQL setup script for LifeNavigator
# This script handles the migration from SQLite to PostgreSQL

set -e

# Configuration
PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-postgres}"
PG_PASSWORD="${PG_PASSWORD:-postgres}"
PG_DB="${PG_DB:-lifenavigator}"
PG_SCHEMA="${PG_SCHEMA:-public}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored message
function echo_color() {
  echo -e "${2}${1}${NC}"
}

# Print step information
function step() {
  echo_color "STEP: $1" "$BLUE"
}

# Print success message
function success() {
  echo_color "SUCCESS: $1" "$GREEN"
}

# Print warning message
function warning() {
  echo_color "WARNING: $1" "$YELLOW"
}

# Print error message and exit
function error() {
  echo_color "ERROR: $1" "$RED"
  exit 1
}

# Check for required tools
function check_requirements() {
  step "Checking requirements"
  
  # Check for PostgreSQL client
  if ! command -v psql &> /dev/null; then
    error "PostgreSQL client (psql) is not installed. Please install it first."
  fi
  
  # Check for Node.js
  if ! command -v node &> /dev/null; then
    error "Node.js is not installed. Please install it first."
  fi
  
  # Check for npm
  if ! command -v npm &> /dev/null; then
    error "npm is not installed. Please install it first."
  fi
  
  # Check for npx
  if ! command -v npx &> /dev/null; then
    error "npx is not installed. Please install it first."
  fi
  
  success "All required tools are installed"
}

# Create PostgreSQL connection string
function create_connection_string() {
  if [ -n "$PG_PASSWORD" ]; then
    echo "postgresql://${PG_USER}:${PG_PASSWORD}@${PG_HOST}:${PG_PORT}/${PG_DB}?schema=${PG_SCHEMA}"
  else
    echo "postgresql://${PG_USER}@${PG_HOST}:${PG_PORT}/${PG_DB}?schema=${PG_SCHEMA}"
  fi
}

# Check PostgreSQL connection
function check_pg_connection() {
  step "Checking PostgreSQL connection"
  
  if PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -c '\conninfo' &> /dev/null; then
    success "PostgreSQL connection successful"
  else
    error "Could not connect to PostgreSQL. Please check your connection details."
  fi
}

# Create PostgreSQL database if it doesn't exist
function create_database() {
  step "Creating PostgreSQL database if it doesn't exist"
  
  if PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -lqt | cut -d \| -f 1 | grep -qw "$PG_DB"; then
    warning "Database '$PG_DB' already exists. Skipping creation."
  else
    if PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -c "CREATE DATABASE ${PG_DB};" &> /dev/null; then
      success "Database '$PG_DB' created successfully"
    else
      error "Failed to create database '$PG_DB'"
    fi
  fi
}

# Create .env file with PostgreSQL connection string
function create_env_file() {
  step "Creating .env file for PostgreSQL"
  
  CONNECTION_STRING=$(create_connection_string)
  
  # Create .env file if it doesn't exist
  if [ ! -f .env ]; then
    cp env.example .env
    warning "Created new .env file from env.example"
  fi
  
  # Update DATABASE_URL in .env
  if grep -q "DATABASE_URL=" .env; then
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=\"${CONNECTION_STRING}\"|g" .env
  else
    echo "DATABASE_URL=\"${CONNECTION_STRING}\"" >> .env
  fi
  
  # Also update provider in case it's set to SQLite
  sed -i "s|provider = \"sqlite\"|provider = \"postgresql\"|g" prisma/schema.prisma
  
  success "Environment configured for PostgreSQL"
}

# Run Prisma migration
function run_prisma_migration() {
  step "Running Prisma migration to PostgreSQL"
  
  # Generate Prisma client
  npx prisma generate
  
  # Run migration
  npx prisma migrate deploy
  
  success "Prisma migration completed"
}

# Set up connection pooling
function setup_connection_pooling() {
  step "Setting up connection pooling"
  
  # Create db-config.ts if it doesn't exist (this should already exist in the codebase)
  if [ ! -f lib/db-config.ts ]; then
    warning "db-config.ts not found. Creating a basic version."
    
    mkdir -p lib
    cat > lib/db-config.ts << 'EOF'
import { Pool } from 'pg';

// Configure PostgreSQL connection pool
export const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000, // How long to wait for a connection
});

// Event handlers for the pool
pgPool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

pgPool.on('connect', (client) => {
  console.log('New client connected to PostgreSQL');
});

// Function to get a client from the pool
export async function getPoolClient() {
  const client = await pgPool.connect();
  return client;
}
EOF
    
    success "Created db-config.ts with connection pooling"
  else
    success "db-config.ts already exists, skipping creation"
  fi
}

# Create database indexes for optimization
function create_db_indexes() {
  step "Creating additional database indexes for performance"
  
  # Connect to the database and create indexes
  PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" << EOF
-- User-related indexes
CREATE INDEX IF NOT EXISTS "idx_user_email" ON "users" ("email");
CREATE INDEX IF NOT EXISTS "idx_user_setupCompleted" ON "users" ("setupCompleted");

-- Session-related indexes
CREATE INDEX IF NOT EXISTS "idx_session_userId" ON "sessions" ("userId");
CREATE INDEX IF NOT EXISTS "idx_session_expires" ON "sessions" ("expires");

-- Financial records indexes
CREATE INDEX IF NOT EXISTS "idx_financialRecord_userId" ON "financial_records" ("userId");
CREATE INDEX IF NOT EXISTS "idx_investment_userId" ON "investments" ("userId");
CREATE INDEX IF NOT EXISTS "idx_budget_userId" ON "budgets" ("userId");

-- Career-related indexes
CREATE INDEX IF NOT EXISTS "idx_careerRecord_userId" ON "career_records" ("userId");
CREATE INDEX IF NOT EXISTS "idx_jobApplication_status" ON "job_applications" ("status");

-- Education-related indexes
CREATE INDEX IF NOT EXISTS "idx_educationRecord_userId" ON "education_records" ("userId");
CREATE INDEX IF NOT EXISTS "idx_course_status" ON "courses" ("status");

-- Healthcare-related indexes
CREATE INDEX IF NOT EXISTS "idx_healthRecord_userId" ON "health_records" ("userId");
CREATE INDEX IF NOT EXISTS "idx_secureDocument_healthRecordId" ON "secure_documents" ("healthRecordId");

-- Integration-related indexes
CREATE INDEX IF NOT EXISTS "idx_integration_userId_status" ON "integrations" ("userId", "status");
CREATE INDEX IF NOT EXISTS "idx_integrationToken_expiresAt" ON "integration_tokens" ("expiresAt");

-- Security-related indexes
CREATE INDEX IF NOT EXISTS "idx_passwordResetToken_expiresAt" ON "password_reset_tokens" ("expiresAt");
CREATE INDEX IF NOT EXISTS "idx_revokedToken_expiresAt" ON "revoked_tokens" ("expiresAt");
CREATE INDEX IF NOT EXISTS "idx_securityAuditLog_createdAt" ON "security_audit_log" ("createdAt");
EOF
  
  success "Created database indexes for performance optimization"
}

# Configure backup procedures
function setup_backup_procedures() {
  step "Setting up database backup procedures"
  
  # Create backup script
  cat > scripts/backup-postgres.sh << 'EOF'
#!/bin/bash
# PostgreSQL backup script for LifeNavigator

# Configuration (override with environment variables)
PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-postgres}"
PG_PASSWORD="${PG_PASSWORD:-postgres}"
PG_DB="${PG_DB:-lifenavigator}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${PG_DB}_${TIMESTAMP}.sql.gz"

# Run backup
PGPASSWORD="$PG_PASSWORD" pg_dump -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" --clean | gzip > "$BACKUP_FILE"

# Check if backup was successful
if [ $? -eq 0 ]; then
  echo "Backup completed successfully: $BACKUP_FILE"
  
  # Optionally upload to S3 (uncomment and configure)
  # aws s3 cp "$BACKUP_FILE" "s3://your-bucket/backups/"
  
  # Clean up old backups (keep last 30 days)
  find "$BACKUP_DIR" -name "${PG_DB}_*.sql.gz" -mtime +30 -delete
else
  echo "Backup failed"
  exit 1
fi
EOF
  
  # Make backup script executable
  chmod +x scripts/backup-postgres.sh
  
  # Create restore script
  cat > scripts/restore-postgres.sh << 'EOF'
#!/bin/bash
# PostgreSQL restore script for LifeNavigator

# Configuration (override with environment variables)
PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-postgres}"
PG_PASSWORD="${PG_PASSWORD:-postgres}"
PG_DB="${PG_DB:-lifenavigator}"

# Check if backup file is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <backup_file>"
  exit 1
fi

BACKUP_FILE="$1"

# Check if file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file does not exist: $BACKUP_FILE"
  exit 1
fi

# Confirm restore
read -p "This will overwrite the current database. Are you sure? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Restore cancelled"
  exit 1
fi

# Run restore
if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" | PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB"
else
  PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" < "$BACKUP_FILE"
fi

# Check if restore was successful
if [ $? -eq 0 ]; then
  echo "Restore completed successfully from: $BACKUP_FILE"
else
  echo "Restore failed"
  exit 1
fi
EOF
  
  # Make restore script executable
  chmod +x scripts/restore-postgres.sh
  
  success "Backup and restore procedures created in scripts directory"
}

# Seed initial data (if needed)
function seed_initial_data() {
  step "Seeding initial data"
  
  # Run Prisma seed script
  npx prisma db seed
  
  success "Initial data seeded successfully"
}

# Run tests to verify migration
function run_verification_tests() {
  step "Running verification tests"
  
  # Run tests
  npm test -- --testPathPattern=database
  
  success "Verification tests completed"
}

# Main function to orchestrate the migration
function main() {
  echo_color "=========================================" "$BLUE"
  echo_color "  LifeNavigator PostgreSQL Migration Tool" "$BLUE"
  echo_color "=========================================" "$BLUE"
  echo
  
  # Run all steps
  check_requirements
  check_pg_connection
  create_database
  create_env_file
  run_prisma_migration
  setup_connection_pooling
  create_db_indexes
  setup_backup_procedures
  seed_initial_data
  run_verification_tests
  
  echo
  echo_color "=========================================" "$GREEN"
  echo_color "  Migration completed successfully!      " "$GREEN"
  echo_color "=========================================" "$GREEN"
  echo
  echo_color "Your LifeNavigator application is now configured to use PostgreSQL." "$BLUE"
  echo_color "Next steps:" "$BLUE"
  echo_color "1. Restart your application: npm run dev" "$BLUE"
  echo_color "2. Set up automated backups in production" "$BLUE"
  echo_color "3. Configure monitoring for your database" "$BLUE"
  echo
}

# Run the main function
main