import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/demo',
  '/demo/(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/verify-request',
  '/auth/error',
  '/early-access',
  '/sms-opt-in',
  '/api/webhooks(.*)',
  '/api/email(.*)',
  '/api/test-anthropic',
  '/api/test-env',
  '/api/waitlist(.*)',
  '/api/widget(.*)',
  '/api/chat/test-simple',
  '/api/chat/wells-v2',
  '/api/quotes(.*)',
  '/api/suppliers(.*)',
  '/suppliers/join',
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
