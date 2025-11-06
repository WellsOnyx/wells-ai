import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

// Public routes that don't require authentication
const publicRoutes = [
  '/',
  '/sign-in',
  '/verify-request',
  '/auth/error',
  '/early-access',
  '/sms-opt-in',
]

// API routes that are public
const publicApiRoutes = [
  '/api/auth',
  '/api/webhooks',
  '/api/email',
  '/api/test-anthropic',
  '/api/waitlist',
]

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl

    // Allow public routes
    if (publicRoutes.some(route => pathname === route || pathname.startsWith(route))) {
      return NextResponse.next()
    }

    // Allow public API routes
    if (publicApiRoutes.some(route => pathname.startsWith(route))) {
      return NextResponse.next()
    }

    // All other routes require authentication (handled by withAuth)
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        const { pathname } = req.nextUrl

        // Check if route is public
        if (publicRoutes.some(route => pathname === route || pathname.startsWith(route))) {
          return true
        }

        // Check if API route is public
        if (publicApiRoutes.some(route => pathname.startsWith(route))) {
          return true
        }

        // For all other routes, require authentication
        return !!token
      },
    },
    pages: {
      signIn: '/sign-in',
    },
  }
)

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
