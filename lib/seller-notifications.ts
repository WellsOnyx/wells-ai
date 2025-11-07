/**
 * Seller Notification System
 *
 * Sends instant and digest notifications to sellers about matching RFQs.
 * Supports SMS (via Twilio) and email notifications with opt-out tracking.
 */

import twilio from 'twilio'
import { prisma } from './prisma'
import { SellerMatch } from './rfq-matching'

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://wellsai.com'

export interface RFQNotificationData {
  rfqId: string
  category: string
  title: string
  description: string
  requirements: string
  quantity?: string
  budget?: string
  buyerName?: string
  createdAt: Date
}

export interface NotificationResult {
  success: boolean
  sellerId: string
  sellerName: string
  channels: {
    sms?: { success: boolean; sid?: string; error?: string }
    email?: { success: boolean; error?: string }
  }
  notificationId?: string
  error?: string
}

/**
 * Send instant RFQ match notification to a seller
 * Respects notification channel preferences (SMS, email, or both)
 */
export async function sendRFQMatchNotification(
  seller: SellerMatch,
  rfq: RFQNotificationData
): Promise<NotificationResult> {
  const result: NotificationResult = {
    success: false,
    sellerId: seller.sellerId,
    sellerName: seller.sellerName,
    channels: {}
  }

  try {
    // Create notification record in database
    const notification = await prisma.sellerNotification.create({
      data: {
        sellerId: seller.sellerId,
        rfqId: rfq.rfqId,
        notificationType: 'INSTANT',
        matchScore: seller.matchScore,
        matchReasons: seller.matchReasons,
        channels: seller.notificationChannels,
        sentAt: new Date()
      }
    })

    result.notificationId = notification.id

    // Send via SMS if enabled
    if (seller.notificationChannels.includes('sms') && seller.phone) {
      try {
        const smsResult = await sendSMSNotification(seller, rfq)
        result.channels.sms = smsResult

        // Update notification with SMS details
        await prisma.sellerNotification.update({
          where: { id: notification.id },
          data: {
            smsSid: smsResult.sid,
            smsStatus: smsResult.success ? 'SENT' : 'FAILED'
          }
        })
      } catch (error: any) {
        result.channels.sms = {
          success: false,
          error: error.message
        }
      }
    }

    // Send via email if enabled
    if (seller.notificationChannels.includes('email')) {
      try {
        const emailResult = await sendEmailNotification(seller, rfq)
        result.channels.email = emailResult

        // Update notification with email status
        await prisma.sellerNotification.update({
          where: { id: notification.id },
          data: {
            emailStatus: emailResult.success ? 'SENT' : 'FAILED'
          }
        })
      } catch (error: any) {
        result.channels.email = {
          success: false,
          error: error.message
        }
      }
    }

    // Mark as successful if at least one channel succeeded
    result.success =
      (result.channels.sms?.success || false) ||
      (result.channels.email?.success || false)

    // Update notification status
    await prisma.sellerNotification.update({
      where: { id: notification.id },
      data: {
        status: result.success ? 'SENT' : 'FAILED',
        deliveredAt: result.success ? new Date() : null
      }
    })

  } catch (error: any) {
    result.error = error.message
    console.error(`[Seller Notification] Error notifying ${seller.sellerName}:`, error)
  }

  return result
}

/**
 * Send SMS notification via Twilio
 */
