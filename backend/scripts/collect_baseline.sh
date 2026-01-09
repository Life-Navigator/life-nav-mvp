#!/bin/bash
#
# Performance Baseline Collection Script
#
# This script collects performance baseline metrics from all databases.
# Run daily during Week 1 (measurement phase) to establish baseline.
#
# Usage:
#   ./backend/scripts/collect_baseline.sh
#
# Prerequisites:
#   - DATABASE_URL, DATABASE_HIPAA_URL, DATABASE_FINANCIAL_URL set in environment
#   - psql client installed
#   - Permissions to connect to all databases
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"
BASELINE_DIR="$PROJECT_ROOT/docs/performance/baseline"
QUERIES_FILE="$PROJECT_ROOT/docs/performance/queries/baseline.sql"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_ONLY=$(date +%Y%m%d)

# Create baseline directory if it doesn't exist
mkdir -p "$BASELINE_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Performance Baseline Collection${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Timestamp: $TIMESTAMP"
echo -e "Output directory: $BASELINE_DIR"
echo ""

# Check if baseline queries file exists
if [ ! -f "$QUERIES_FILE" ]; then
    echo -e "${RED}ERROR: Baseline queries file not found: $QUERIES_FILE${NC}"
    exit 1
fi

# Function to collect baseline for a database
collect_baseline() {
    local db_name=$1
    local db_url=$2
    local output_file="${BASELINE_DIR}/${DATE_ONLY}_${db_name}.txt"

    echo -e "${YELLOW}Collecting baseline for: ${db_name}${NC}"

    if [ -z "$db_url" ]; then
        echo -e "${RED}  ERROR: Database URL not set for $db_name${NC}"
        return 1
    fi

    # Test connection
    if ! psql "$db_url" -c "SELECT 1" > /dev/null 2>&1; then
        echo -e "${RED}  ERROR: Cannot connect to $db_name database${NC}"
        return 1
    fi

    # Run baseline queries
    echo -e "  Running queries..."
    if psql "$db_url" -f "$QUERIES_FILE" > "$output_file" 2>&1; then
        local file_size=$(wc -c < "$output_file")
        echo -e "${GREEN}  ✓ Baseline collected: $output_file (${file_size} bytes)${NC}"

        # Extract key metrics for quick review
        echo -e "  ${BLUE}Quick Summary:${NC}"

        # Connection count
        local conn_count=$(grep -A 3 "CONNECTION POOL USAGE" "$output_file" | grep "total_connections" | awk '{print $3}')
        if [ -n "$conn_count" ]; then
            echo -e "    - Total connections: $conn_count"
        fi

        # Slowest query
        local slowest=$(grep -A 1 "TOP 20 SLOWEST QUERIES" "$output_file" | tail -1 | awk '{print $1}')
        if [ -n "$slowest" ]; then
            echo -e "    - Slowest query avg time: ${slowest}ms"
        fi

        # Read/write ratio
        local read_count=$(grep -A 5 "READ vs WRITE RATIO" "$output_file" | grep " read " | awk '{print $3}')
        local write_count=$(grep -A 5 "READ vs WRITE RATIO" "$output_file" | grep " write " | awk '{print $3}')
        if [ -n "$read_count" ] && [ -n "$write_count" ] && [ "$write_count" -gt 0 ]; then
            local ratio=$(echo "scale=2; $read_count / $write_count" | bc)
            echo -e "    - Read/Write ratio: ${ratio}:1"
        fi

        return 0
    else
        echo -e "${RED}  ERROR: Failed to collect baseline${NC}"
        return 1
    fi
}

# Collect baseline for each database
success_count=0
total_count=0

# Main database
if [ -n "$DATABASE_URL" ]; then
    total_count=$((total_count + 1))
    if collect_baseline "main" "$DATABASE_URL"; then
        success_count=$((success_count + 1))
    fi
    echo ""
else
    echo -e "${YELLOW}Skipping main database (DATABASE_URL not set)${NC}"
    echo ""
fi

# HIPAA database
if [ -n "$DATABASE_HIPAA_URL" ]; then
    total_count=$((total_count + 1))
    if collect_baseline "hipaa" "$DATABASE_HIPAA_URL"; then
        success_count=$((success_count + 1))
    fi
    echo ""
else
    echo -e "${YELLOW}Skipping HIPAA database (DATABASE_HIPAA_URL not set)${NC}"
    echo ""
fi

# Financial database
if [ -n "$DATABASE_FINANCIAL_URL" ]; then
    total_count=$((total_count + 1))
    if collect_baseline "financial" "$DATABASE_FINANCIAL_URL"; then
        success_count=$((success_count + 1))
    fi
    echo ""
else
    echo -e "${YELLOW}Skipping financial database (DATABASE_FINANCIAL_URL not set)${NC}"
    echo ""
fi

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Collection Complete${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Successfully collected: ${success_count}/${total_count} databases"
echo ""

if [ $success_count -eq $total_count ] && [ $total_count -gt 0 ]; then
    echo -e "${GREEN}✓ All baselines collected successfully${NC}"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo "1. Run this script daily for 7 days"
    echo "2. Review results in: $BASELINE_DIR"
    echo "3. After 7 days, proceed to Week 2 (Analysis)"
    echo "4. See: docs/performance/QUICK_START.md"
    exit 0
else
    echo -e "${YELLOW}⚠ Some baselines failed to collect${NC}"
    echo ""
    echo -e "${BLUE}Troubleshooting:${NC}"
    echo "1. Verify database URLs are set in environment:"
    echo "   - DATABASE_URL"
    echo "   - DATABASE_HIPAA_URL"
    echo "   - DATABASE_FINANCIAL_URL"
    echo "2. Verify psql client is installed: psql --version"
    echo "3. Verify database connections: psql \$DATABASE_URL -c 'SELECT 1'"
    echo "4. Check pg_stat_statements is enabled:"
    echo "   psql \$DATABASE_URL -c 'SELECT * FROM pg_available_extensions WHERE name = \\\"pg_stat_statements\\\"'"
    exit 1
fi
