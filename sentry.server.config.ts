import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 1.0,

  // Environment
  environment: process.env.VERCEL_ENV || 'development',

  // Release tracking
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  // Configure integrations
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
  ],

  // Add custom tags for server
  beforeSend(event, hint) {
    // Add deployment info
    event.tags = {
      ...event.tags,
      deployment: process.env.VERCEL_URL || 'local',
      region: process.env.VERCEL_REGION || 'unknown',
    }

    // Add performance metrics
    if (hint.originalException instanceof Error) {
      event.contexts = {
        ...event.contexts,
        runtime: {
          name: 'node',
          version: process.version,
        },
      }
    }

    return event
  },
})