async function sendSMSNotification(
  seller: SellerMatch,
  rfq: RFQNotificationData
): Promise<{ success: boolean; sid?: string; error?: string }> {
  if (!seller.phone) {
    return { success: false, error: 'No phone number' }
  }

  // Truncate description for SMS
  const shortDesc = rfq.description.substring(0, 80) + (rfq.description.length > 80 ? '...' : '')

  // Format budget if available
  const budgetText = rfq.budget ? `\nBudget: ${rfq.budget}` : ''

  // Format quantity if available
  const quantityText = rfq.quantity ? `\nQty: ${rfq.quantity}` : ''

  // Wells Onyx Voice: Precise, action-oriented, high-value
  const message = `🔷 WELLS AI - ${seller.matchScore}% MATCH

${rfq.category}: ${shortDesc}${budgetText}${quantityText}

Match reasons: ${seller.matchReasons.slice(0, 2).join(', ')}

Submit quote: ${APP_URL}/rfq/${rfq.rfqId}

Reply STOP to opt out`

  try {
    const sms = await twilioClient.messages.create({
      body: message,
      from: TWILIO_PHONE,
      to: seller.phone
    })

    console.log(`[SMS] Sent to ${seller.sellerName} - SID: ${sms.sid}`)

    return {
      success: true,
      sid: sms.sid
    }
  } catch (error: any) {
    console.error(`[SMS] Failed to send to ${seller.sellerName}:`, error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Send email notification
 * TODO: Integrate with your email service (SendGrid, Resend, etc.)
 */
async function sendEmailNotification(
  seller: SellerMatch,
  rfq: RFQNotificationData
): Promise<{ success: boolean; error?: string }> {
  // Email implementation - placeholder for now
  // In production, use SendGrid, Resend, or similar

  console.log(`[Email] Would send to ${seller.email}:`, {
    subject: `New RFQ Match: ${rfq.category} (${seller.matchScore}% match)`,
    rfqId: rfq.rfqId
  })

  // For now, just log and return success
  // TODO: Implement actual email sending
  return { success: true }
}

/**
 * Create and send daily digest of RFQ matches
 */
export async function sendDailyDigest(): Promise<{
  totalSellers: number
  successful: number
  failed: number
}> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(0, 0, 0, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Get all sellers who prefer daily digest
  const digestSellers = await prisma.sellerProfile.findMany({
    where: {
      active: true,
      notificationFrequency: 'DAILY_DIGEST'
    }
  })

  let successful = 0
  let failed = 0

  for (const seller of digestSellers) {
    try {
      // Get all pending notifications for this seller from the last 24 hours
      const pendingNotifications = await prisma.sellerNotification.findMany({
        where: {
          sellerId: seller.id,
          createdAt: {
            gte: yesterday,
            lt: today
          },
          status: 'PENDING'
        },
        include: {
          // Would need to add RFQ relation to get full details
        }
      })

      if (pendingNotifications.length === 0) {
        continue // No notifications to send
      }

      // Create digest
      const digest = createDigest(pendingNotifications, 'daily')

      // Send digest via preferred channels
      if (seller.notificationChannels.includes('sms') && seller.phone) {
        await sendDigestSMS(seller, digest)
      }

      if (seller.notificationChannels.includes('email')) {
        await sendDigestEmail(seller, digest)
      }

      // Mark notifications as sent
      await prisma.sellerNotification.updateMany({
        where: {
          id: {
            in: pendingNotifications.map(n => n.id)
          }
        },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          deliveredAt: new Date()
        }
      })

      successful++
    } catch (error) {
      console.error(`[Daily Digest] Failed for seller ${seller.id}:`, error)
      failed++
    }
  }

  return {
    totalSellers: digestSellers.length,
    successful,
    failed
  }
}

/**
 * Create and send weekly digest of RFQ matches
 */
export async function sendWeeklyDigest(): Promise<{
  totalSellers: number
  successful: number
  failed: number
}> {
  const lastWeek = new Date()
  lastWeek.setDate(lastWeek.getDate() - 7)
  lastWeek.setHours(0, 0, 0, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Get all sellers who prefer weekly digest
  const digestSellers = await prisma.sellerProfile.findMany({
    where: {
      active: true,
      notificationFrequency: 'WEEKLY_DIGEST'
    }
  })

  let successful = 0
  let failed = 0

  for (const seller of digestSellers) {
    try {
      // Get all pending notifications for this seller from the last week
      const pendingNotifications = await prisma.sellerNotification.findMany({
        where: {
          sellerId: seller.id,
          createdAt: {
            gte: lastWeek,
            lt: today
          },
          status: 'PENDING'
        }
      })

      if (pendingNotifications.length === 0) {
        continue
      }

      // Create digest
      const digest = createDigest(pendingNotifications, 'weekly')

      // Send digest via preferred channels
      if (seller.notificationChannels.includes('sms') && seller.phone) {
        await sendDigestSMS(seller, digest)
      }

      if (seller.notificationChannels.includes('email')) {
        await sendDigestEmail(seller, digest)
      }

      // Mark notifications as sent
      await prisma.sellerNotification.updateMany({
        where: {
          id: {
            in: pendingNotifications.map(n => n.id)
          }
        },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          deliveredAt: new Date()
        }
      })

      successful++
    } catch (error) {
      console.error(`[Weekly Digest] Failed for seller ${seller.id}:`, error)
      failed++
    }
  }

  return {
    totalSellers: digestSellers.length,
    successful,
    failed
  }
}

/**
 * Create digest summary from notifications
 */
export function createDigest(
  notifications: any[],
  period: 'daily' | 'weekly'
): {
  count: number
  avgMatchScore: number
  highestMatch: number
  summary: string
} {
  const count = notifications.length
  const totalScore = notifications.reduce((sum, n) => sum + (n.matchScore || 0), 0)
  const avgMatchScore = count > 0 ? Math.round(totalScore / count) : 0
  const highestMatch = Math.max(...notifications.map(n => n.matchScore || 0))

  const summary = `${count} new RFQ ${count === 1 ? 'match' : 'matches'} this ${period === 'daily' ? 'day' : 'week'}, avg match score ${avgMatchScore}%`

  return {
    count,
    avgMatchScore,
    highestMatch,
    summary
  }
}

/**
 * Send digest via SMS
 */
async function sendDigestSMS(
  seller: any,
  digest: { count: number; avgMatchScore: number; highestMatch: number; summary: string }
): Promise<void> {
  if (!seller.phone) return

  const message = `🔷 WELLS AI - RFQ DIGEST

${digest.summary}
Best match: ${digest.highestMatch}%

View all: ${APP_URL}/seller/matches

Reply STOP to opt out`

  await twilioClient.messages.create({
    body: message,
    from: TWILIO_PHONE,
    to: seller.phone
  })

  console.log(`[Digest SMS] Sent to ${seller.companyName}`)
}

/**
 * Send digest via email
 */
async function sendDigestEmail(
  seller: any,
  digest: { count: number; avgMatchScore: number; summary: string }
): Promise<void> {
  // TODO: Implement email digest
  console.log(`[Digest Email] Would send to ${seller.email}:`, digest)
}

/**
 * Handle SMS opt-out (STOP messages)
 */
export async function handleOptOut(phone: string): Promise<void> {
  // Find seller by phone
  const seller = await prisma.sellerProfile.findFirst({
    where: { phone }
  })

  if (!seller) {
    console.log(`[Opt-Out] No seller found with phone: ${phone}`)
    return
  }

  // Remove SMS from notification channels
  const updatedChannels = seller.notificationChannels.filter(c => c !== 'sms')

  await prisma.sellerProfile.update({
    where: { id: seller.id },
    data: {
      notificationChannels: updatedChannels
    }
  })

  console.log(`[Opt-Out] ${seller.companyName} opted out of SMS notifications`)
}

/**
 * Get notification history for a seller
 */
export async function getSellerNotificationHistory(
  sellerId: string,
  limit: number = 50
) {
  return await prisma.sellerNotification.findMany({
    where: { sellerId },
    orderBy: { createdAt: 'desc' },
    take: limit
  })
}

/**
 * Get notification statistics for a seller
 */
export async function getSellerNotificationStats(sellerId: string) {
  const notifications = await prisma.sellerNotification.findMany({
    where: { sellerId }
  })

  const total = notifications.length
  const sent = notifications.filter(n => n.status === 'SENT').length
  const opened = notifications.filter(n => n.openedAt).length
  const clicked = notifications.filter(n => n.clickedAt).length

  return {
    total,
    sent,
    failed: total - sent,
    opened,
    clicked,
    openRate: total > 0 ? Math.round((opened / total) * 100) : 0,
    clickRate: total > 0 ? Math.round((clicked / total) * 100) : 0
  }
}
