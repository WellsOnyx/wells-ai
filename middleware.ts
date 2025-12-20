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
// NOTE: Grain Vault routes are public at middleware level - auth is handled client-side
// This is because Clerk dev instance doesn't work on custom domains
const isPublicRoute = createRouteMatcher([
  '/',
  '/wells-ai',
  '/grain-vault',
  '/grain-vault/(.*)',  // All grain-vault routes - auth handled client-side
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
  '/api/grain-vault/(.*)',  // Grain vault APIs - auth checked in route handlers
  '/sign-in(.*)',
  '/sign-up(.*)',
])

// API routes that should be public (no auth required)
// SECURITY: Be very careful what goes here - financial routes MUST require auth
const isPublicApiRoute = createRouteMatcher([
  '/api/suppliers/register',
  '/api/suppliers/cached',
  '/api/chat',
  '/api/webhooks/(.*)',
  '/api/health',
  '/api/coldstart/(.*)',  // Cold start uses its own auth via master key
  '/api/admin/migrate(.*)',  // Migration uses master key auth, not Clerk
  // Public read-only endpoints for listings
  '/api/rfq',  // Only GET for public RFQ listings
])

// Protected routes that require authentication
// NOTE: Grain Vault routes handle auth client-side due to Clerk domain config
// Once Clerk is configured for grainandvault.com, re-enable middleware protection
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
  // BYPASS CLERK FOR ROUTES WITH OWN AUTH
  // ========================================

  // These routes use their own authentication (master key, API key, etc.)
  // Must return early before Clerk tries to parse Authorization header
  const bypassClerkRoutes = [
    '/api/widget',
    '/api/webhooks',
    '/api/coldstart',
    '/api/admin/migrate',
    '/api/health',
  ]

  if (bypassClerkRoutes.some(route => pathname.startsWith(route))) {
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
}, (req) => {
  const host = req.headers.get('host') || ''
  const isGrainVault = GRAIN_VAULT_DOMAINS.some(domain => host.includes(domain))

  // Domain-specific paths - Clerk works directly on both domains
  if (isGrainVault) {
    return {
      signInUrl: '/grain-vault/signin',
      signUpUrl: '/grain-vault/signup',
      afterSignInUrl: '/grain-vault/dashboard',
      afterSignUpUrl: '/grain-vault/onboard',
    }
  }

  // Default Wells Onyx paths
  return {
    signInUrl: '/sign-in',
    signUpUrl: '/sign-up',
    afterSignInUrl: '/dashboard',
    afterSignUpUrl: '/onboarding',
  }
})

// ============================================================================
// CONFIG
// ============================================================================

export const config = {
  matcher: [
    // Skip Next.js internals, static files, AND routes with own auth
    '/((?!_next|api/coldstart|api/admin/migrate|api/webhooks|api/health|api/widget|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
}
