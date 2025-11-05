#!/bin/bash

# This script initializes the database for Life Navigator

echo "Starting database initialization..."

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Create the initial migration
echo "Creating initial migration..."
npx prisma migrate dev --name init

# Seed the database
echo "Seeding database with initial data..."
npm run db:seed

echo "Database initialization completed!"