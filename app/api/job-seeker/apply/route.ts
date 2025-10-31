/**
 * Job Application API
 *
 * Apply to Executive Talent RFQs and notify hiring companies
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { withValidation } from '@/lib/validation'
import { jobSeekerApplySchema } from '@/lib/schemas'
import { getRFQById } from '@/lib/notion'
import { generateCoverLetter } from '@/lib/job-seeker/resume-parser'
import twilio from 'twilio'

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

/**
 * POST /api/job-seeker/apply
 * Submit job application to an RFQ
 */
export const POST = withValidation(jobSeekerApplySchema, async (request) => {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { rfqId, jobSeekerId, coverLetter, customMessage } = request.validatedBody

    // Verify user is applying for themselves
    if (jobSeekerId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - can only apply for yourself' },
        { status: 403 }
      )
    }

    // Get job seeker profile
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    const profile = user.publicMetadata?.jobSeekerProfile as any

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found - complete onboarding first' },
        { status: 404 }
      )
    }

    // Get RFQ details
    const rfq = await getRFQById(rfqId)

    if (!rfq) {
      return NextResponse.json(
        { success: false, error: 'Job posting not found' },
        { status: 404 }
      )
    }

    // Verify this is an Executive Talent RFQ
    if (rfq.category !== 'Executive Talent') {
      return NextResponse.json(
        { success: false, error: 'Can only apply to Executive Talent positions' },
        { status: 400 }
      )
    }

    // Generate cover letter if not provided
    let finalCoverLetter = coverLetter
    if (!finalCoverLetter) {
      try {
        finalCoverLetter = await generateCoverLetter(
          {
            name: profile.name,
            currentRole: profile.currentRole,
            experience: profile.experience,
            skills: profile.skills
          },
          {
            company: rfq.company,
            productName: rfq.productName,
            specifications: rfq.specifications,
            contactName: rfq.contactName
          }
        )
      } catch (error) {
        console.error('Cover letter generation error:', error)
        // Continue without cover letter
      }
    }

    // Create application object
    const application = {
      id: `APP-${Date.now()}`,
      rfqId,
      jobSeekerId: userId,
      jobSeekerName: profile.name,
      jobSeekerEmail: profile.email,
      jobSeekerPhone: profile.phone,
      currentRole: profile.currentRole,
      desiredRole: profile.desiredRole,
      skills: profile.skills,
      coverLetter: finalCoverLetter,
      customMessage,
      appliedDate: new Date().toISOString(),
      status: 'Submitted'
    }

    // Store application in job seeker's metadata
    const existingApplications = (user.publicMetadata?.jobApplications as any[]) || []
    await client.users.updateUser(userId, {
      publicMetadata: {
        ...user.publicMetadata,
        jobApplications: [...existingApplications, application]
      }
    })

    // Notify hiring company via SMS (if contactEmail exists, we'll use their phone)
    let notificationSent = false
    try {
      if (rfq.contactEmail) {
        const message = `🔷 WELLS AI - NEW CANDIDATE

Job: ${rfq.productName}
Candidate: ${profile.name}
Current Role: ${profile.currentRole}
Skills: ${profile.skills.slice(0, 3).join(', ')}

View Application: ${process.env.NEXT_PUBLIC_APP_URL}/applications/${application.id}

Reply: 1=Interview | 2=Pass`

        // In production, you'd look up the hiring manager's phone from Notion
        // For now, we'll just log the notification
        console.log(`[APPLICATION] Would send SMS to ${rfq.contactEmail}:`, message)

        // If TWILIO_PHONE_NUMBER is configured, we could send the SMS
        if (process.env.TWILIO_PHONE_NUMBER) {
          // await twilioClient.messages.create({
          //   body: message,
          //   from: process.env.TWILIO_PHONE_NUMBER,
          //   to: rfq.contactPhone // Would need to add this to RFQ schema
          // })
          // notificationSent = true
        }
      }
    } catch (error) {
      console.error('Notification error:', error)
      // Continue even if notification fails
    }

    // Send email notification (optional - would integrate with Resend/SendGrid)
    try {
      if (rfq.contactEmail && process.env.RESEND_API_KEY) {
        // Email implementation here
        console.log(`[APPLICATION] Would send email to ${rfq.contactEmail}`)
      }
    } catch (error) {
      console.error('Email notification error:', error)
    }

    return NextResponse.json({
      success: true,
      application,
      message: 'Application submitted successfully',
      notificationSent
    })
  } catch (error: any) {
    console.error('Application submission error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to submit application' },
      { status: 500 }
    )
  }
})

/**
 * GET /api/job-seeker/apply
 * Get all applications for current user
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get applications from Clerk metadata
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    const applications = (user.publicMetadata?.jobApplications as any[]) || []

    return NextResponse.json({
      success: true,
      applications,
      count: applications.length
    })
  } catch (error: any) {
    console.error('Error fetching applications:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch applications' },
      { status: 500 }
    )
  }
}
