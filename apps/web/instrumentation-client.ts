import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://bd4b659fc3c3941c2e1762ff088fb8db@o4511072761741312.ingest.us.sentry.io/4511072765018112',

  // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
  // Learn more at https://docs.sentry.io/platforms/javascript/configuration/options/#traces-sample-rate
  tracesSampleRate: 1.0,

  // Capture Replay for 10% of all sessions, plus 100% of sessions with errors
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration(),
    Sentry.browserTracingIntegration(),
  ],

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
});
