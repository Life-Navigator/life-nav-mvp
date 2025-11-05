#!/usr/bin/env bash
# ============================================================================
# GraphDB Initialization Script for Life Navigator Ontology
# ============================================================================
#
# This script initializes a GraphDB repository with the Life Navigator ontology
# and SHACL validation shapes.
#
# Prerequisites:
# - GraphDB running at http://localhost:7200
# - curl installed
# - GraphDB API token (optional, if security is enabled)
#
# Usage:
#   ./scripts/init-graphdb.sh [REPOSITORY_ID] [GRAPHDB_URL]
#
# Example:
#   ./scripts/init-graphdb.sh life-navigator http://localhost:7200
# ============================================================================

set -euo pipefail

# Configuration
REPOSITORY_ID="${1:-life-navigator}"
GRAPHDB_URL="${2:-http://localhost:7200}"
ONTOLOGY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/ontology"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Wait for GraphDB to be ready
wait_for_graphdb() {
    log_info "Waiting for GraphDB to be ready at $GRAPHDB_URL..."
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$GRAPHDB_URL/rest/repositories" > /dev/null 2>&1; then
            log_success "GraphDB is ready!"
            return 0
        fi

        log_info "GraphDB not ready yet (attempt $attempt/$max_attempts)..."
        sleep 2
        ((attempt++))
    done

    log_error "GraphDB did not become ready after $max_attempts attempts"
    return 1
}

# Create repository configuration
create_repository_config() {
    log_info "Creating repository configuration for '$REPOSITORY_ID'..."

    cat > /tmp/repo-config.ttl <<EOF
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
@prefix rep: <http://www.openrdf.org/config/repository#>.
@prefix sr: <http://www.openrdf.org/config/repository/sail#>.
@prefix sail: <http://www.openrdf.org/config/sail#>.
@prefix graphdb: <http://www.ontotext.com/config/graphdb#>.

[] a rep:Repository ;
    rep:repositoryID "$REPOSITORY_ID" ;
    rdfs:label "Life Navigator Ontology Repository" ;
    rep:repositoryImpl [
        rep:repositoryType "graphdb:SailRepository" ;
        sr:sailImpl [
            sail:sailType "graphdb:Sail" ;

            graphdb:ruleset "rdfsplus-optimized" ;
            graphdb:storage-folder "storage" ;

            graphdb:entity-index-size "10000000" ;
            graphdb:entity-id-size  "32" ;
            graphdb:imports "./ontology" ;
            graphdb:repository-type "file-repository" ;
            graphdb:base-URL "https://ln.life/ontology#" ;

            graphdb:enableContextIndex "true" ;
            graphdb:enablePredicateList "true" ;
            graphdb:in-memory-literal-properties "true" ;
            graphdb:enable-literal-index "true" ;

            graphdb:check-for-inconsistencies "false" ;
            graphdb:disable-sameAs  "true" ;
            graphdb:query-timeout  "0" ;
            graphdb:query-limit-results  "0" ;
            graphdb:throw-QueryEvaluationException-on-timeout "false" ;
            graphdb:read-only "false" ;
        ]
    ].
EOF

    log_success "Repository configuration created at /tmp/repo-config.ttl"
}

# Create repository
create_repository() {
    log_info "Creating repository '$REPOSITORY_ID'..."

    # Check if repository already exists
    if curl -f -s "$GRAPHDB_URL/rest/repositories/$REPOSITORY_ID" > /dev/null 2>&1; then
        log_warn "Repository '$REPOSITORY_ID' already exists. Skipping creation."
        return 0
    fi

    # Create repository
    local response_code=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST \
        -H "Content-Type: multipart/form-data" \
        -F "config=@/tmp/repo-config.ttl" \
        "$GRAPHDB_URL/rest/repositories")

    if [ "$response_code" = "201" ]; then
        log_success "Repository '$REPOSITORY_ID' created successfully"
    else
        log_error "Failed to create repository. HTTP status: $response_code"
        return 1
    fi
}

# Load ontology file
load_ontology_file() {
    local file="$1"
    local filename=$(basename "$file")

    log_info "Loading $filename..."

    local response_code=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST \
        -H "Content-Type: text/turtle" \
        --data-binary "@$file" \
        "$GRAPHDB_URL/repositories/$REPOSITORY_ID/statements")

    if [ "$response_code" = "204" ]; then
        log_success "Loaded $filename"
    else
        log_error "Failed to load $filename. HTTP status: $response_code"
        return 1
    fi
}

