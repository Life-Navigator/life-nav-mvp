#!/bin/bash
# Runner script for database seeding
# Activates virtual environment and runs the seeding script

set -e  # Exit on error

echo "================================"
echo "Life Navigator - Demo User Seeder"
echo "================================"
echo ""

# Check if we're in the right directory
if [ ! -f "pyproject.toml" ]; then
    echo "Error: Must run from services/api directory"
    exit 1
fi

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    echo "Activating virtual environment..."
    source venv/bin/activate
elif [ -d ".venv" ]; then
    echo "Activating virtual environment..."
    source .venv/bin/activate
else
    echo "Warning: No virtual environment found. Assuming dependencies are installed globally."
fi

# Set PYTHONPATH to include app directory
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# Run the seeding script
echo "Running demo user seeder..."
python3 scripts/seed_demo_user.py

echo ""
echo "================================"
echo "Seeding complete!"
echo "================================"
