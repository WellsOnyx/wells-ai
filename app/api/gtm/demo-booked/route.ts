import { NextResponse } from 'next/server'

/**
 * GTM Demo Booked API - Track demo bookings
 *
 * POST /api/gtm/demo-booked
 *
 * Records a demo booking and updates the lead status
 */

export interface DemoBooking {
  id: string
  leadId: string
  company: string
  contact: string
  email: string
  title?: string
  demoDate: string
  demoTime: string
  timezone: string
  demoType: 'intro' | 'full' | 'technical' | 'executive'
  source: 'calendly' | 'cal.com' | 'manual' | 'email'
  notes?: string
  preparationNotes?: string
  attendees?: string[]
  status: 'scheduled' | 'confirmed' | 'completed' | 'no_show' | 'cancelled' | 'rescheduled'
  remindersSent: number
  meetingLink?: string
  recordingLink?: string
  createdAt: string
  updatedAt: string
}

export interface DemoStats {
  totalBooked: number
  scheduled: number
  completed: number
  noShows: number
  cancelled: number
  showRate: number
  thisWeek: number
  nextWeek: number
}

// In-memory store for demo (replace with database in production)
const demoBookings: Map<string, DemoBooking> = new Map()

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate required fields
    const requiredFields = ['leadId', 'company', 'contact', 'email', 'demoDate', 'demoTime']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    // Create demo booking
    const booking: DemoBooking = {
      id: `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      leadId: body.leadId,
      company: body.company,
      contact: body.contact,
      email: body.email,
      title: body.title || '',
      demoDate: body.demoDate,
      demoTime: body.demoTime,
      timezone: body.timezone || 'America/New_York',
      demoType: body.demoType || 'intro',
      source: body.source || 'manual',
      notes: body.notes || '',
      preparationNotes: body.preparationNotes || '',
      attendees: body.attendees || [body.email],
      status: 'scheduled',
      remindersSent: 0,
      meetingLink: body.meetingLink || '',
      recordingLink: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Store booking
    demoBookings.set(booking.id, booking)

    // Generate confirmation email content
    const confirmationEmail = generateConfirmationEmail(booking)

    return NextResponse.json({
      success: true,
      booking,
      confirmationEmail,
      message: 'Demo booked successfully',
    })
  } catch (error) {
    console.error('Error booking demo:', error)
    return NextResponse.json(
      { error: 'Failed to book demo' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const upcoming = searchParams.get('upcoming') === 'true'
    const stats = searchParams.get('stats') === 'true'
    const leadId = searchParams.get('leadId')

    let filteredBookings = Array.from(demoBookings.values())

    // Apply filters
    if (status) {
      filteredBookings = filteredBookings.filter(b => b.status === status)
    }
    if (leadId) {
      filteredBookings = filteredBookings.filter(b => b.leadId === leadId)
    }
    if (upcoming) {
      const now = new Date()
      filteredBookings = filteredBookings.filter(b => {
        const demoDateTime = new Date(`${b.demoDate} ${b.demoTime}`)
        return demoDateTime > now && b.status === 'scheduled'
      })
    }

    // Sort by demo date
    filteredBookings.sort((a, b) => {
      const dateA = new Date(`${a.demoDate} ${a.demoTime}`)
      const dateB = new Date(`${b.demoDate} ${b.demoTime}`)
      return dateA.getTime() - dateB.getTime()
    })

    // Return stats if requested
    if (stats) {
      const now = new Date()
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

      const allBookings = Array.from(demoBookings.values())
      const completed = allBookings.filter(b => b.status === 'completed').length
      const noShows = allBookings.filter(b => b.status === 'no_show').length
      const cancelled = allBookings.filter(b => b.status === 'cancelled').length

      const thisWeek = allBookings.filter(b => {
        const demoDate = new Date(`${b.demoDate} ${b.demoTime}`)
        return demoDate >= now && demoDate < weekFromNow
      }).length

      const nextWeek = allBookings.filter(b => {
        const demoDate = new Date(`${b.demoDate} ${b.demoTime}`)
        return demoDate >= weekFromNow && demoDate < twoWeeksFromNow
      }).length

      const demoStats: DemoStats = {
        totalBooked: allBookings.length,
        scheduled: allBookings.filter(b => b.status === 'scheduled').length,
        completed,
        noShows,
        cancelled,
        showRate: (completed + noShows) > 0
          ? Math.round((completed / (completed + noShows)) * 100)
          : 0,
        thisWeek,
        nextWeek,
      }

      return NextResponse.json({ stats: demoStats })
    }

    return NextResponse.json({
      bookings: filteredBookings,
      total: filteredBookings.length,
    })
  } catch (error) {
    console.error('Error fetching demos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch demos' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()

    if (!body.id) {
      return NextResponse.json(
        { error: 'Demo ID is required' },
        { status: 400 }
      )
    }

    const existingBooking = demoBookings.get(body.id)
    if (!existingBooking) {
      return NextResponse.json(
        { error: 'Demo booking not found' },
        { status: 404 }
      )
    }

    // Track status changes for no-show handling
    const statusChanged = body.status && body.status !== existingBooking.status

    // Update booking
    const updatedBooking: DemoBooking = {
      ...existingBooking,
      ...body,
      updatedAt: new Date().toISOString(),
    }

    demoBookings.set(body.id, updatedBooking)

    // If marked as no-show, generate follow-up content
    let followUpContent = null
    if (statusChanged && body.status === 'no_show') {
      followUpContent = generateNoShowFollowUp(updatedBooking)
    }

    return NextResponse.json({
      success: true,
      booking: updatedBooking,
      followUpContent,
      message: 'Demo updated successfully',
    })
  } catch (error) {
    console.error('Error updating demo:', error)
    return NextResponse.json(
      { error: 'Failed to update demo' },
      { status: 500 }
    )
  }
}

// Helper functions

function generateConfirmationEmail(booking: DemoBooking): { subject: string; body: string } {
  return {
    subject: `Confirmed: Grain & Vault demo - ${booking.demoDate}`,
    body: `Hi ${booking.contact.split(' ')[0]},

Great - looking forward to our call on ${booking.demoDate} at ${booking.demoTime} ${booking.timezone}.

Here's what we'll cover in 15 minutes:
1. How the deposit-to-credit model works (2 min)
2. Live demo of the platform (8 min)
3. ROI calculator for ${booking.company} (3 min)
4. Q&A (2 min)

Come prepared with:
- Rough monthly supplier spend (doesn't need to be exact)
- What ERP/accounting system you use
- Any specific pain points you want to solve

${booking.meetingLink ? `Meeting link: ${booking.meetingLink}` : ''}

See you soon!

P.S. - If something comes up, just reply to reschedule. No ghosting needed!`,
  }
}

function generateNoShowFollowUp(booking: DemoBooking): { subject: string; body: string; loomScript: string } {
  return {
    subject: `Missed you - reschedule?`,
    body: `Hi ${booking.contact.split(' ')[0]},

Looks like we missed each other for our call today. No worries - happens to everyone.

Two options:
1. Reply with a few times that work better for you
2. Grab a slot here: [CALENDLY_LINK]

If priorities shifted and this isn't the right time, just let me know. I'll follow up in a few months instead.

Best,
[Your name]`,
    loomScript: `Hey ${booking.contact.split(' ')[0]}, since we missed our call, I recorded a quick 3-minute walkthrough of Grain & Vault.

[Show the deposit-to-credit model]
[Show the ROI calculator with their company name]
[Show the dashboard]

If this resonates, let's reschedule. If not, no hard feelings. Just reply to this email.`,
  }
}
