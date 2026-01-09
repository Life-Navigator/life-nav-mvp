#!/bin/bash
# Scenario Lab - Step 8 Setup Script
# Run this to install dependencies and prepare for testing

set -e

echo "🚀 Scenario Lab Step 8 - Setup Script"
echo "======================================="
echo ""

# Navigate to web app
cd apps/web

echo "📦 Installing dependencies..."
pnpm add tesseract.js pdf-parse
pnpm add -D @types/pdf-parse @types/node

echo ""
echo "✅ Dependencies installed!"
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "⚠️  .env.local not found. Creating template..."
    cat > .env.local << 'EOF'
# Scenario Lab Feature Flags
FEATURE_SCENARIO_LAB_ENABLED=true
NEXT_PUBLIC_FEATURE_SCENARIO_LAB_ENABLED=true

# Worker Configuration
SCENARIO_WORKER_POLL_INTERVAL_MS=5000
SCENARIO_WORKER_MAX_CONCURRENT_JOBS=3

# Supabase (add your actual credentials)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
EOF
    echo "✅ Created .env.local template. Please update with your Supabase credentials."
else
    echo "✅ .env.local already exists. Checking for required variables..."

    # Check if feature flags are set
    if ! grep -q "FEATURE_SCENARIO_LAB_ENABLED" .env.local; then
        echo "" >> .env.local
        echo "# Scenario Lab Feature Flags" >> .env.local
        echo "FEATURE_SCENARIO_LAB_ENABLED=true" >> .env.local
        echo "NEXT_PUBLIC_FEATURE_SCENARIO_LAB_ENABLED=true" >> .env.local
        echo "✅ Added feature flags to .env.local"
    fi

    # Check if worker config is set
    if ! grep -q "SCENARIO_WORKER_POLL_INTERVAL_MS" .env.local; then
        echo "" >> .env.local
        echo "# Worker Configuration" >> .env.local
        echo "SCENARIO_WORKER_POLL_INTERVAL_MS=5000" >> .env.local
        echo "SCENARIO_WORKER_MAX_CONCURRENT_JOBS=3" >> .env.local
        echo "✅ Added worker configuration to .env.local"
    fi
fi

echo ""
echo "📊 Checking Supabase migrations..."

# Check if migrations exist
if [ -f "supabase/migrations/005_scenario_lab_schema.sql" ]; then
    echo "✅ Migration 005 found"
else
    echo "❌ Migration 005 NOT found. Please ensure migrations are present."
fi

if [ -f "supabase/migrations/006_scenario_lab_rls.sql" ]; then
    echo "✅ Migration 006 found"
else
    echo "❌ Migration 006 NOT found. Please ensure migrations are present."
fi

if [ -f "supabase/migrations/007_scenario_lab_storage.sql" ]; then
    echo "✅ Migration 007 found"
else
    echo "❌ Migration 007 NOT found. Please ensure migrations are present."
fi

echo ""
echo "======================================="
echo "🎉 Setup Complete!"
echo "======================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Apply Supabase migrations:"
echo "   cd apps/web"
echo "   supabase db push"
echo ""
echo "2. Start the development server:"
echo "   pnpm dev"
echo ""
echo "3. Start the worker (in a separate terminal):"
echo "   cd apps/web"
echo "   npx tsx src/workers/scenario-lab-worker.ts"
echo ""
echo "4. Navigate to:"
echo "   http://localhost:3000/dashboard/scenario-lab"
echo ""
echo "5. Follow the QA test script:"
echo "   See SCENARIO_LAB_STEP8_QA.md"
echo ""
echo "📚 Documentation:"
echo "   - SCENARIO_LAB_STEP8_COMPLETE.md - Full implementation details"
echo "   - SCENARIO_LAB_STEP8_QA.md - Test script"
echo "   - SCENARIO_LAB_PROGRESS.md - Overall progress"
echo ""
