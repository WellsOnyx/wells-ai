import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

// Send email via Instantly.ai
async function sendViaInstantly(email: string, subject: string, message: string) {
  if (!process.env.INSTANTLY_API_KEY) {
    console.log('Instantly API key not configured, skipping email send')
    return { success: false, provider: 'instantly', reason: 'API key missing' }
  }

  try {
    const response = await fetch('https://api.instantly.ai/api/v1/send/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INSTANTLY_API_KEY}`
      },
      body: JSON.stringify({
        to: email,
        subject: subject,
        body: message,
        from_email: process.env.INSTANTLY_FROM_EMAIL || 'hello@wellsonyx.com'
      })
    })

    if (!response.ok) {
      throw new Error(`Instantly API error: ${response.statusText}`)
    }

    return { success: true, provider: 'instantly' }
  } catch (error) {
    console.error('Instantly send error:', error)
    return { success: false, provider: 'instantly', error: String(error) }
  }
}

// Send SMS via Twilio
async function sendViaTwilio(phone: string, message: string) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log('Twilio not configured, skipping SMS send')
    return { success: false, provider: 'twilio', reason: 'Credentials missing' }
  }

  try {
    const auth = Buffer.from(
      `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
    ).toString('base64')

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          To: phone,
          From: process.env.TWILIO_PHONE_NUMBER || '',
          Body: message
        })
      }
    )

    if (!response.ok) {
      throw new Error(`Twilio API error: ${response.statusText}`)
    }

    return { success: true, provider: 'twilio' }
  } catch (error) {
    console.error('Twilio send error:', error)
    return { success: false, provider: 'twilio', error: String(error) }
  }
}

export async function POST(request: Request) {
  try {
    const { messageId, finalMessage } = await request.json()

    if (!messageId || !finalMessage) {
      return NextResponse.json(
        { success: false, error: 'messageId and finalMessage required' },
        { status: 400 }
      )
    }

    // Get outreach message from Notion
    const outreachPage = await notion.pages.retrieve({ page_id: messageId })
    const props = (outreachPage as any).properties

    // Get target details
    const targetId = props.Target?.relation?.[0]?.id
    if (!targetId) {
      return NextResponse.json(
        { success: false, error: 'No target linked to this message' },
        { status: 400 }
      )
    }

    const targetPage = await notion.pages.retrieve({ page_id: targetId })
    const targetProps = (targetPage as any).properties

    const channel = props.Channel?.select?.name || 'Email'
    const targetEmail = targetProps.Email?.email
    const targetPhone = targetProps.Phone?.phone_number

    let sendResult

    // Send via appropriate channel
    if (channel === 'Email' && targetEmail) {
      // Generate subject line
      const campaignId = props.Campaign?.relation?.[0]?.id
      let subject = 'Quick question'

      if (campaignId) {
        try {
          const campaignPage = await notion.pages.retrieve({ page_id: campaignId })
          const campaignProps = (campaignPage as any).properties
          const serviceName = campaignProps['Service Offering']?.select?.name || ''
          subject = serviceName.includes('Executive Search')
            ? 'Executive search conversation?'
            : 'Quick question about your operations'
        } catch (error) {
          console.log('Could not fetch campaign for subject line')
        }
      }

      sendResult = await sendViaInstantly(targetEmail, subject, finalMessage)
    } else if (channel === 'SMS' && targetPhone) {
      sendResult = await sendViaTwilio(targetPhone, finalMessage)
    } else {
      return NextResponse.json(
        { success: false, error: 'No valid contact method available' },
        { status: 400 }
      )
    }

    // Update outreach status in Notion
    await notion.pages.update({
      page_id: messageId,
      properties: {
        'Status': {
          select: {
            name: sendResult.success ? '✅ Sent' : '❌ Send Failed'
          }
        },
        'Sent At': {
          date: {
            start: new Date().toISOString()
          }
        },
        'Final Message': {
          rich_text: [{ text: { content: finalMessage } }]
        }
      }
    })

    // Update target stage if send succeeded
    if (sendResult.success) {
      await notion.pages.update({
        page_id: targetId,
        properties: {
          'Stage': { select: { name: 'Outreach Sent' } }
        }
      })
    }

    return NextResponse.json({
      success: sendResult.success,
      sent: sendResult.success,
      channel,
      provider: sendResult.provider,
      error: sendResult.error
    })

  } catch (error: any) {
    console.error('Approval error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
