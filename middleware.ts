import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// TEMP: Disable Clerk middleware to debug MIDDLEWARE_INVOCATION_FAILED error
// Just allow all requests through for now
export default function middleware(request: NextRequest) {
  console.log('[MIDDLEWARE] Request:', request.nextUrl.pathname)
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
