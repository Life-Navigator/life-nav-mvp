#!/bin/bash
#===============================================================================
# Database Migration Verification Script
# Verifies and optionally runs all Alembic migrations for Life Navigator services
#===============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==============================================================================="
echo "Life Navigator - Database Migration Verification"
echo "==============================================================================="
echo ""

#===============================================================================
# Check if PostgreSQL is running
#===============================================================================
check_postgres() {
    echo -e "${BLUE}[1/5] Checking PostgreSQL connection...${NC}"

    if command -v psql &> /dev/null; then
        # Check docker-compose PostgreSQL
        if docker ps | grep -q ln-postgres; then
            echo -e "${GREEN}✓ PostgreSQL is running (docker-compose)${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠ PostgreSQL container not running. Starting docker-compose...${NC}"
            cd "$PROJECT_ROOT"
            docker compose up -d postgres
            echo "Waiting for PostgreSQL to be ready..."
            sleep 5
            return 0
        fi
    else
        echo -e "${RED}✗ psql command not found${NC}"
        return 1
    fi
}

#===============================================================================
# Check Backend Migrations
#===============================================================================
check_backend_migrations() {
    echo ""
    echo -e "${BLUE}[2/5] Checking Backend migrations...${NC}"

    cd "$PROJECT_ROOT/backend"

    if [ ! -d "alembic/versions" ]; then
        echo -e "${YELLOW}⚠ No migrations directory found for backend${NC}"
        return 1
    fi

    MIGRATION_COUNT=$(find alembic/versions -name "*.py" ! -name "__*" | wc -l)
    echo -e "Found ${GREEN}$MIGRATION_COUNT${NC} migration(s)"

    if [ -f "alembic.ini" ]; then
        echo -e "${GREEN}✓ alembic.ini found${NC}"

        # List migrations
        if [ "$MIGRATION_COUNT" -gt 0 ]; then
            echo "Migrations:"
            ls -1 alembic/versions/*.py | grep -v __pycache__ | while read file; do
                echo "  - $(basename $file)"
            done
        fi
    else
        echo -e "${RED}✗ alembic.ini not found${NC}"
        return 1
    fi
}

#===============================================================================
# Check Finance API Migrations
#===============================================================================
check_finance_api_migrations() {
    echo ""
    echo -e "${BLUE}[3/5] Checking Finance API migrations...${NC}"

    cd "$PROJECT_ROOT/services/finance-api"

    if [ ! -d "alembic/versions" ]; then
        echo -e "${YELLOW}⚠ No migrations directory found for finance-api${NC}"
        echo -e "${YELLOW}  Creating alembic/versions directory...${NC}"
        mkdir -p alembic/versions
        touch alembic/versions/.gitkeep
        echo -e "${GREEN}✓ Created alembic/versions${NC}"
        return 0
    fi

    MIGRATION_COUNT=$(find alembic/versions -name "*.py" ! -name "__*" 2>/dev/null | wc -l)
    echo -e "Found ${GREEN}$MIGRATION_COUNT${NC} migration(s)"

    if [ -f "alembic.ini" ]; then
        echo -e "${GREEN}✓ alembic.ini found${NC}"

        if [ "$MIGRATION_COUNT" -gt 0 ]; then
            echo "Migrations:"
            find alembic/versions -name "*.py" ! -name "__*" | while read file; do
                echo "  - $(basename $file)"
            done
        else
            echo -e "${YELLOW}⚠ No migrations found. You may need to create an initial migration:${NC}"
            echo "  cd services/finance-api"
            echo "  alembic revision --autogenerate -m 'Initial schema'"
        fi
    else
        echo -e "${RED}✗ alembic.ini not found${NC}"
        return 1
    fi
}

#===============================================================================
# Check API Service Migrations
#===============================================================================
check_api_migrations() {
    echo ""
    echo -e "${BLUE}[4/5] Checking API service migrations...${NC}"

    cd "$PROJECT_ROOT/services/api"

    if [ ! -d "alembic/versions" ]; then
        echo -e "${YELLOW}⚠ No migrations directory found for api service${NC}"
        return 0  # Not critical for MVP
    fi

    MIGRATION_COUNT=$(find alembic/versions -name "*.py" ! -name "__*" 2>/dev/null | wc -l)
    echo -e "Found ${GREEN}$MIGRATION_COUNT${NC} migration(s)"

    if [ -f "alembic.ini" ]; then
        echo -e "${GREEN}✓ alembic.ini found${NC}"

        if [ "$MIGRATION_COUNT" -gt 0 ]; then
            echo "Migrations:"
            find alembic/versions -name "*.py" ! -name "__*" | while read file; do
                echo "  - $(basename $file)"
            done
        fi
    fi
}

#===============================================================================
# Run Migrations (optional)
#===============================================================================
run_migrations() {
    echo ""
    echo -e "${BLUE}[5/5] Running migrations...${NC}"
    echo ""

    # Backend migrations
    echo -e "${YELLOW}Running backend migrations...${NC}"
    cd "$PROJECT_ROOT/backend"
    if [ -f "alembic.ini" ]; then
        # Check if alembic is installed
        if python3 -c "import alembic" 2>/dev/null; then
            alembic upgrade head && echo -e "${GREEN}✓ Backend migrations applied${NC}" || echo -e "${RED}✗ Backend migrations failed${NC}"
        else
            echo -e "${RED}✗ Alembic not installed. Install with: pip install alembic${NC}"
        fi
    fi

    echo ""

    # Finance API migrations
    echo -e "${YELLOW}Running finance-api migrations...${NC}"
    cd "$PROJECT_ROOT/services/finance-api"
    if [ -f "alembic.ini" ]; then
        MIGRATION_COUNT=$(find alembic/versions -name "*.py" ! -name "__*" 2>/dev/null | wc -l)
        if [ "$MIGRATION_COUNT" -gt 0 ]; then
            if python3 -c "import alembic" 2>/dev/null; then
                alembic upgrade head && echo -e "${GREEN}✓ Finance API migrations applied${NC}" || echo -e "${RED}✗ Finance API migrations failed${NC}"
            else
                echo -e "${RED}✗ Alembic not installed${NC}"
            fi
        else
            echo -e "${YELLOW}⚠ No migrations to run${NC}"
        fi
    fi
}

#===============================================================================
# Summary
#===============================================================================
print_summary() {
    echo ""
    echo "==============================================================================="
    echo "Summary"
    echo "==============================================================================="
    echo ""
    echo "Migration status checked for:"
    echo "  ✓ Backend service (backend/)"
    echo "  ✓ Finance API service (services/finance-api/)"
    echo "  ✓ API service (services/api/)"
    echo ""
    echo "Next steps:"
    echo "  1. Ensure PostgreSQL is running: docker compose up -d postgres"
    echo "  2. Run migrations manually:"
    echo "     cd backend && alembic upgrade head"
    echo "     cd services/finance-api && alembic upgrade head"
    echo ""
    echo "  3. Or run all migrations with this script:"
    echo "     $0 --apply"
    echo ""
}

#===============================================================================
# Main
#===============================================================================
main() {
    check_postgres
    check_backend_migrations
    check_finance_api_migrations
    check_api_migrations

    if [ "$1" == "--apply" ] || [ "$1" == "-a" ]; then
        run_migrations
    else
        echo ""
        echo -e "${YELLOW}Migrations NOT applied (dry-run mode)${NC}"
        echo -e "To apply migrations, run: $0 --apply"
    fi

    print_summary
}

# Run main function
main "$@"
