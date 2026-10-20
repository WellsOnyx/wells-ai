/**
 * Wells Onyx + Grain & Vault Middleware
 *
 * Handles:
 * - Domain-based routing (wellsonyx.io vs grainandvault.com)
 * - Clerk authentication
 * - Route protection
 * - User onboarding flow routing
 */

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse, NextRequest, type NextFetchEvent } from 'next/server'

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
  '/join',              // Unified signup
  '/join/(.*)',         // Join with invite codes
  '/onboarding',
  '/onboarding/(.*)',
  '/suppliers/join',
  '/suppliers/onboard',
  '/about',
  '/support',
  '/partnerships',
  '/api/webhooks/(.*)',
  '/api/widget/(.*)',
  '/api/onboarding/(.*)',
  '/api/join/(.*)',     // Join API routes
  '/api/grain-vault/(.*)',  // Grain vault APIs - auth checked in route handlers
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/signup(.*)',
  '/agent',
  '/grain/(.*)',
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

function clerkKeysPresent(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY)
}

async function routeRequest(
  request: NextRequest,
  protect?: () => Promise<unknown>,
): Promise<NextResponse> {
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
    // Redirect /dashboard to unified dashboard with treasury journey
    if (pathname === '/dashboard' || pathname === '/grain-vault/dashboard') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      url.searchParams.set('journey', 'treasury')
      return NextResponse.redirect(url)
    }

    // UNIFIED EXPERIENCE: Both domains serve the same content
    // No longer rewrite root to /grain-vault - both domains use /app/page.tsx
    // The /grain-vault route still exists for direct navigation

    // Also rewrite /api/health for grainandvault.com
    if (pathname === '/api/health') {
      // Health endpoint works fine, just allow it
      return NextResponse.next()
    }
  }

  // Redirect old grain-vault/dashboard to unified dashboard (for any domain)
  if (pathname === '/grain-vault/dashboard') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.searchParams.set('journey', 'treasury')
    return NextResponse.redirect(url)
  }

  // ========================================
  // UNIFIED AUTH FLOW - All signup goes to /join
  // Both wellsonyx.io and grainandvault.com use the same /join page
  // The page auto-detects domain and applies correct theming
  // ========================================

  // Redirect grain-vault auth to unified flow
  if (pathname === '/grain-vault/signin' || pathname === '/grain-vault/signup') {
    const url = request.nextUrl.clone()
    url.pathname = '/join'
    // Preserve that they came from treasury flow
    url.searchParams.set('journey', 'treasury')
    return NextResponse.redirect(url)
  }

  // Redirect ALL legacy signup paths to unified /join
  // Domain detection happens client-side in the /join page
  if (pathname === '/signup' || pathname === '/sign-up' || pathname.startsWith('/sign-up/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/join'
    // If from Grain & Vault domain, add treasury journey
    if (isGrainVaultDomain(host)) {
      url.searchParams.set('journey', 'treasury')
    }
    return NextResponse.redirect(url)
  }

  // Redirect /onboarding to /join if not authenticated
  // (The join flow is now the complete onboarding)
  if (pathname === '/onboarding' && !isGrainVaultDomain(host)) {
    // Let middleware auth handle this - only redirect if needed
    // The /join page handles the full onboarding flow now
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

  // Protect authenticated routes. Without Clerk keys, refuse them
  // instead of letting clerkMiddleware throw before any page renders.
  if (isProtectedRoute(request)) {
    if (protect) {
      await protect()
    } else if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    } else {
      const url = request.nextUrl.clone()
      url.pathname = '/sign-in'
      return NextResponse.redirect(url)
    }
  }

  // Add cache control headers
  const response = NextResponse.next()
  response.headers.set('Cache-Control', 'no-store, max-age=0')

  return response
}

const withClerk = clerkMiddleware(async (auth, request: NextRequest) => {
  return routeRequest(request, () => auth.protect())
}, (req) => {
  const host = req.headers.get('host') || ''
  const isGrainVault = GRAIN_VAULT_DOMAINS.some(domain => host.includes(domain))

  // Unified auth flow - all domains use /join for signup, /sign-in for signin
  // After auth, route based on domain
  if (isGrainVault) {
    return {
      signInUrl: '/sign-in',
      signUpUrl: '/join?journey=treasury',
      afterSignInUrl: '/dashboard?journey=treasury',
      afterSignUpUrl: '/dashboard?journey=treasury',
    }
  }

  // Default Wells Onyx paths - unified flow
  return {
    signInUrl: '/sign-in',
    signUpUrl: '/join',
    afterSignInUrl: '/dashboard',
    afterSignUpUrl: '/dashboard',
  }
})

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (!clerkKeysPresent()) {
    return routeRequest(request)
  }
  return withClerk(request, event)
}

// ============================================================================
// CONFIG
// ============================================================================

export const config = {
  matcher: [
    // Skip Next.js internals, static files, AND routes with own auth
    '/((?!_next|api/coldstart|api/admin/migrate|api/webhooks|api/health|api/widget|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
}
