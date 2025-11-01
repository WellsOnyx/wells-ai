import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/', // Homepage (marketing page)
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)', // Webhook endpoints
  '/api/chat(.*)', // Chat API - public access
  '/api/waitlist(.*)', // Waitlist API endpoints
  '/sms-opt-in(.*)', // SMS opt-in page
  '/early-access(.*)', // Early access waitlist page
])

// Organization-only routes (require being part of an organization)
const isOrgRoute = createRouteMatcher([
  '/org/(.*)',
  '/organizations/(.*)',
])

export default clerkMiddleware(async (auth, request) => {
  // Allow public routes
  if (isPublicRoute(request)) {
    return
  }

  // Protect all authenticated routes
  await auth.protect()

  // For organization routes, verify user has an organization
  if (isOrgRoute(request)) {
    const { orgId } = await auth()

    // If no organization, redirect to create one
    if (!orgId) {
      const createOrgUrl = new URL('/organizations/create', request.url)
      createOrgUrl.searchParams.set('redirect_url', request.url)
      return Response.redirect(createOrgUrl)
    }
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
