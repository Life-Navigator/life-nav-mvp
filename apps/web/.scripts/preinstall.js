#!/usr/bin/env node

/**
 * Prevents npm and yarn from being used to install dependencies
 * Forces the use of pnpm
 */

if (!/pnpm/.test(process.env.npm_execpath || '')) {
  console.error('\n\x1b[31m%s\x1b[0m\n', '❌ Error: Please use pnpm to install dependencies!');
  console.error('\x1b[33m%s\x1b[0m', 'To install pnpm, run:');
  console.error('\x1b[36m%s\x1b[0m\n', '  npm install -g pnpm');
  console.error('\x1b[33m%s\x1b[0m', 'Then install dependencies with:');
  console.error('\x1b[36m%s\x1b[0m\n', '  pnpm install');
  process.exit(1);
}