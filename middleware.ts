/**
 * Wells Onyx Middleware
 *
 * Handles:
 * - Clerk authentication
 * - Route protection
 *
 * Domain routing (wellsonyx.io vs grainandvault.com) is handled
 * by vercel.json rewrites at the edge for better reliability.
 */

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// ============================================================================
// ROUTE MATCHERS
// ============================================================================

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/wells-ai',
  '/grain-vault',
  '/suppliers/join',
  '/suppliers/onboard',
  '/about',
  '/support',
  '/partnerships',
  '/api/webhooks/(.*)',    // Webhooks are always public
  '/api/widget/(.*)',      // Widget API is public
  '/sign-in(.*)',
  '/sign-up(.*)',
])

// API routes that should be public
const isPublicApiRoute = createRouteMatcher([
  '/api/suppliers/register',
  '/api/suppliers/cached',
  '/api/chat',            // Chat API for anonymous users
  '/api/webhooks/(.*)',
])

// Protected routes that require authentication
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/deals(.*)',
  '/settings(.*)',
  '/api/deals/(.*)',
  '/api/transactions/(.*)',
  '/api/connect/(.*)',
])

// ============================================================================
// MAIN MIDDLEWARE
// ============================================================================

export default clerkMiddleware(async (auth, request) => {
  // Skip auth check for public routes
  if (isPublicRoute(request) || isPublicApiRoute(request)) {
    return NextResponse.next()
  }

  // Protect authenticated routes
  if (isProtectedRoute(request)) {
    await auth.protect()
  }

  // Add cache control headers to prevent stale auth state
  const response = NextResponse.next()

  // Prevent caching of auth-dependent responses
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  response.headers.set('X-Clerk-Auth-Reason', 'protected-route')

  return response
}, {
  // Clerk middleware options
  signInUrl: '/sign-in',
  signUpUrl: '/sign-up',
  afterSignInUrl: '/dashboard',
  afterSignUpUrl: '/dashboard',
})

// ============================================================================
// CONFIG
// ============================================================================

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
