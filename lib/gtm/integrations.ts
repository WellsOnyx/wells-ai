/**
 * GTM Integrations
 * Handles all external service integrations for automation
 *
 * Services:
 * - Clay.earth (contact enrichment)
 * - Instantly.ai (email automation)
 * - Phantombuster (LinkedIn automation)
 * - Twitter API (Twitter DMs + monitoring)
 * - Twilio (SMS - invitation only)
 * - Notion (CRM)
 * - Calendly (meeting booking)
 */

import { Client } from '@notionhq/client'
import { AutomatedContact } from './automation-engine'

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_API_KEY
})

/**
 * CLAY.EARTH INTEGRATION
 */

export async function fetchContactsFromClay(
  practiceGroup: string,
  limit: number = 50,
  filters?: any
): Promise<AutomatedContact[]> {
  try {
    const response = await fetch('https://api.clay.earth/v1/contacts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CLAY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        practice_group: practiceGroup,
        limit,
        filters
      })
    })

    if (!response.ok) {
      console.error('Clay API error:', response.statusText)
      return []
    }

    const data = await response.json()

    return data.contacts.map((c: any) => ({
      id: c.id,
      firstName: c.first_name,
      lastName: c.last_name,
      email: c.email,
      phone: c.phone,
      linkedInUrl: c.linkedin_url,
      twitterHandle: c.twitter_handle,
      company: c.company,
      title: c.title,
      practiceGroup,
      partnerEcosystem: c.tech_stack || [],
      aiLaunchDate: c.ai_launch_date,
      determinationsPerMonth: c.determinations_per_month,
      fitScore: c.fit_score || 50,
      reachabilityScore: c.reachability_score || 50,
      timingScore: c.timing_score || 50,
      status: 'new',
      responseCount: 0
    }))
  } catch (error) {
    console.error('Clay fetch error:', error)
    return []
  }
}

export async function enrichContactWithClay(contact: AutomatedContact): Promise<AutomatedContact> {
  try {
    const response = await fetch(`https://api.clay.earth/v1/contacts/${contact.id}/enrich`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CLAY_API_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      return contact
    }

    const enriched = await response.json()

    return {
      ...contact,
      partnerEcosystem: enriched.tech_stack || contact.partnerEcosystem,
      aiLaunchDate: enriched.ai_launch_date || contact.aiLaunchDate,
      determinationsPerMonth: enriched.determinations_per_month || contact.determinationsPerMonth
    }
  } catch (error) {
    console.error('Clay enrich error:', error)
    return contact
  }
}

/**
 * INSTANTLY.AI INTEGRATION (Email Automation)
 */

export async function sendEmailViaInstantly(
  to: string,
  subject: string,
  body: string,
  campaignId?: string
): Promise<boolean> {
  try {
    const response = await fetch('https://api.instantly.ai/api/v1/emails/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.INSTANTLY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to,
        subject,
        body,
        campaign_id: campaignId || process.env.INSTANTLY_DEFAULT_CAMPAIGN_ID
      })
    })

    return response.ok
  } catch (error) {
    console.error('Instantly.ai error:', error)
    return false
  }
}

export async function checkInstantlyReplies(): Promise<any[]> {
  try {
    const response = await fetch('https://api.instantly.ai/api/v1/emails/replies', {
      headers: {
        'Authorization': `Bearer ${process.env.INSTANTLY_API_KEY}`
      }
    })

    if (!response.ok) return []

    const data = await response.json()
    return data.replies || []
  } catch (error) {
    console.error('Instantly.ai replies check error:', error)
    return []
  }
}

/**
 * PHANTOMBUSTER INTEGRATION (LinkedIn Automation)
 */

export async function sendLinkedInMessageViaPhantom(
  profileUrl: string,
  message: string
): Promise<boolean> {
  try {
    const response = await fetch('https://api.phantombuster.com/api/v2/agents/launch', {
      method: 'POST',
      headers: {
        'X-Phantombuster-Key': process.env.PHANTOMBUSTER_API_KEY!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: process.env.PHANTOMBUSTER_LINKEDIN_AGENT_ID,
        argument: {
          profileUrl,
          message
        }
      })
    })

    return response.ok
  } catch (error) {
    console.error('Phantombuster error:', error)
    return false
  }
}

