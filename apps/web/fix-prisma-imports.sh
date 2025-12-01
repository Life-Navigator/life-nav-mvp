#!/bin/bash

# Find all files that create new PrismaClient instances and fix them
find src/app/api -name "*.ts" -type f | while read file; do
  if grep -q "new PrismaClient()" "$file"; then
    echo "Fixing: $file"
    
    # Replace the import and instantiation
    sed -i 's/import { PrismaClient } from .@prisma\/client.;/import { db as prisma } from '\''@\/lib\/db'\'';/' "$file"
    sed -i '/^const prisma = new PrismaClient();/d' "$file"
    sed -i '/^const prisma = new PrismaClient()/d' "$file"
  fi
done

echo "Done! Fixed all PrismaClient imports."
