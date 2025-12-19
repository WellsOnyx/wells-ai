/**
 * Wells Onyx + Grain & Vault Middleware
 *
 * Handles:
 * - Domain-based routing (wellsonyx.io vs grainandvault.com)
 * - Clerk authentication
 * - Route protection
 */

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse, NextRequest } from 'next/server'

// ============================================================================
// DOMAIN ROUTING
// ============================================================================

const GRAIN_VAULT_DOMAINS = [
  'grainandvault.com',
  'www.grainandvault.com',
  'grainandvault.vercel.app',
]

function isGrainVaultDomain(host: string): boolean {
  return GRAIN_VAULT_DOMAINS.some(domain => host.includes(domain))
}

// ============================================================================
// ROUTE MATCHERS
// ============================================================================

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/wells-ai',
  '/grain-vault',
  '/grain-vault/demo',
  '/grain-vault/signup(.*)',
  '/grain-vault/signin(.*)',
  '/grain-vault/onboarding',
  '/demo',
  '/onboarding',
  '/suppliers/join',
  '/suppliers/onboard',
  '/about',
  '/support',
  '/partnerships',
  '/api/webhooks/(.*)',
  '/api/widget/(.*)',
  '/api/onboarding/(.*)',
  '/api/grain-vault/(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
])

// API routes that should be public
const isPublicApiRoute = createRouteMatcher([
  '/api/suppliers/register',
  '/api/suppliers/cached',
  '/api/chat',
  '/api/webhooks/(.*)',
  '/api/webhooks/circle',
  '/api/health',
  '/api/admin/(.*)',
  '/api/seller/(.*)',
  '/api/buyer/(.*)',
  '/api/rfq/(.*)',
  '/api/jobs/(.*)',
  '/api/worker/(.*)',
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

export default clerkMiddleware(async (auth, request: NextRequest) => {
  const host = request.headers.get('host') || ''
  const pathname = request.nextUrl.pathname

  // ========================================
  // WIDGET API - BYPASS ALL AUTH (CORS-SAFE)
  // ========================================

  // Widget routes need to work cross-origin without any redirects
  if (pathname.startsWith('/api/widget')) {
    return NextResponse.next()
  }

  // ========================================
  // DOMAIN-BASED ROUTING FOR GRAINANDVAULT.COM
  // ========================================

  if (isGrainVaultDomain(host)) {
    // Routes that should be rewritten to /grain-vault/* on grainandvault.com
    const grainVaultRoutes = ['/', '/demo', '/signup', '/signin', '/onboarding']

    // Check if this is a route that needs rewriting
    if (grainVaultRoutes.includes(pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = pathname === '/' ? '/grain-vault' : `/grain-vault${pathname}`
      return NextResponse.rewrite(url)
    }

    // Also rewrite /api/health for grainandvault.com
    if (pathname === '/api/health') {
      // Health endpoint works fine, just allow it
      return NextResponse.next()
    }
  }

  // ========================================
  // AUTHENTICATED USER REDIRECT
  // ========================================

  // Skip authenticated user redirects - let users see the landing page
  // Authentication will be handled by individual protected routes

  // ========================================
  // AUTHENTICATION
  // ========================================

  // Skip auth check for public routes
  if (isPublicRoute(request) || isPublicApiRoute(request)) {
    return NextResponse.next()
  }

  // Protect authenticated routes
  if (isProtectedRoute(request)) {
    await auth.protect()
  }

  // Add cache control headers
  const response = NextResponse.next()
  response.headers.set('Cache-Control', 'no-store, max-age=0')

  return response
}, {
  signInUrl: '/sign-in',
  signUpUrl: '/sign-up',
  afterSignInUrl: '/dashboard',
  afterSignUpUrl: '/onboarding',
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
