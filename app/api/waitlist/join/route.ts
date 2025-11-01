import { NextRequest, NextResponse } from 'next/server'
import { createNotionClient } from '@/lib/notion'

// Generate a unique 8-character invite code
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Removed similar looking chars
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export async function POST(req: NextRequest) {
  try {
    const { email, inviteCode } = await req.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      )
    }

    // REQUIRE invite code - no organic signups
    if (!inviteCode) {
      return NextResponse.json(
        { error: 'Wells AI is invite-only. Please use an invite link to join the waitlist.' },
        { status: 403 }
      )
    }

    const waitlistDbId = process.env.NOTION_WAITLIST_DATABASE_ID

    // Founder invite codes (unlimited uses)
    const FOUNDER_CODES = ['WELLS2025', 'JONAH', 'ONYX']
    const isFounderCode = FOUNDER_CODES.includes(inviteCode.toUpperCase())

    // If Notion isn't configured, just log to console and return success
    if (!waitlistDbId) {
      console.log('[WAITLIST] New signup:', email, `(invited by ${inviteCode})`)

      // Generate a new invite code for this person
      const newInviteCode = generateInviteCode()

      return NextResponse.json({
        success: true,
        position: 1,
        totalSignups: 1,
        inviteCode: newInviteCode,
        invitesRemaining: 3,
        message: isFounderCode ? "Welcome to Wells AI! You're in." : "You're on the list!"
      })
    }

    const notion = createNotionClient()

    // Check if email already exists
    // @ts-ignore - Notion SDK types issue
    const existingResponse = await notion.databases.query({
      database_id: waitlistDbId,
      filter: {
        property: 'Email',
        email: {
          equals: email
        }
      }
    })

    if (existingResponse.results.length > 0) {
      const existing = existingResponse.results[0] as any
      return NextResponse.json(
        { error: "You're already on the waitlist!" },
        { status: 400 }
      )
    }

    // If invite code provided, validate it and track referral
    let referredBy = null
    let priority = false

    if (isFounderCode) {
      // Founder codes give priority and don't track usage
      priority = true
    } else {
      // Regular invite code - validate and track
      // @ts-ignore - Notion SDK types issue
      const inviterResponse = await notion.databases.query({
        database_id: waitlistDbId,
        filter: {
          property: 'Invite Code',
          rich_text: {
            equals: inviteCode
          }
        }
      })

      if (inviterResponse.results.length === 0) {
        return NextResponse.json(
          { error: 'Invalid invite code. Please check your invite link and try again.' },
          { status: 400 }
        )
      }

      const inviter = inviterResponse.results[0] as any
      const invitesUsed = inviter.properties['Invites Used']?.number || 0

      if (invitesUsed >= 3) {
        return NextResponse.json(
          { error: 'This invite code has reached its limit. Ask your friend for a new code!' },
          { status: 400 }
        )
      }

      referredBy = inviterResponse.results[0].id
      priority = true

      // Update inviter's invites used count
      await notion.pages.update({
        page_id: inviterResponse.results[0].id,
        properties: {
          'Invites Used': {
            number: invitesUsed + 1
          }
        }
      })
    }

    // Get current waitlist count for position
    // @ts-ignore - Notion SDK types issue
    const allSignups = await notion.databases.query({
      database_id: waitlistDbId
    })

    const position = priority
      ? Math.max(1, Math.floor(allSignups.results.length / 4)) // Jump to top 25%
      : allSignups.results.length + 1

    // Generate unique invite code for this user
    const newInviteCode = generateInviteCode()

    // Create waitlist entry
    const page = await notion.pages.create({
      parent: { database_id: waitlistDbId },
      properties: {
        'Email': {
          email: email
        },
        'Invite Code': {
          rich_text: [{
            text: { content: newInviteCode }
          }]
        },
        'Position': {
          number: position
        },
        'Invites Remaining': {
          number: 3
        },
        'Invites Used': {
          number: 0
        },
        'Referred By': referredBy ? {
          relation: [{ id: referredBy }]
        } : undefined,
        'Status': {
          select: { name: priority ? 'Priority' : 'Waiting' }
        },
        'Joined Date': {
          date: { start: new Date().toISOString() }
        }
      } as any
    })

    return NextResponse.json({
      success: true,
      position,
      totalSignups: allSignups.results.length + 1,
      inviteCode: newInviteCode,
      invitesRemaining: 3,
      message: priority
        ? "Welcome! You've been bumped up in line."
        : "You're on the list!"
    })

  } catch (error) {
    console.error('Waitlist signup error:', error)
    return NextResponse.json(
      { error: 'Failed to join waitlist. Please try again.' },
      { status: 500 }
    )
  }
}
