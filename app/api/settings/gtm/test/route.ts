import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

/**
 * POST /api/settings/gtm/test
 *
 * Test connection to GTM services (Notion, Instantly, Twilio)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { service, settings } = body

    if (!service || !settings) {
      return NextResponse.json(
        { error: 'Missing service or settings' },
        { status: 400 }
      )
    }

    switch (service) {
      case 'notion':
        return await testNotionConnection(settings)
      case 'instantly':
        return await testInstantlyConnection(settings)
      case 'twilio':
        return await testTwilioConnection(settings)
      default:
        return NextResponse.json(
          { error: 'Invalid service' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('[GTM Test] Error testing connection:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to test connection' },
      { status: 500 }
    )
  }
}

async function testNotionConnection(settings: any) {
  const { notionApiKey, notionDealsDbId } = settings

  if (!notionApiKey || !notionDealsDbId) {
    return NextResponse.json(
      { error: 'Missing Notion API key or database ID' },
      { status: 400 }
    )
  }

  try {
    // Test Notion API by querying the database
    const response = await fetch(
      `https://api.notion.com/v1/databases/${notionDealsDbId}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${notionApiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          page_size: 1, // Just test if we can access it
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to connect to Notion')
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      message: `Connected successfully! Found ${data.results?.length || 0} deals.`,
    })
  } catch (error: any) {
    console.error('[Notion Test] Error:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to connect to Notion. Check your API key and database ID.',
      },
      { status: 500 }
    )
  }
}

async function testInstantlyConnection(settings: any) {
  const { instantlyApiKey } = settings

  if (!instantlyApiKey) {
    return NextResponse.json(
      { error: 'Missing Instantly API key' },
      { status: 400 }
    )
  }

  try {
    // Test Instantly API by fetching account info
    const response = await fetch('https://api.instantly.ai/api/v1/account', {
      headers: {
        'Authorization': `Bearer ${instantlyApiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to connect to Instantly')
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      message: `Connected successfully! Account: ${data.email || 'Unknown'}`,
    })
  } catch (error: any) {
    console.error('[Instantly Test] Error:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to connect to Instantly. Check your API key.',
      },
      { status: 500 }
    )
  }
}

async function testTwilioConnection(settings: any) {
  const { twilioFrom } = settings

  if (!twilioFrom) {
    return NextResponse.json(
      { error: 'Missing Twilio phone number' },
      { status: 400 }
    )
  }

  // Check if Twilio is configured in environment
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return NextResponse.json(
      {
        error: 'Twilio not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables.',
      },
      { status: 500 }
    )
  }

  try {
    // Validate phone number format (E.164)
    if (!twilioFrom.match(/^\+[1-9]\d{1,14}$/)) {
      throw new Error('Invalid phone number format. Use E.164 format (e.g., +12125551234)')
    }

    // Test Twilio by fetching phone number info
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(twilioFrom)}`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
        },
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to connect to Twilio')
    }

    const data = await response.json()

    if (!data.incoming_phone_numbers || data.incoming_phone_numbers.length === 0) {
      throw new Error('Phone number not found in your Twilio account')
    }

    return NextResponse.json({
      success: true,
      message: `Connected successfully! Phone number verified: ${twilioFrom}`,
    })
  } catch (error: any) {
    console.error('[Twilio Test] Error:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to connect to Twilio. Check your phone number and environment variables.',
      },
      { status: 500 }
    )
  }
}
