module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  extends: [
    'eslint:recommended',
  ],
  rules: {
    // Disable rules that might conflict with TypeScript
    'no-unused-vars': 'off',
    'no-undef': 'off',

    // ===========================================================================
    // DEPLOYMENT BOUNDARY ENFORCEMENT (Pre-Production Hardening)
    // ===========================================================================
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['backend/app/**', 'backend/**'],
            message:
              '❌ DEPLOYMENT BOUNDARY VIOLATION: Web app cannot import server-only backend code. Use API clients from packages/api-client instead.',
          },
          {
            group: ['services/**/app/**', 'services/**'],
            message:
              '❌ DEPLOYMENT BOUNDARY VIOLATION: Web app cannot import internal service code. Services are private and communicate via S2S JWT only.',
          },
          {
            group: ['**/node_modules/@prisma/client'],
            message:
              '❌ SECURITY VIOLATION: Direct database access is forbidden in client code. Use API routes (/api/*) instead.',
          },
        ],
      },
    ],

  },
  overrides: [
    {
      // Server-side code (API routes) can import backend
      files: [
        'apps/web/app/api/**/*.ts',
        'apps/web/src/app/api/**/*.ts',
        'apps/web/pages/api/**/*.ts',
      ],
      rules: {
        'no-restricted-imports': 'off',
      },
    },
    {
      // Packages have stricter boundaries
      files: ['packages/**/*.ts', 'packages/**/*.tsx'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['apps/**'],
                message: '❌ Shared packages cannot depend on apps (circular dependency)',
              },
              {
                group: ['services/**'],
                message: '❌ Shared packages cannot depend on services (deployment coupling)',
              },
            ],
          },
        ],
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    '.next/',
    'coverage/',
    '*.config.js',
    '*.config.ts',
  ],
};
