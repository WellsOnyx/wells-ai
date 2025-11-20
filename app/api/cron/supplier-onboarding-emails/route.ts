// app/api/cron/supplier-onboarding-emails/route.ts
// Automated cron job to send scheduled supplier onboarding emails
// Run this endpoint daily via Vercel Cron or external scheduler

import { PrismaClient } from '@prisma/client'
import { Resend } from 'resend'
import {
  getWelcomeEmail,
  getDay3ReminderEmail,
  getDay7ReminderEmail,
  getDay14AlmostLiveEmail
} from '@/lib/supplier-onboarding-emails'

// Lazy initialization
let prismaClient: PrismaClient | null = null
let resendClient: Resend | null = null

function getPrisma(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient()
  }
  return prismaClient
}

function getResend(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      throw new Error('RESEND_API_KEY not configured')
    }
    resendClient = new Resend(apiKey)
  }
  return resendClient
}

interface EmailToSend {
  supplierId: string
  supplierName: string
  supplierEmail: string
  emailType: 'day1' | 'day3' | 'day7' | 'day14'
  daysAgo: number
}

export async function GET(req: Request) {
  const startTime = Date.now()

  try {
    // Verify cron secret (Vercel Cron sends this header)
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const prisma = getPrisma()
    const resend = getResend()
    const now = new Date()

    // Calculate target dates for each email
    const day1Target = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
    const day3Target = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
    const day7Target = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
    const day14Target = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) // 14 days ago

    const emailsToSend: EmailToSend[] = []

    // Find suppliers who joined 1 day ago (Day 1 welcome email)
    const day1Suppliers = await prisma.suppliers.findMany({
      where: {
        created_at: {
          gte: new Date(day1Target.getTime() - 1 * 60 * 60 * 1000), // 1 hour window
          lte: new Date(day1Target.getTime() + 1 * 60 * 60 * 1000)
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        created_at: true
      }
    })

    for (const supplier of day1Suppliers) {
      emailsToSend.push({
        supplierId: supplier.id,
        supplierName: supplier.name,
        supplierEmail: supplier.email,
        emailType: 'day1',
        daysAgo: 1
      })
    }

    // Find suppliers who joined 3 days ago (Day 3 reminder)
    const day3Suppliers = await prisma.suppliers.findMany({
      where: {
        created_at: {
          gte: new Date(day3Target.getTime() - 1 * 60 * 60 * 1000),
          lte: new Date(day3Target.getTime() + 1 * 60 * 60 * 1000)
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        created_at: true
      }
    })

    for (const supplier of day3Suppliers) {
      emailsToSend.push({
        supplierId: supplier.id,
        supplierName: supplier.name,
        supplierEmail: supplier.email,
        emailType: 'day3',
        daysAgo: 3
      })
    }

    // Find suppliers who joined 7 days ago (Day 7 reminder)
    const day7Suppliers = await prisma.suppliers.findMany({
      where: {
        created_at: {
          gte: new Date(day7Target.getTime() - 1 * 60 * 60 * 1000),
          lte: new Date(day7Target.getTime() + 1 * 60 * 60 * 1000)
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        created_at: true
      }
    })

    for (const supplier of day7Suppliers) {
      emailsToSend.push({
        supplierId: supplier.id,
        supplierName: supplier.name,
        supplierEmail: supplier.email,
        emailType: 'day7',
        daysAgo: 7
      })
    }

    // Find suppliers who joined 14 days ago (Day 14 "almost live")
    const day14Suppliers = await prisma.suppliers.findMany({
      where: {
        created_at: {
          gte: new Date(day14Target.getTime() - 1 * 60 * 60 * 1000),
          lte: new Date(day14Target.getTime() + 1 * 60 * 60 * 1000)
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        created_at: true
      }
    })

    for (const supplier of day14Suppliers) {
      emailsToSend.push({
        supplierId: supplier.id,
        supplierName: supplier.name,
        supplierEmail: supplier.email,
        emailType: 'day14',
        daysAgo: 14
      })
    }

    // Send all emails
    const results: any[] = []

    for (const emailData of emailsToSend) {
      try {
        let emailTemplate

        switch (emailData.emailType) {
          case 'day1':
            emailTemplate = getWelcomeEmail(emailData.supplierName, emailData.supplierEmail)
            break
          case 'day3':
            emailTemplate = getDay3ReminderEmail(emailData.supplierName)
            break
          case 'day7':
            emailTemplate = getDay7ReminderEmail(emailData.supplierName)
            break
          case 'day14':
            emailTemplate = getDay14AlmostLiveEmail(emailData.supplierName)
            break
        }

        const result = await resend.emails.send({
          from: 'Wells AI Suppliers <suppliers@wellsai.com>',
          to: emailData.supplierEmail,
          subject: emailTemplate.subject,
          html: emailTemplate.html
        })

        results.push({
          supplierId: emailData.supplierId,
          supplierEmail: emailData.supplierEmail,
          emailType: emailData.emailType,
          daysAgo: emailData.daysAgo,
          sent: true,
          messageId: result.data?.id
        })

        console.log(`✓ Sent ${emailData.emailType} email to ${emailData.supplierEmail}`)
      } catch (emailError: any) {
        console.error(`✗ Failed to send ${emailData.emailType} email to ${emailData.supplierEmail}:`, emailError)
        results.push({
          supplierId: emailData.supplierId,
          supplierEmail: emailData.supplierEmail,
          emailType: emailData.emailType,
          daysAgo: emailData.daysAgo,
          sent: false,
          error: emailError.message
        })
      }
    }

    const successCount = results.filter(r => r.sent).length
    const failCount = results.filter(r => !r.sent).length

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalEmails: emailsToSend.length,
      successCount,
      failCount,
      results,
      latency_ms: Date.now() - startTime
    })

  } catch (error: any) {
    console.error('Supplier onboarding email cron error:', error)
    return Response.json({
      error: error.message || 'Failed to send onboarding emails',
      timestamp: new Date().toISOString(),
      latency_ms: Date.now() - startTime
    }, { status: 500 })
  }
}
