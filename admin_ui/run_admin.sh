#!/bin/bash

# Life Navigator Admin UI Runner

echo "Starting Life Navigator Admin UI..."

# Activate virtual environment if it exists
if [ -d "../venv" ]; then
    source ../venv/bin/activate
fi

# Install dependencies if needed
if ! python -c "import reflex" 2>/dev/null; then
    echo "Installing dependencies..."
    pip install -r requirements.txt
fi

# Initialize Reflex if needed
if [ ! -d ".web" ]; then
    echo "Initializing Reflex..."
    reflex init
fi

# Run the app
echo "Starting admin interface on http://localhost:3000"
reflex run --loglevel info