# Load all ontology files
load_ontologies() {
    log_info "Loading ontology files from $ONTOLOGY_DIR..."

    # Load core ontologies
    log_info "Loading core ontologies..."
    if [ -d "$ONTOLOGY_DIR/core" ]; then
        for file in "$ONTOLOGY_DIR/core"/*.ttl; do
            [ -f "$file" ] && load_ontology_file "$file"
        done
    fi

    # Load health domain
    log_info "Loading health domain ontologies..."
    if [ -d "$ONTOLOGY_DIR/health" ]; then
        for file in "$ONTOLOGY_DIR/health"/*.ttl; do
            [ -f "$file" ] && load_ontology_file "$file"
        done
    fi

    # Load finance domain
    log_info "Loading finance domain ontologies..."
    if [ -d "$ONTOLOGY_DIR/finance" ]; then
        for file in "$ONTOLOGY_DIR/finance"/*.ttl; do
            [ -f "$file" ] && load_ontology_file "$file"
        done
    fi

    # Load career domain
    log_info "Loading career domain ontologies..."
    if [ -d "$ONTOLOGY_DIR/career" ]; then
        for file in "$ONTOLOGY_DIR/career"/*.ttl; do
            [ -f "$file" ] && load_ontology_file "$file"
        done
    fi

    # Load education domain
    log_info "Loading education domain ontologies..."
    if [ -d "$ONTOLOGY_DIR/education" ]; then
        for file in "$ONTOLOGY_DIR/education"/*.ttl; do
            [ -f "$file" ] && load_ontology_file "$file"
        done
    fi

    # Load goals domain
    log_info "Loading goals domain ontologies..."
    if [ -d "$ONTOLOGY_DIR/goals" ]; then
        for file in "$ONTOLOGY_DIR/goals"/*.ttl; do
            [ -f "$file" ] && load_ontology_file "$file"
        done
    fi

    # Load SHACL validation shapes
    log_info "Loading SHACL validation shapes..."
    if [ -d "$ONTOLOGY_DIR/shacl" ]; then
        for file in "$ONTOLOGY_DIR/shacl"/*.ttl; do
            [ -f "$file" ] && load_ontology_file "$file"
        done
    fi

    log_success "All ontology files loaded successfully"
}

# Verify loaded data
verify_data() {
    log_info "Verifying loaded data..."

    # Count triples
    local query="SELECT (COUNT(*) as ?count) WHERE { ?s ?p ?o }"
    local count=$(curl -s -X POST \
        -H "Content-Type: application/sparql-query" \
        -H "Accept: application/sparql-results+json" \
        --data-urlencode "query=$query" \
        "$GRAPHDB_URL/repositories/$REPOSITORY_ID" | \
        grep -o '"value":"[0-9]*"' | head -1 | grep -o '[0-9]*')

    if [ -n "$count" ] && [ "$count" -gt 0 ]; then
        log_success "Repository contains $count triples"
    else
        log_warn "Repository appears to be empty or query failed"
    fi

    # List namespaces
    log_info "Listing namespaces..."
    curl -s -X GET \
        -H "Accept: application/json" \
        "$GRAPHDB_URL/repositories/$REPOSITORY_ID/namespaces" | \
        grep -o '"prefix":"[^"]*"' | sed 's/"prefix":"//;s/"$//' || true
}

# Cleanup
cleanup() {
    rm -f /tmp/repo-config.ttl
}

# Main execution
main() {
    log_info "======================================================================"
    log_info "GraphDB Initialization Script for Life Navigator"
    log_info "======================================================================"
    log_info "Repository ID: $REPOSITORY_ID"
    log_info "GraphDB URL: $GRAPHDB_URL"
    log_info "Ontology Directory: $ONTOLOGY_DIR"
    log_info "======================================================================"

    # Wait for GraphDB to be ready
    wait_for_graphdb || exit 1

    # Create repository configuration
    create_repository_config || exit 1

    # Create repository
    create_repository || exit 1

    # Small delay to ensure repository is fully initialized
    sleep 2

    # Load ontologies
    load_ontologies || exit 1

    # Verify loaded data
    verify_data

    # Cleanup
    cleanup

    log_info "======================================================================"
    log_success "GraphDB initialization completed successfully!"
    log_info "======================================================================"
    log_info "Repository: $REPOSITORY_ID"
    log_info "GraphDB Console: $GRAPHDB_URL/sparql"
    log_info "SPARQL Endpoint: $GRAPHDB_URL/repositories/$REPOSITORY_ID"
    log_info "======================================================================"
}

# Run main function
main "$@"
