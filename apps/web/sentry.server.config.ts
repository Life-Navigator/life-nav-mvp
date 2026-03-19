import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://bd4b659fc3c3941c2e1762ff088fb8db@o4511072761741312.ingest.us.sentry.io/4511072765018112',

  // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
  tracesSampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
});
