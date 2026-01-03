// @ts-nocheck
/**
 * Reply Detection Cron Job
 *
 * Checks LinkedIn, Gmail, and Outlook inboxes for replies to cold outreach.
 * Sends notifications via SMS, Slack, or email when replies are detected.
 * Called by Vercel Cron every 5 minutes.
 *
 * Supports:
 * - LinkedIn inbox monitoring
 * - Gmail inbox monitoring (via Gmail API)
 * - Outlook inbox monitoring (via Microsoft Graph API)
 *
 * Can also be triggered manually with master key.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  checkAndNotify,
  getReplyStats,
  getDetectedReplies,
  checkEmailReplies,
  emailReplyToDetectedReply,
  type NotificationPreferences,
  type DetectedReply,
  type EmailReply,
} from '@/lib/cold-start/reply-detection'
import { getCredential } from '@/lib/cold-start/credential-helper'

const MASTER_KEY = process.env.COLD_START_MASTER_KEY
const CRON_SECRET = process.env.CRON_SECRET

// Validate request is from cron or master
function validateAccess(request: NextRequest): boolean {
  // Check for Vercel Cron header
  const cronHeader = request.headers.get('Authorization')
  if (cronHeader === `Bearer ${CRON_SECRET}`) {
    return true
  }

  // Check for master key
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    if (token === MASTER_KEY) {
      return true
    }
  }

  return false
}

// GET - Check for replies and send notifications
export async function GET(request: NextRequest) {
  if (!validateAccess(request)) {
    return NextResponse.json({ error: 'Access Denied' }, { status: 403 })
  }

  try {
    // Build notification preferences from stored credentials
    const preferences: NotificationPreferences = {
      sms: true,
      slack: true,
      email: true,
      phoneNumber: await getCredential('OWNER_PHONE') || process.env.OWNER_PHONE,
      slackWebhook: await getCredential('ESCALATION_SLACK_WEBHOOK') || process.env.ESCALATION_SLACK_WEBHOOK,
      emailAddress: await getCredential('OWNER_EMAIL') || process.env.OWNER_EMAIL,
    }

    // Check LinkedIn for replies and send notifications
    const linkedinResult = await checkAndNotify(preferences)

    // Check email (Gmail/Outlook) for replies
    const emailReplies = await checkEmailReplies()

    // Convert email replies to DetectedReply format and send notifications
    let emailNotificationsSent = 0
    const emailDetectedReplies: DetectedReply[] = []

    for (const emailReply of emailReplies) {
      const detectedReply = emailReplyToDetectedReply(emailReply)
      emailDetectedReplies.push(detectedReply)

      // Send notifications for email replies
      let notified = false

      // Import notification functions dynamically to send for email replies
      const {
        sendSmsNotification,
        sendSlackNotification,
        sendEmailNotification,
      } = await import('@/lib/cold-start/reply-detection')

      if (preferences.sms && preferences.phoneNumber) {
        const sent = await sendSmsNotification(detectedReply, preferences.phoneNumber)
        if (sent) notified = true
      }

      if (preferences.slack && preferences.slackWebhook) {
        const sent = await sendSlackNotification(detectedReply, preferences.slackWebhook)
        if (sent) notified = true
      }

      if (preferences.email && preferences.emailAddress) {
        const sent = await sendEmailNotification(detectedReply, preferences.emailAddress)
        if (sent) notified = true
      }

      if (notified) {
        emailNotificationsSent++
      }
    }

    const stats = getReplyStats()

    // Combine results from LinkedIn and Email
    const allReplies = [
      ...linkedinResult.newReplies,
      ...emailDetectedReplies,
    ]

    return NextResponse.json({
      success: true,
      newReplies: allReplies.length,
      notificationsSent: linkedinResult.notificationsSent + emailNotificationsSent,
      stats,
      breakdown: {
        linkedin: {
          replies: linkedinResult.newReplies.length,
          notifications: linkedinResult.notificationsSent,
        },
        email: {
          replies: emailReplies.length,
          notifications: emailNotificationsSent,
          byPlatform: {
            gmail: emailReplies.filter(r => r.platform === 'gmail').length,
            outlook: emailReplies.filter(r => r.platform === 'outlook').length,
          },
        },
      },
      replies: allReplies.map(r => ({
        platform: r.platform,
        from: r.fromName,
        title: r.fromTitle,
        preview: r.messagePreview.slice(0, 100),
        receivedAt: r.receivedAt,
      })),
    })
  } catch (error) {
    console.error('[CheckReplies] Error:', error)
    return NextResponse.json(
      { error: 'Failed to check replies', details: String(error) },
      { status: 500 }
    )
  }
}

// POST - Get full reply details or update notification preferences
export async function POST(request: NextRequest) {
  if (!validateAccess(request)) {
    return NextResponse.json({ error: 'Access Denied' }, { status: 403 })
  }

  try {
    const body = await request.json()

    // If requesting full details
    if (body.action === 'get_details') {
      const allReplies = getDetectedReplies()
      return NextResponse.json({
        replies: allReplies,
        stats: getReplyStats(),
      })
    }

    // If testing notification
    if (body.action === 'test_notification') {
      const preferences: NotificationPreferences = {
        sms: body.sms || false,
        slack: body.slack || false,
        email: body.email || false,
        phoneNumber: body.phoneNumber || await getCredential('OWNER_PHONE') || process.env.OWNER_PHONE,
        slackWebhook: body.slackWebhook || await getCredential('ESCALATION_SLACK_WEBHOOK'),
        emailAddress: body.emailAddress || await getCredential('OWNER_EMAIL'),
      }

      // Send a test notification
      const testReply = {
        id: 'test-' + Date.now(),
        platform: 'linkedin' as const,
        fromId: 'test',
        fromName: 'Test Prospect',
        fromTitle: 'CEO at Test Company',
        receivedAt: new Date(),
        messagePreview: 'This is a test notification from Wells AI. If you received this, your notifications are working!',
        conversationUrl: 'https://linkedin.com/messaging',
      }

      const { sendSmsNotification, sendSlackNotification, sendEmailNotification } = await import('@/lib/cold-start/reply-detection')

      const results = {
        sms: preferences.sms && preferences.phoneNumber ? await sendSmsNotification(testReply, preferences.phoneNumber) : null,
        slack: preferences.slack && preferences.slackWebhook ? await sendSlackNotification(testReply, preferences.slackWebhook) : null,
        email: preferences.email && preferences.emailAddress ? await sendEmailNotification(testReply, preferences.emailAddress) : null,
      }

      return NextResponse.json({
        success: true,
        message: 'Test notifications sent',
        results,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[CheckReplies] POST Error:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
