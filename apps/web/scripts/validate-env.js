#!/usr/bin/env node
/**
 * Environment validation script
 * 
 * This script validates that all required environment variables are set
 * and have appropriate values. Run it during build or startup to prevent
 * runtime issues due to missing configuration.
 */

// Skip validation if SKIP_ENV_VALIDATION is set (for static builds)
if (process.env.SKIP_ENV_VALIDATION === 'true') {
  console.log('⏩ Skipping environment validation due to SKIP_ENV_VALIDATION=true');
  process.exit(0);
}

// Define environment variables to check
const requiredVars = [
  {
    name: 'DATABASE_URL',
    required: true,
    validator: (value) => value && (value.startsWith('postgresql://') || value.startsWith('sqlite:')),
    message: 'Must be a valid PostgreSQL or SQLite connection string'
  },
  {
    name: 'NEXTAUTH_SECRET',
    required: true,
    validator: (value) => value && value.length >= 32,
    message: 'Must be at least 32 characters long'
  },
  {
    name: 'NEXTAUTH_URL',
    required: true,
    validator: (value) => value && (value.startsWith('http://') || value.startsWith('https://')),
    message: 'Must be a valid URL starting with http:// or https://'
  },
  {
    name: 'ENCRYPTION_MASTER_KEY',
    required: process.env.ENABLE_FIELD_ENCRYPTION === 'true',
    validator: (value) => value && value.length >= 32,
    message: 'Must be at least 32 characters long when field encryption is enabled'
  },
  {
    name: 'NODE_ENV',
    required: false,
    validator: (value) => ['development', 'production', 'test'].includes(value),
    message: 'Must be one of: development, production, test'
  }
];

// Optional variables that should be validated if present
const optionalVars = [
  {
    name: 'DOCUMENT_ENCRYPTION_KEY',
    validator: (value) => value && value.length >= 32,
    message: 'Must be at least 32 characters long if provided'
  },
  {
    name: 'AWS_ACCESS_KEY_ID',
    validator: (value) => value && value.length > 0,
    message: 'Must be provided if using AWS services'
  },
  {
    name: 'AWS_SECRET_ACCESS_KEY',
    validator: (value) => value && value.length > 0,
    message: 'Must be provided if using AWS services'
  }
];

// Check if we're in a production environment
const isProduction = process.env.NODE_ENV === 'production';

// Validation function
function validateEnv() {
  let hasErrors = false;
  let warnings = [];

  console.log('Validating environment variables...');

  // Check required variables
  for (const { name, required, validator, message } of requiredVars) {
    const value = process.env[name];
    
    // Check if variable is required and missing
    if (required && (value === undefined || value === '')) {
      console.error(`❌ Error: Required environment variable ${name} is missing.`);
      hasErrors = true;
      continue;
    }
    
    // If value exists but fails validation
    if (value !== undefined && value !== '' && validator && !validator(value)) {
      console.error(`❌ Error: Environment variable ${name} is invalid. ${message}`);
      hasErrors = true;
    }
  }

  // Check optional variables
  for (const { name, validator, message } of optionalVars) {
    const value = process.env[name];
    
    // If value exists but fails validation
    if (value !== undefined && value !== '' && validator && !validator(value)) {
      if (isProduction) {
        console.error(`❌ Error: Environment variable ${name} is invalid. ${message}`);
        hasErrors = true;
      } else {
        console.warn(`⚠️  Warning: Environment variable ${name} is invalid. ${message}`);
        warnings.push(name);
      }
    }
  }

  // Specific production checks
  if (isProduction) {
    // HTTPS should be used in production
    if (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.startsWith('https://')) {
      console.error('❌ Error: NEXTAUTH_URL should use HTTPS in production environments.');
      hasErrors = true;
    }
    
    // Field encryption should be enabled in production
    if (process.env.ENABLE_FIELD_ENCRYPTION !== 'true') {
      console.error('❌ Error: Field encryption should be enabled in production environments.');
      hasErrors = true;
    }
  }

  // Summary
  if (hasErrors) {
    console.error('\n❌ Environment validation failed. Please fix the issues above before continuing.');
    process.exit(1);
  } else if (warnings.length > 0) {
    console.warn(`\n⚠️  Environment validation passed with ${warnings.length} warnings.`);
    console.log('Application will continue, but these issues should be addressed.');
  } else {
    console.log('\n✅ Environment validation passed successfully.');
  }
}

// Run validation
validateEnv();