export async function getLinkedInRepliesViaPhantom(): Promise<any[]> {
  try {
    const response = await fetch(
      `https://api.phantombuster.com/api/v2/containers/fetch-result-object?id=${process.env.PHANTOMBUSTER_LINKEDIN_AGENT_ID}`,
      {
        headers: {
          'X-Phantombuster-Key': process.env.PHANTOMBUSTER_API_KEY!
        }
      }
    )

    if (!response.ok) return []

    const data = await response.json()
    return data.resultObject?.replies || []
  } catch (error) {
    console.error('Phantombuster replies fetch error:', error)
    return []
  }
}

/**
 * TWITTER API INTEGRATION
 */

export async function sendTwitterDM(username: string, message: string): Promise<boolean> {
  try {
    // First, get user ID from username
    const userResponse = await fetch(`https://api.twitter.com/2/users/by/username/${username}`, {
      headers: {
        'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
      }
    })

    if (!userResponse.ok) return false

    const userData = await userResponse.json()
    const userId = userData.data.id

    // Send DM
    const dmResponse = await fetch('https://api.twitter.com/2/dm_conversations/with/:participant_id/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        participant_id: userId,
        text: message
      })
    })

    return dmResponse.ok
  } catch (error) {
    console.error('Twitter DM error:', error)
    return false
  }
}

export async function monitorTwitterForKeywords(keywords: string[]): Promise<any[]> {
  try {
    const query = keywords.map(k => `"${k}"`).join(' OR ')

    const response = await fetch(
      `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=100`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
        }
      }
    )

    if (!response.ok) return []

    const data = await response.json()
    return data.data || []
  } catch (error) {
    console.error('Twitter monitoring error:', error)
    return []
  }
}

/**
 * TWILIO INTEGRATION (SMS - Invitation Only)
 */

export async function sendSMSViaTwilio(
  to: string,
  body: string
): Promise<boolean> {
  // CRITICAL: Only send if user has explicitly opted in
  const hasOptedIn = await checkSMSOptIn(to)
  if (!hasOptedIn) {
    console.log(`🚫 SMS blocked: ${to} has not opted in`)
    return false
  }

  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const from = process.env.TWILIO_PHONE_NUMBER

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          To: to,
          From: from!,
          Body: body
        })
      }
    )

    return response.ok
  } catch (error) {
    console.error('Twilio SMS error:', error)
    return false
  }
}

async function checkSMSOptIn(phone: string): Promise<boolean> {
  // Check Notion CRM for SMS opt-in status
  // TODO: Implement when Notion database is set up
  console.log('⚠️ SMS opt-in check not implemented - defaulting to false')
  return false
}

/**
 * NOTION INTEGRATION (CRM)
 */

export async function saveContactToNotion(contact: AutomatedContact): Promise<string | null> {
  try {
    const response = await notion.pages.create({
      parent: {
        database_id: process.env.NOTION_CONTACTS_DB_ID!
      },
      properties: {
        'Name': {
          title: [
            {
              text: {
                content: `${contact.firstName} ${contact.lastName}`
              }
            }
          ]
        },
        'Email': {
          email: contact.email || null
        },
        'Phone': {
          phone_number: contact.phone || null
        },
        'Company': {
          rich_text: [
            {
              text: {
                content: contact.company
              }
            }
          ]
        },
        'Title': {
          rich_text: [
            {
              text: {
                content: contact.title
              }
            }
          ]
        },
        'Practice Group': {
          select: {
            name: contact.practiceGroup
          }
        },
        'Status': {
          select: {
            name: contact.status
          }
        },
        'Fit Score': {
          number: contact.fitScore
        },
        'LinkedIn': {
          url: contact.linkedInUrl || null
        },
        'Twitter': {
          rich_text: contact.twitterHandle ? [
            {
              text: {
                content: contact.twitterHandle
              }
            }
          ] : []
        }
      }
    })

    return response.id
  } catch (error) {
    console.error('Notion save error:', error)
    return null
  }
}

