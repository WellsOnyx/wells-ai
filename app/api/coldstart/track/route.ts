/**
 * Cold Start Tracking API
 *
 * Handles:
 * - Open tracking (1x1 pixel)
 * - Click tracking (redirect)
 * - Conversion tracking
 */

import { NextRequest, NextResponse } from 'next/server'
import { trackEvent, markConverted } from '@/lib/coldstart/engine'

// 1x1 transparent GIF
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const trackingId = searchParams.get('t')
    const event = searchParams.get('e') as 'open' | 'click'
    const redirect = searchParams.get('r')

    if (!trackingId) {
      return new NextResponse('Missing tracking ID', { status: 400 })
    }

    // Track the event
    if (event === 'open' || event === 'click') {
      await trackEvent(trackingId, event)
    }

    // For opens, return tracking pixel
    if (event === 'open') {
      return new NextResponse(TRACKING_PIXEL, {
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    }

    // For clicks, redirect
    if (event === 'click' && redirect) {
      const decodedUrl = decodeURIComponent(redirect)

      // If redirecting to /join, append tracking ID for conversion tracking
      if (decodedUrl.includes('/join') || decodedUrl === '/join') {
        const url = new URL(decodedUrl, request.url)
        url.searchParams.set('ref', trackingId)
        return NextResponse.redirect(url)
      }

      return NextResponse.redirect(decodedUrl)
    }

    // Default: redirect to homepage
    return NextResponse.redirect(new URL('/', request.url))
  } catch (error: any) {
    console.error('Tracking error:', error)
    // Still return pixel/redirect even on error
    return new NextResponse(TRACKING_PIXEL, {
      headers: { 'Content-Type': 'image/gif' }
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { trackingId, event } = body

    if (!trackingId) {
      return NextResponse.json({ error: 'trackingId is required' }, { status: 400 })
    }

    if (event === 'converted') {
      await markConverted(trackingId)
      return NextResponse.json({ message: 'Conversion tracked' })
    }

    if (event === 'open' || event === 'click') {
      await trackEvent(trackingId, event)
      return NextResponse.json({ message: 'Event tracked' })
    }

    return NextResponse.json({ error: 'Invalid event' }, { status: 400 })
  } catch (error: any) {
    console.error('Tracking POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
