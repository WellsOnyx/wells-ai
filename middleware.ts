import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''

  // Handle root path routing based on domain
  if (request.nextUrl.pathname === '/') {
    // If grainandvault.com, show Grain & Vault landing
    if (hostname.includes('grainandvault.com')) {
      return NextResponse.rewrite(new URL('/grain-vault', request.url))
    }

    // For all other domains (wellsai.com, etc), show Wells AI landing
    return NextResponse.rewrite(new URL('/wells-ai', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/',
}
