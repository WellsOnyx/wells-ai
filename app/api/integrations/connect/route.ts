/**
 * Integration Connection API
 * POST /api/integrations/connect
 *
 * Securely connect user integrations (Instantly, Clay, Apollo, Twilio, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { saveUserIntegration } from '@/lib/settings/credential-storage'

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { integration, credentials } = body

    // Validate integration type
    const validIntegrations = ['instantly', 'clay', 'apollo', 'phantombuster', 'twilio', 'notion']
    if (!validIntegrations.includes(integration)) {
      return NextResponse.json(
        { error: 'Invalid integration type' },
        { status: 400 }
      )
    }

    // Validate credentials
    if (!credentials || typeof credentials !== 'object') {
      return NextResponse.json(
        { error: 'Invalid credentials format' },
        { status: 400 }
      )
    }

    // Integration-specific validation
    if (integration === 'twilio') {
      if (!credentials.accountSid || !credentials.authToken) {
        return NextResponse.json(
          { error: 'Twilio requires accountSid and authToken' },
          { status: 400 }
        )
      }
    } else {
      if (!credentials.apiKey) {
        return NextResponse.json(
          { error: `${integration} requires apiKey` },
          { status: 400 }
        )
      }
    }

    // Test the connection before saving
    const testResult = await testIntegrationConnection(integration, credentials)

    if (!testResult.success) {
      return NextResponse.json(
        {
          error: 'Connection test failed',
          details: testResult.error
        },
        { status: 400 }
      )
    }

    // Save encrypted credentials
    await saveUserIntegration(userId, integration, credentials)

    return NextResponse.json({
      success: true,
      message: `${integration} connected successfully`,
      accountInfo: testResult.accountInfo
    })

  } catch (error: any) {
    console.error('Integration connection error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to connect integration' },
      { status: 500 }
    )
  }
}

/**
 * Test integration connection
 */
async function testIntegrationConnection(
  integration: string,
  credentials: any
): Promise<{ success: boolean; error?: string; accountInfo?: string }> {
  try {
    switch (integration) {
      case 'instantly':
        return await testInstantly(credentials.apiKey)

      case 'clay':
        return await testClay(credentials.apiKey)

      case 'apollo':
        return await testApollo(credentials.apiKey)

      case 'phantombuster':
        return await testPhantombuster(credentials.apiKey)

      case 'twilio':
        return await testTwilio(credentials.accountSid, credentials.authToken)

      case 'notion':
        return await testNotion(credentials.apiKey)

      default:
        return { success: false, error: 'Unknown integration' }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Test Instantly.ai connection
 */
async function testInstantly(apiKey: string) {
  try {
    const response = await fetch('https://api.instantly.ai/api/v1/account', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      return { success: false, error: 'Invalid Instantly.ai API key' }
    }

    const data = await response.json()
    return {
      success: true,
      accountInfo: `Account: ${data.email || 'Connected'}`
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Test Clay.earth connection
 */
async function testClay(apiKey: string) {
  try {
    const response = await fetch('https://api.clay.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      return { success: false, error: 'Invalid Clay API key' }
    }

    const data = await response.json()
    return {
      success: true,
      accountInfo: `Workspace: ${data.workspace?.name || 'Connected'}`
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Test Apollo.io connection
 */
async function testApollo(apiKey: string) {
  try {
    const response = await fetch('https://api.apollo.io/v1/auth/health', {
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      return { success: false, error: 'Invalid Apollo.io API key' }
    }

    return { success: true, accountInfo: 'Connected' }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Test PhantomBuster connection
 */
async function testPhantombuster(apiKey: string) {
  try {
    const response = await fetch('https://api.phantombuster.com/api/v2/user', {
      headers: {
        'X-Phantombuster-Key': apiKey,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      return { success: false, error: 'Invalid PhantomBuster API key' }
    }

    const data = await response.json()
    return {
      success: true,
      accountInfo: `Email: ${data.email || 'Connected'}`
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Test Twilio connection
 */
async function testTwilio(accountSid: string, authToken: string) {
  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      return { success: false, error: 'Invalid Twilio credentials' }
    }

    const data = await response.json()
    return {
      success: true,
      accountInfo: `Account: ${data.friendly_name || accountSid}`
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Test Notion connection
 */
async function testNotion(apiKey: string) {
  try {
    const response = await fetch('https://api.notion.com/v1/users/me', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      return { success: false, error: 'Invalid Notion integration token' }
    }

    const data = await response.json()
    return {
      success: true,
      accountInfo: `Bot: ${data.name || 'Connected'}`
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
