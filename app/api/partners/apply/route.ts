/**
 * Partner Application API
 *
 * POST - Submit partner application
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { submitApplication, getPartner } from '@/lib/partners/service'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    const body = await request.json()
    const {
      name,
      email,
      phone,
      companyName,
      website,
      partnerType,
      audienceSize,
      audienceDescription,
      promotionMethods,
      monthlyTraffic,
      existingPartnerships,
    } = body

    if (!name || !email || !partnerType) {
      return NextResponse.json(
        { error: 'Name, email, and partnerType required' },
        { status: 400 }
      )
    }

    // If logged in, check if already a partner
    if (userId) {
      const existing = await getPartner(userId)
      if (existing) {
        return NextResponse.json(
          { error: 'Already a partner', partner: existing },
          { status: 409 }
        )
      }
    }

    const application = await submitApplication({
      userId: userId || undefined,
      name,
      email,
      phone,
      companyName,
      website,
      partnerType,
      audienceSize,
      audienceDescription,
      promotionMethods,
      monthlyTraffic,
      existingPartnerships,
    })

    return NextResponse.json(application, { status: 201 })
  } catch (error) {
    console.error('Application POST error:', error)
    return NextResponse.json({ error: 'Failed to submit application' }, { status: 500 })
  }
}
