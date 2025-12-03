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
  '/sign-in(.*)',
  '/sign-up(.*)',
])

// API routes that should be public
const isPublicApiRoute = createRouteMatcher([
  '/api/suppliers/register',
  '/api/suppliers/cached',
  '/api/chat',
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

export default clerkMiddleware(async (auth, request: NextRequest) => {
  const host = request.headers.get('host') || ''
  const pathname = request.nextUrl.pathname

  // ========================================
  // DOMAIN-BASED ROUTING
  // ========================================

  // If accessing grainandvault.com at root, rewrite to /grain-vault
  if (isGrainVaultDomain(host) && pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/grain-vault'
    return NextResponse.rewrite(url)
  }

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
  afterSignInUrl: '/onboarding',
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
