#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const srcRoot = join(root, 'src');
const exts = new Set(['.ts', '.tsx', '.js', '.jsx']);
const violations = [];

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }

    const ext = entry.name.slice(entry.name.lastIndexOf('.'));
    if (!exts.has(ext)) continue;

    const text = readFileSync(full, 'utf8');
    const rel = relative(root, full);
    const useClient = /^\s*['"]use client['"]\s*;?/m.test(text);

    if (/NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/.test(text)) {
      violations.push(`${rel}: uses NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY (forbidden)`);
    }

    if (useClient && /process\.env\.SUPABASE_SERVICE_ROLE_KEY/.test(text)) {
      violations.push(`${rel}: client module references SUPABASE_SERVICE_ROLE_KEY`);
    }
  }
}

if (!statSync(srcRoot, { throwIfNoEntry: false })) {
  process.exit(0);
}

walk(srcRoot);

if (violations.length > 0) {
  console.error('Service-role safety check failed:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('Service-role safety check passed.');
