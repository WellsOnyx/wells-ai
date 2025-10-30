/**
 * Email Sending API
 * POST /api/email/send - Queue or send email with consent
 */

import { NextRequest, NextResponse } from 'next/server'
import { queueEmail, sendEmail, getEmailStatus } from '@/lib/email'
import { decide } from '@/lib/consent'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Check if this is an approval (has actionId)
    if (body.actionId && body.action === 'send') {
      // This is a send request after approval
      const { actionId, ...emailParams } = body

      // Auto-approve (in real flow, this would come from consent UI)
      await decide(actionId, 'approve', body.approvedBy || 'user')

      // Send the email
      await sendEmail(actionId, emailParams)

      return NextResponse.json({
        success: true,
        message: 'Email sent successfully',
        actionId
      })
    }

    // This is a new email queue request
    const { to, toName, subject, html, text, attachments, metadata } = body

    // Validate required fields
    if (!to || !subject || !html) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: to, subject, html' },
        { status: 400 }
      )
    }

    // Queue email for consent
    const actionId = await queueEmail({
      to,
      toName,
      subject,
      html,
      text,
      attachments,
      metadata
    })

    return NextResponse.json({
      success: true,
      message: 'Email queued for approval',
      actionId,
      status: 'pending'
    })
  } catch (error: any) {
    console.error('Email API error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const actionId = searchParams.get('actionId')

    if (!actionId) {
      return NextResponse.json(
        { success: false, error: 'actionId required' },
        { status: 400 }
      )
    }

    const status = getEmailStatus(actionId)

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Email not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      email: status
    })
  } catch (error: any) {
    console.error('Email status error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
