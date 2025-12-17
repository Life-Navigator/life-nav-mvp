#!/bin/bash
# ===========================================================================
# Cloud SQL Migration Runner
# ===========================================================================
# Runs SQL migrations on Cloud SQL instances via Cloud SQL Proxy
#
# Usage:
#   ./scripts/run-cloud-sql-migrations.sh [environment] [database_type]
#
# Examples:
#   ./scripts/run-cloud-sql-migrations.sh dev hipaa
#   ./scripts/run-cloud-sql-migrations.sh dev financial
#   ./scripts/run-cloud-sql-migrations.sh prod all
# ===========================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="$PROJECT_ROOT/backend/app/db/migrations"

# Default values
ENV="${1:-dev}"
DB_TYPE="${2:-all}"
PROJECT_ID="${GCP_PROJECT_ID:-lifenav-prod}"

# Validate environment
if [[ ! "$ENV" =~ ^(dev|staging|prod)$ ]]; then
    echo -e "${RED}Error: Invalid environment '$ENV'. Use: dev, staging, or prod${NC}"
    exit 1
fi

# Validate database type
if [[ ! "$DB_TYPE" =~ ^(hipaa|financial|all)$ ]]; then
    echo -e "${RED}Error: Invalid database type '$DB_TYPE'. Use: hipaa, financial, or all${NC}"
    exit 1
fi

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}Cloud SQL Migration Runner${NC}"
echo -e "${BLUE}=========================================${NC}"
echo -e "Environment: ${GREEN}$ENV${NC}"
echo -e "Database:    ${GREEN}$DB_TYPE${NC}"
echo -e "Project:     ${GREEN}$PROJECT_ID${NC}"
echo ""

# Function to get secret from Secret Manager
get_secret() {
    local secret_name="$1"
    gcloud secrets versions access latest --secret="$secret_name" --project="$PROJECT_ID" 2>/dev/null
}

# Function to run migrations on a database
run_migrations() {
    local db_type="$1"
    local instance_name="life-navigator-${db_type}-${ENV}"
    local db_name="lifenavigator_${db_type}"
    local migrations_subdir=""

    case "$db_type" in
        hipaa)
            migrations_subdir="hipaa"
            ;;
        financial)
            migrations_subdir="financial"
            ;;
    esac

    echo -e "${YELLOW}----------------------------------------${NC}"
    echo -e "${YELLOW}Running migrations for: $db_type${NC}"
    echo -e "${YELLOW}----------------------------------------${NC}"

    # Get connection details from Secret Manager
    local connection_url
    connection_url=$(get_secret "${instance_name}-migration-url")

    if [[ -z "$connection_url" ]]; then
        echo -e "${RED}Error: Could not retrieve connection URL for $instance_name${NC}"
        return 1
    fi

    # Start Cloud SQL Proxy in background
    echo -e "${BLUE}Starting Cloud SQL Proxy...${NC}"
    local proxy_port=$((5432 + RANDOM % 1000))
    local connection_name
    connection_name=$(gcloud sql instances describe "$instance_name" --project="$PROJECT_ID" --format='value(connectionName)' 2>/dev/null)

    if [[ -z "$connection_name" ]]; then
        echo -e "${RED}Error: Could not get connection name for $instance_name${NC}"
        return 1
    fi

    cloud-sql-proxy "$connection_name" --port="$proxy_port" &
    PROXY_PID=$!
    sleep 3

    # Check if proxy is running
    if ! kill -0 $PROXY_PID 2>/dev/null; then
        echo -e "${RED}Error: Cloud SQL Proxy failed to start${NC}"
        return 1
    fi

    # Modify connection URL to use localhost
    local local_url
    local_url=$(echo "$connection_url" | sed "s/@[^/]*\//@localhost:$proxy_port\//")

    # Run base migrations first
    echo -e "${BLUE}Running base migrations...${NC}"

    local base_migrations=(
        "001_create_base_schema.sql"
        "002_create_domain_tables.sql"
        "003_enable_rls.sql"
        "004_enable_pgvector.sql"
        "005_encryption_functions.sql"
    )

    for migration in "${base_migrations[@]}"; do
        local migration_file="$MIGRATIONS_DIR/$migration"
        if [[ -f "$migration_file" ]]; then
            echo -e "  Running: $migration"
            PGPASSWORD=$(echo "$local_url" | grep -oP '://[^:]+:\K[^@]+') \
            psql "$local_url" -f "$migration_file" > /dev/null 2>&1 || {
                echo -e "${YELLOW}  Warning: $migration may have already been applied${NC}"
            }
        fi
    done

    # Run database-specific migrations
    if [[ -n "$migrations_subdir" && -d "$MIGRATIONS_DIR/$migrations_subdir" ]]; then
        echo -e "${BLUE}Running $db_type-specific migrations...${NC}"
        for migration_file in "$MIGRATIONS_DIR/$migrations_subdir"/*.sql; do
            if [[ -f "$migration_file" ]]; then
                local filename=$(basename "$migration_file")
                echo -e "  Running: $migrations_subdir/$filename"
                PGPASSWORD=$(echo "$local_url" | grep -oP '://[^:]+:\K[^@]+') \
                psql "$local_url" -f "$migration_file" > /dev/null 2>&1 || {
                    echo -e "${YELLOW}  Warning: $filename may have already been applied${NC}"
                }
            fi
        done
    fi

    # Stop proxy
    echo -e "${BLUE}Stopping Cloud SQL Proxy...${NC}"
    kill $PROXY_PID 2>/dev/null || true
    wait $PROXY_PID 2>/dev/null || true

    echo -e "${GREEN}✓ Migrations complete for $db_type${NC}"
    echo ""
}

# Function to verify database setup
verify_database() {
    local db_type="$1"
    local instance_name="life-navigator-${db_type}-${ENV}"

    echo -e "${BLUE}Verifying $db_type database setup...${NC}"

    # Check instance exists
    if ! gcloud sql instances describe "$instance_name" --project="$PROJECT_ID" > /dev/null 2>&1; then
        echo -e "${RED}Error: Instance $instance_name does not exist${NC}"
        return 1
    fi

    # Check instance is running
    local status
    status=$(gcloud sql instances describe "$instance_name" --project="$PROJECT_ID" --format='value(state)')
    if [[ "$status" != "RUNNABLE" ]]; then
        echo -e "${RED}Error: Instance $instance_name is not running (status: $status)${NC}"
        return 1
    fi

    echo -e "${GREEN}✓ Instance $instance_name is running${NC}"
}

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI not found. Please install Google Cloud SDK.${NC}"
    exit 1
fi

if ! command -v cloud-sql-proxy &> /dev/null; then
    echo -e "${YELLOW}Warning: cloud-sql-proxy not found. Installing...${NC}"
    curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.1/cloud-sql-proxy.linux.amd64
    chmod +x cloud-sql-proxy
    sudo mv cloud-sql-proxy /usr/local/bin/
fi

if ! command -v psql &> /dev/null; then
    echo -e "${RED}Error: psql not found. Please install PostgreSQL client.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites satisfied${NC}"
echo ""

# Main execution
if [[ "$DB_TYPE" == "all" ]]; then
    # Run for both databases
    verify_database "hipaa"
    verify_database "financial"
    run_migrations "hipaa"
    run_migrations "financial"
else
    verify_database "$DB_TYPE"
    run_migrations "$DB_TYPE"
fi

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}All migrations completed successfully!${NC}"
echo -e "${GREEN}=========================================${NC}"
