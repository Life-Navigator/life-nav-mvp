#!/bin/sh
set -e

echo "Starting LifeNavigator..."

# Run migrations if needed (only in staging/production)
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Running database migrations..."
  npx prisma migrate deploy
fi

# Generate Prisma Client
echo "Generating Prisma Client..."
npx prisma generate

# Start the application
echo "Starting Next.js server..."
exec "$@"