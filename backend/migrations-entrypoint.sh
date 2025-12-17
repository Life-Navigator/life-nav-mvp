#!/bin/bash
set -e

echo "Starting database migrations..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL environment variable is not set"
    exit 1
fi

# Run migrations in order
for migration in /app/migrations/*.sql; do
    if [ -f "$migration" ]; then
        echo "Running migration: $(basename $migration)"
        psql "$DATABASE_URL" -f "$migration" || {
            echo "Migration failed: $(basename $migration)"
            # Don't fail on already-exists errors (idempotent)
            if [ "$IGNORE_ERRORS" = "true" ]; then
                echo "Continuing due to IGNORE_ERRORS=true"
            else
                exit 1
            fi
        }
        echo "Completed: $(basename $migration)"
    fi
done

echo "All migrations completed successfully!"
