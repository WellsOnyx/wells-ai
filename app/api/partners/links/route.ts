/**
 * Partner Links API
 *
 * GET  - Get partner's custom links
 * POST - Create a new custom link
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getPartner, getPartnerLinks, createPartnerLink } from '@/lib/partners/service'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const partner = await getPartner(userId)
    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
    }

    const links = await getPartnerLinks(partner.id)
    return NextResponse.json({ links })
  } catch (error) {
    console.error('Links GET error:', error)
    return NextResponse.json({ error: 'Failed to get links' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const partner = await getPartner(userId)
    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
    }

    if (partner.status !== 'active') {
      return NextResponse.json({ error: 'Partner not active' }, { status: 403 })
    }

    const body = await request.json()
    const { name, slug, destinationUrl, utmSource, utmMedium, utmCampaign } = body

    if (!name || !slug || !destinationUrl) {
      return NextResponse.json({ error: 'Name, slug, and destinationUrl required' }, { status: 400 })
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: 'Slug must contain only lowercase letters, numbers, and hyphens' },
        { status: 400 }
      )
    }

    const link = await createPartnerLink(
      partner.id,
      name,
      slug,
      destinationUrl,
      { source: utmSource, medium: utmMedium, campaign: utmCampaign }
    )

    return NextResponse.json(link, { status: 201 })
  } catch (error: unknown) {
    console.error('Link POST error:', error)
    if (error instanceof Error && error.message?.includes('duplicate')) {
      return NextResponse.json({ error: 'Slug already taken' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create link' }, { status: 500 })
  }
}
