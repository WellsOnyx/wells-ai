import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/app(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/api/chat(.*)',
  '/api/email(.*)',
  '/api/test-anthropic(.*)',
  '/api/waitlist(.*)',
  '/sms-opt-in(.*)',
  '/early-access(.*)',
])

// Use official Clerk middleware pattern from docs
export default clerkMiddleware(async (auth, req) => {
  // Only protect routes that are NOT public
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