export async function updateContactInNotion(
  contactId: string,
  updates: Partial<AutomatedContact>
): Promise<boolean> {
  try {
    const properties: any = {}

    if (updates.status) {
      properties['Status'] = {
        select: { name: updates.status }
      }
    }

    if (updates.responseCount !== undefined) {
      properties['Response Count'] = {
        number: updates.responseCount
      }
    }

    if (updates.lastContactedAt) {
      properties['Last Contacted'] = {
        date: {
          start: updates.lastContactedAt.toISOString()
        }
      }
    }

    await notion.pages.update({
      page_id: contactId,
      properties
    })

    return true
  } catch (error) {
    console.error('Notion update error:', error)
    return false
  }
}

export async function saveDailyReportToNotion(report: any): Promise<boolean> {
  try {
    await notion.pages.create({
      parent: {
        database_id: process.env.NOTION_GTM_REPORTS_DB_ID!
      },
      properties: {
        'Date': {
          date: {
            start: report.date
          }
        },
        'Total New Contacts': {
          number: report.totals.newContacts
        },
        'Total Messages Sent': {
          number: report.totals.messagesSent
        },
        'Total Responses': {
          number: report.totals.responses
        },
        'Total Meetings Booked': {
          number: report.totals.meetings
        },
        'Total Deals': {
          number: report.totals.deals
        },
        'Total Revenue': {
          number: report.totals.revenue
        }
      }
    })

    return true
  } catch (error) {
    console.error('Notion report save error:', error)
    return false
  }
}

export async function getContactsNeedingFollowUpFromNotion(
  practiceGroup: string,
  daysSinceContact: number = 3
): Promise<AutomatedContact[]> {
  // TODO: Implement when Notion database is set up
  console.log('⚠️ Notion follow-up query not implemented')
  return []
}

/**
 * CALENDLY INTEGRATION
 */

export async function bookCalendlyMeeting(
  contact: AutomatedContact,
  meetingType: string = 'discovery'
): Promise<string | null> {
  try {
    // Get the appropriate Calendly event type URL
    const eventTypeUrl = getCalendlyEventTypeUrl(meetingType)

    // For now, just return the Calendly link
    // In a full implementation, this would integrate with Calendly API
    // to auto-create invites

    const calendlyLink = `${eventTypeUrl}?email=${encodeURIComponent(contact.email || '')}&name=${encodeURIComponent(`${contact.firstName} ${contact.lastName}`)}`

    console.log(`📅 Calendly link generated for ${contact.firstName}: ${calendlyLink}`)

    return calendlyLink
  } catch (error) {
    console.error('Calendly booking error:', error)
    return null
  }
}

function getCalendlyEventTypeUrl(meetingType: string): string {
  switch (meetingType) {
    case 'discovery':
      return process.env.CALENDLY_DISCOVERY_URL || 'https://calendly.com/wellsonyx/discovery'
    case 'health-check':
      return process.env.CALENDLY_HEALTH_CHECK_URL || 'https://calendly.com/wellsonyx/ai-health-check'
    case 'demo':
      return process.env.CALENDLY_DEMO_URL || 'https://calendly.com/wellsonyx/demo'
    default:
      return process.env.CALENDLY_DEFAULT_URL || 'https://calendly.com/wellsonyx'
  }
}

/**
 * Helper functions for Notion data extraction
 */

function extractFirstName(nameProperty: any): string {
  if (!nameProperty || !nameProperty.title || nameProperty.title.length === 0) {
    return ''
  }
  const fullName = nameProperty.title[0].text.content
  return fullName.split(' ')[0]
}

function extractLastName(nameProperty: any): string {
  if (!nameProperty || !nameProperty.title || nameProperty.title.length === 0) {
    return ''
  }
  const fullName = nameProperty.title[0].text.content
  const parts = fullName.split(' ')
  return parts.slice(1).join(' ')
}

function extractRichText(richTextProperty: any): string {
  if (!richTextProperty || !richTextProperty.rich_text || richTextProperty.rich_text.length === 0) {
    return ''
  }
  return richTextProperty.rich_text[0].text.content
}

function extractTwitterHandle(twitterProperty: any): string | undefined {
  if (!twitterProperty || !twitterProperty.rich_text || twitterProperty.rich_text.length === 0) {
    return undefined
  }
  return twitterProperty.rich_text[0].text.content
}
