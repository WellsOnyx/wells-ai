import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { monitorAPI } from '@/lib/monitoring'

/**
 * Widget Analytics & Tracking API
 * POST /api/widget/track
 *
 * Tracks widget installations, usage, and events
 */
export async function POST(req: NextRequest) {
  const monitor = monitorAPI('/api/widget/track', 'POST')

  try {
    const { event, url, apiKey: widgetKey, version, metadata } = await req.json()
    const apiKey = req.headers.get('X-Wells-Key')

    // Track the event in database
    await query(
      `INSERT INTO widget_events (api_key, event_type, url, version, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        apiKey || widgetKey || 'demo',
        event || 'unknown',
        url || '',
        version || '1.0.0',
        JSON.stringify(metadata || {}),
        req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
      ]
    )

    // Update installation stats if this is a widget_loaded event
    if (event === 'widget_loaded') {
      await query(
        `INSERT INTO widget_installations (api_key, url, version, last_seen_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (api_key, url) DO UPDATE
         SET last_seen_at = NOW(), version = $3, event_count = widget_installations.event_count + 1`,
        [apiKey || widgetKey || 'demo', url || '', version || '1.0.0']
      )
    }

    monitor.end(true)

    return NextResponse.json({
      success: true,
      tracked: event,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    monitor.end(false)
    console.error('[API] Widget tracking error:', error)

    // Don't fail widget load if tracking fails
    return NextResponse.json(
      {
        success: false,
        error: 'Tracking failed',
      },
      { status: 200 } // Return 200 so widget still works
    )
  }
}

/**
 * GET /api/widget/track/stats
 * Get widget installation and usage statistics
 */
export async function GET(req: NextRequest) {
  const monitor = monitorAPI('/api/widget/track/stats', 'GET')

  try {
    // Get installation count
    const installations = await query<{ count: string }>(
      `SELECT COUNT(DISTINCT url) as count
       FROM widget_installations
       WHERE last_seen_at > NOW() - INTERVAL '30 days'`
    )

    // Get event counts by type
    const eventCounts = await query<{ event_type: string; count: string }>(
      `SELECT event_type, COUNT(*) as count
       FROM widget_events
       WHERE created_at > NOW() - INTERVAL '30 days'
       GROUP BY event_type
       ORDER BY count DESC`
    )

    // Get top websites
    const topWebsites = await query<{ url: string; count: string }>(
      `SELECT url, event_count as count
       FROM widget_installations
       WHERE last_seen_at > NOW() - INTERVAL '30 days'
       ORDER BY event_count DESC
       LIMIT 10`
    )

    monitor.end(true)

    return NextResponse.json({
      stats: {
        activeInstallations: parseInt(installations.rows[0]?.count || '0'),
        eventCounts: eventCounts.rows.map((row) => ({
          event: row.event_type,
          count: parseInt(row.count),
        })),
        topWebsites: topWebsites.rows.map((row) => ({
          url: row.url,
          count: parseInt(row.count),
        })),
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    monitor.end(false)
    console.error('[API] Widget stats error:', error)

    return NextResponse.json(
      {
        error: 'Failed to retrieve stats',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS handler for CORS
 */
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Wells-Key',
    },
  })
}
