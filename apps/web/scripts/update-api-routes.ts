/**
 * Script to update API routes to use the secure handlers
 * 
 * This script provides templates and instructions for updating
 * existing API routes to use the new secure handlers pattern.
 * 
 * Usage:
 * 1. Run with ts-node: npx ts-node scripts/update-api-routes.ts
 * 2. Follow the prompts to select which route patterns to update
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Base directory for API routes
const API_ROUTES_DIR = path.resolve(__dirname, '../src/app/api');

// Template for a route file using secure handlers
function generateRouteTemplate(methods: string[], requiresSetup: boolean = true) {
  const methodHandlers = methods.map(method => 
    `async function ${method.toLowerCase()}Handler(request: NextRequest) {
  try {
    // User is guaranteed to be available by withAuth middleware
    const userId = (request as any).user.id;
    
    // Your handler implementation...
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in ${method.toLowerCase()}Handler:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}`).join('\n\n');

  const exportStatement = `export const { ${methods.join(', ')} } = createSecureHandlers(
  { ${methods.map(m => `${m}: ${m.toLowerCase()}Handler`).join(', ')} },
  { requireSetupComplete: ${requiresSetup} }
);`;

  return `import { NextRequest, NextResponse } from 'next/server';
import { createSecureHandlers } from '@/lib/auth/route-helpers';

${methodHandlers}

${exportStatement}`;
}

/**
 * Find all API route files
 */
async function findApiRoutes() {
  try {
    const files = await glob('**/route.ts', { cwd: API_ROUTES_DIR });
    return files.map(file => path.join(API_ROUTES_DIR, file));
  } catch (error) {
    console.error('Error finding API routes:', error);
    return [];
  }
}

/**
 * Determine HTTP methods used in a route file
 */
function detectHttpMethods(fileContent: string): string[] {
  const methods = [];
  if (fileContent.includes('export async function GET')) methods.push('GET');
  if (fileContent.includes('export async function POST')) methods.push('POST');
  if (fileContent.includes('export async function PUT')) methods.push('PUT');
  if (fileContent.includes('export async function DELETE')) methods.push('DELETE');
  if (fileContent.includes('export async function PATCH')) methods.push('PATCH');
  return methods;
}

/**
 * Check if a route is an auth or onboarding route
 */
function isAuthOrOnboardingRoute(filePath: string): boolean {
  return filePath.includes('/api/auth/') || filePath.includes('/api/onboarding/');
}

/**
 * Main function to run the script
 */
async function main() {
  try {
    const routes = await findApiRoutes();
    console.log(`Found ${routes.length} API routes.`);

    console.log('\nThis script will help you update your API routes to use the secure handlers pattern.');
    console.log('For each route, it will:');
    console.log('1. Detect the HTTP methods used');
    console.log('2. Determine if it\'s an auth/onboarding route');
    console.log('3. Generate a template for using secure handlers');
    console.log('\nYou\'ll need to manually update the handler implementations.\n');

    for (const route of routes) {
      // Skip if the route already uses secure handlers
      const content = fs.readFileSync(route, 'utf8');
      if (content.includes('createSecureHandlers') || content.includes('withAuth')) {
        console.log(`✓ ${route} - Already using secure handlers`);
        continue;
      }

      const methods = detectHttpMethods(content);
      const isAuthRoute = isAuthOrOnboardingRoute(route);
      const relativePath = path.relative(process.cwd(), route);

      console.log(`\n--- ${relativePath} ---`);
      console.log(`Methods: ${methods.join(', ')}`);
      console.log(`Auth/Onboarding Route: ${isAuthRoute ? 'Yes' : 'No'}`);

      const template = generateRouteTemplate(methods, !isAuthRoute);
      
      console.log('\nTemplate to use:');
      console.log('='.repeat(80));
      console.log(template);
      console.log('='.repeat(80));
      
      console.log('\nNext steps:');
      console.log('1. Copy the handler logic from the existing implementations');
      console.log('2. Update to use (request as any).user instead of session.user');
      console.log('3. Replace the file content with the updated version');
      
      await new Promise<void>((resolve) => {
        rl.question('\nPress Enter to continue to the next route...', () => {
          resolve();
        });
      });
    }

    console.log('\nAll routes processed!');
    console.log('Remember to test each route after updating.');
    rl.close();
  } catch (error) {
    console.error('Error running script:', error);
    rl.close();
  }
}

// Run the script
main();