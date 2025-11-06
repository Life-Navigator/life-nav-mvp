#!/bin/bash
# Script to create "Coming Soon" placeholders only for unfinished pages

set -e

echo "🔧 Creating placeholders for unfinished pages..."

# Create placeholders directory
mkdir -p placeholders

# Create a reusable "Coming Soon" component
cat > placeholders/ComingSoon.tsx << 'EOF'
"use client";

import React from 'react';
import Link from 'next/link';

export default function ComingSoon() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
      <div className="w-20 h-20 mb-8 flex items-center justify-center rounded-full bg-blue-100 text-blue-600">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      </div>
      
      <h1 className="text-3xl font-bold mb-4">Coming Soon</h1>
      <p className="mb-8 text-lg text-gray-600 dark:text-gray-400 max-w-md">
        We're working hard to bring you this feature. Please check back soon!
      </p>
      
      <Link 
        href="/dashboard"
        className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}
EOF

# Define the incomplete pages that need placeholders
# Each entry is "source_file:placeholder_text"
INCOMPLETE_PAGES=(
  "src/app/dashboard/career/networking/page.tsx:Career Networking"
  "src/app/dashboard/career/opportunities/page.tsx:Career Opportunities"
  "src/app/dashboard/education/certifications/page.tsx:Education Certifications"
  "src/app/dashboard/education/progress/page.tsx:Education Progress"
  "src/app/dashboard/finance/assets/page.tsx:Financial Assets"
  "src/app/dashboard/finance/investment-calculator/page.tsx:Investment Calculator"
  "src/app/dashboard/finance/tax/page.tsx:Tax Planning"
  "src/app/dashboard/healthcare/preventive/page.tsx:Preventive Healthcare"
  "src/app/dashboard/healthcare/wellness/page.tsx:Wellness Center"
  "src/app/dashboard/insights/page.tsx:Insights"
  "src/app/dashboard/roadmap/comprehensive/page.tsx:Comprehensive Roadmap"
)

# Create placeholders for incomplete pages
for item in "${INCOMPLETE_PAGES[@]}"; do
  # Parse the item
  IFS=':' read -r file_path page_title <<< "$item"
  
  # Ensure directory exists
  mkdir -p "$(dirname "$file_path")"
  
  # Create backup if file exists and is not a placeholder already
  if [ -f "$file_path" ] && ! grep -q "ComingSoon" "$file_path"; then
    echo "Creating backup of $file_path"
    cp "$file_path" "${file_path}.backup"
  fi
  
  # Create placeholder page
  cat > "$file_path" << EOF
"use client";

import ComingSoon from '../../../../placeholders/ComingSoon';

export default function ${page_title//[^a-zA-Z0-9]/}Page() {
  return <ComingSoon />;
}
EOF

  echo "Created placeholder for $file_path"
done

echo "✅ Placeholders created successfully!"
echo "You can now build and deploy the application with placeholders for unfinished pages."