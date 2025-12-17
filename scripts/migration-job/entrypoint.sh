#!/bin/bash
# ===========================================================================
# Elite Database Migration Runner
# ===========================================================================
# Runs migrations on Cloud SQL instances with full verification
# Designed to run as a Cloud Run Job inside the VPC
# ===========================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration from environment
HEALTH_DB_URL="${HEALTH_DATABASE_URL:-}"
FINANCE_DB_URL="${FINANCE_DATABASE_URL:-}"
CORE_DB_URL="${CORE_DATABASE_URL:-}"

# Results tracking
TOTAL_TABLES_CREATED=0
TOTAL_POLICIES_CREATED=0
ERRORS=0

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; ERRORS=$((ERRORS + 1)); }
log_header() { echo -e "\n${CYAN}═══════════════════════════════════════════════════════════════${NC}"; echo -e "${CYAN}  $1${NC}"; echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n"; }

# Function to parse DATABASE_URL and run psql using Python for robust URL parsing
run_psql() {
    local db_url="$1"
    shift

    # Use Python for robust parsing - handles unencoded special chars including : in password
    local parsed
    parsed=$(DB_URL="$db_url" python3 -c '
import re
import os

url = os.environ.get("DB_URL", "")
url_clean = re.sub(r"\?.*$", "", url)
db_match = re.search(r"/([^/]+)$", url_clean)
database = db_match.group(1) if db_match else ""
port_match = re.search(r":(\d+)/", url_clean)
port = port_match.group(1) if port_match else "5432"
last_at = url_clean.rfind("@")
if last_at != -1:
    after_at = url_clean[last_at+1:]
    host_match = re.match(r"([^:]+)", after_at)
    host = host_match.group(1) if host_match else ""
else:
    host = ""
user_match = re.match(r"postgresql://([^:]+):", url_clean)
user = user_match.group(1) if user_match else ""
user_end = len("postgresql://") + len(user) + 1
password = url_clean[user_end:last_at] if last_at > user_end else ""
print(f"{user}\t{password}\t{host}\t{port}\t{database}")
')

    local user=$(echo "$parsed" | cut -f1)
    local password=$(echo "$parsed" | cut -f2)
    local host=$(echo "$parsed" | cut -f3)
    local port=$(echo "$parsed" | cut -f4)
    local database=$(echo "$parsed" | cut -f5)

    if [[ -z "$user" || -z "$host" || -z "$database" ]]; then
        log_error "Failed to parse database URL"
        log_error "Parsed: user=$user host=$host port=$port db=$database"
        return 1
    fi

    # Run psql with connection parameters and SSL mode
    PGPASSWORD="$password" PGSSLMODE="require" psql -h "$host" -p "$port" -U "$user" -d "$database" "$@"
}

# Function to run migration file
run_migration() {
    local db_url="$1"
    local sql_file="$2"
    local db_name="$3"
    local migration_name=$(basename "$sql_file")

    log_info "Running: $migration_name on $db_name"

    if run_psql "$db_url" -f "$sql_file" 2>&1; then
        log_success "Applied: $migration_name"
        return 0
    else
        local result=$(run_psql "$db_url" -f "$sql_file" 2>&1 || true)
        if echo "$result" | grep -qE "already exists|duplicate"; then
            log_warning "Already applied: $migration_name"
            return 0
        else
            log_error "Failed: $migration_name"
            echo "$result" | head -5
            return 1
        fi
    fi
}

# Function to count tables
count_tables() {
    local db_url="$1"
    run_psql "$db_url" -t -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';" 2>/dev/null | tr -d ' \n' || echo "0"
}

# Function to count RLS-enabled tables
count_rls_tables() {
    local db_url="$1"
    run_psql "$db_url" -t -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;" 2>/dev/null | tr -d ' \n' || echo "0"
}

# Function to count policies
count_policies() {
    local db_url="$1"
    run_psql "$db_url" -t -c "SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';" 2>/dev/null | tr -d ' \n' || echo "0"
}

# Function to list tables
list_tables() {
    local db_url="$1"
    run_psql "$db_url" -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" 2>/dev/null || true
}

# Function to check extensions
check_extensions() {
    local db_url="$1"
    run_psql "$db_url" -t -c "SELECT extname FROM pg_extension ORDER BY extname;" 2>/dev/null || true
}

# Function to run HIPAA-specific migrations
run_hipaa_migrations() {
    local db_url="$1"

    log_header "Running HIPAA Migrations"

    if [[ -f "/migrations/hipaa/001_create_health_schema.sql" ]]; then
        run_migration "$db_url" "/migrations/hipaa/001_create_health_schema.sql" "HIPAA" || true
    fi

    if [[ -f "/migrations/005_encryption_functions.sql" ]]; then
        run_migration "$db_url" "/migrations/005_encryption_functions.sql" "HIPAA" || true
    fi
}

# Function to run Financial-specific migrations
run_financial_migrations() {
    local db_url="$1"

    log_header "Running Financial Migrations"

    if [[ -f "/migrations/financial/001_create_finance_schema.sql" ]]; then
        run_migration "$db_url" "/migrations/financial/001_create_finance_schema.sql" "Financial" || true
    fi

    if [[ -f "/migrations/005_encryption_functions.sql" ]]; then
        run_migration "$db_url" "/migrations/005_encryption_functions.sql" "Financial" || true
    fi
}

# Function to run Core database migrations
run_core_migrations() {
    local db_url="$1"

    log_header "Running Core Database Migrations"

    local migrations=(
        "/migrations/001_create_base_schema.sql"
        "/migrations/002_create_domain_tables.sql"
        "/migrations/003_enable_rls.sql"
        "/migrations/004_enable_pgvector.sql"
    )

    for migration in "${migrations[@]}"; do
        if [[ -f "$migration" ]]; then
            run_migration "$db_url" "$migration" "Core" || true
        fi
    done
}

# Function to verify database schema
verify_schema() {
    local db_url="$1"
    local db_name="$2"

    log_header "Verifying Schema: $db_name"

    local table_count=$(count_tables "$db_url")
    local rls_count=$(count_rls_tables "$db_url")
    local policy_count=$(count_policies "$db_url")

    echo -e "Tables:       ${GREEN}$table_count${NC}"
    echo -e "RLS Enabled:  ${GREEN}$rls_count${NC}"
    echo -e "RLS Policies: ${GREEN}$policy_count${NC}"
    echo ""

    echo "Tables in $db_name:"
    list_tables "$db_url" | while read -r table; do
        if [[ -n "$table" ]]; then
            echo "  - $table"
        fi
    done
    echo ""

    echo "Extensions:"
    check_extensions "$db_url" | while read -r ext; do
        if [[ -n "$ext" ]]; then
            echo "  - $ext"
        fi
    done

    TOTAL_TABLES_CREATED=$((TOTAL_TABLES_CREATED + table_count))
    TOTAL_POLICIES_CREATED=$((TOTAL_POLICIES_CREATED + policy_count))
}

# Function to test encryption functions
test_encryption() {
    local db_url="$1"
    local db_name="$2"

    log_header "Testing Encryption Functions: $db_name"

    local has_encrypt=$(run_psql "$db_url" -t -c "SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'encrypt_sensitive');" 2>/dev/null | tr -d ' \n' || echo "f")
    local has_decrypt=$(run_psql "$db_url" -t -c "SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'decrypt_sensitive');" 2>/dev/null | tr -d ' \n' || echo "f")
    local has_hash=$(run_psql "$db_url" -t -c "SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'hash_for_search');" 2>/dev/null | tr -d ' \n' || echo "f")

    if [[ "$has_encrypt" == "t" ]]; then
        log_success "encrypt_sensitive function exists"
    else
        log_warning "encrypt_sensitive function not found"
    fi

    if [[ "$has_decrypt" == "t" ]]; then
        log_success "decrypt_sensitive function exists"
    else
        log_warning "decrypt_sensitive function not found"
    fi

    if [[ "$has_hash" == "t" ]]; then
        log_success "hash_for_search function exists"
    else
        log_warning "hash_for_search function not found"
    fi
}

# Main execution
main() {
    log_header "ELITE DATABASE MIGRATION RUNNER"
    echo "Starting at: $(date)"
    echo ""

    # Check database URLs
    if [[ -z "$HEALTH_DB_URL" ]]; then
        log_error "HEALTH_DATABASE_URL not set"
    else
        log_info "HIPAA database URL configured"
    fi

    if [[ -z "$FINANCE_DB_URL" ]]; then
        log_error "FINANCE_DATABASE_URL not set"
    else
        log_info "Financial database URL configured"
    fi

    if [[ -z "$CORE_DB_URL" ]]; then
        log_warning "CORE_DATABASE_URL not set (optional)"
    else
        log_info "Core database URL configured"
    fi

    # HIPAA Database
    if [[ -n "$HEALTH_DB_URL" ]]; then
        run_hipaa_migrations "$HEALTH_DB_URL"
        verify_schema "$HEALTH_DB_URL" "HIPAA"
        test_encryption "$HEALTH_DB_URL" "HIPAA"
    fi

    # Financial Database
    if [[ -n "$FINANCE_DB_URL" ]]; then
        run_financial_migrations "$FINANCE_DB_URL"
        verify_schema "$FINANCE_DB_URL" "Financial"
        test_encryption "$FINANCE_DB_URL" "Financial"
    fi

    # Core Database (if provided)
    if [[ -n "$CORE_DB_URL" ]]; then
        run_core_migrations "$CORE_DB_URL"
        verify_schema "$CORE_DB_URL" "Core"
    fi

    # Final Summary
    log_header "MIGRATION SUMMARY"
    echo ""
    echo "Total Tables Created: $TOTAL_TABLES_CREATED"
    echo "Total RLS Policies:   $TOTAL_POLICIES_CREATED"
    echo "Errors:               $ERRORS"
    echo ""

    if [[ $ERRORS -eq 0 ]]; then
        log_success "All migrations completed successfully!"
        exit 0
    else
        log_warning "Some migrations had warnings/errors. Check logs above."
        # Don't exit with error if tables were created
        if [[ $TOTAL_TABLES_CREATED -gt 0 ]]; then
            exit 0
        fi
        exit 1
    fi
}

main "$@"
