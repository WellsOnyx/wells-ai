/**
 * Integration Test API
 * POST /api/integrations/test
 *
 * Test existing integration connection
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getUserIntegration, updateIntegrationTestStatus } from '@/lib/settings/credential-storage'

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
    const { integration } = body

    // Validate integration type
    const validIntegrations = ['instantly', 'clay', 'apollo', 'phantombuster', 'twilio', 'notion']
    if (!validIntegrations.includes(integration)) {
      return NextResponse.json(
        { error: 'Invalid integration type' },
        { status: 400 }
      )
    }

    // Get stored credentials
    const credentials = await getUserIntegration(userId, integration)

    if (!credentials) {
      return NextResponse.json(
        { error: `No ${integration} credentials found. Please connect first.` },
        { status: 404 }
      )
    }

    // Test the connection
    const testResult = await testIntegrationConnection(integration, credentials)

    // Update test status
    await updateIntegrationTestStatus(
      userId,
      integration,
      testResult.success ? 'success' : 'failed',
      testResult.error
    )

    if (!testResult.success) {
      return NextResponse.json(
        {
          error: 'Connection test failed',
          details: testResult.error
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `${integration} connection is working`,
      details: testResult.details
    })

  } catch (error: any) {
    console.error('Integration test error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to test integration' },
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
): Promise<{ success: boolean; error?: string; details?: string }> {
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
      return { success: false, error: 'Invalid API key or connection issue' }
    }

    const data = await response.json()
    return {
      success: true,
      details: `Account: ${data.email || 'Connected'}, Credits: ${data.credits || 'N/A'}`
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
      return { success: false, error: 'Invalid API key or connection issue' }
    }

    const data = await response.json()
    return {
      success: true,
      details: `Workspace: ${data.workspace?.name || 'Connected'}`
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
      return { success: false, error: 'Invalid API key or connection issue' }
    }

    return { success: true, details: 'API key is valid and working' }
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
      return { success: false, error: 'Invalid API key or connection issue' }
    }

    const data = await response.json()
    return {
      success: true,
      details: `Email: ${data.email || 'Connected'}, Plan: ${data.plan || 'N/A'}`
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
      return { success: false, error: 'Invalid credentials or connection issue' }
    }

    const data = await response.json()
    return {
      success: true,
      details: `Account: ${data.friendly_name || accountSid}, Status: ${data.status}`
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
      return { success: false, error: 'Invalid integration token or connection issue' }
    }

    const data = await response.json()
    return {
      success: true,
      details: `Bot: ${data.name || 'Connected'}, Type: ${data.type}`
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
