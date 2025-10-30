import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 1.0,

  // Environment
  environment: process.env.VERCEL_ENV || 'development',

  // Release tracking
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  // Edge-specific configuration
  beforeSend(event, hint) {
    event.tags = {
      ...event.tags,
      runtime: 'edge',
      region: process.env.VERCEL_REGION || 'unknown',
    }
    return event
  },
})
