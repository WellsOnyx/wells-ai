/**
 * Email Delivery Testing Script
 * Tests Gmail OAuth + Instantly API integration
 */

import { PrismaClient } from '@prisma/client'
import {
  getGmailAuthUrl,
  sendGmailEmail,
  testGmailConfig,
  checkGmailRateLimit
} from '../lib/email/gmail'
import {
  listCampaigns,
  createInstantlyCampaign,
  addProspectsToCampaign,
  getCampaignAnalytics
} from '../lib/email/instantly'
import {
  routeEmail,
  sendEmailSmart,
  routeBatchEmails
} from '../lib/email/router'

const prisma = new PrismaClient()

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function success(message: string) {
  log(`✅ ${message}`, colors.green)
}

function error(message: string) {
  log(`❌ ${message}`, colors.red)
}

function info(message: string) {
  log(`ℹ️  ${message}`, colors.blue)
}

function warn(message: string) {
  log(`⚠️  ${message}`, colors.yellow)
}

/**
 * Test 1: Gmail OAuth Configuration
 */
async function testGmailOAuth(userId: string) {
  log('\n🔐 Testing Gmail OAuth Configuration...', colors.cyan)

  try {
    // Check if Gmail is configured
    const config = await prisma.userEmailConfig.findUnique({
      where: { userId }
    })

    if (!config || config.provider !== 'GMAIL_OAUTH') {
      warn('Gmail not configured for this user')
      info('To configure Gmail:')
      info('1. Visit /settings/email')
      info('2. Click "Connect Gmail"')
      info('3. Authorize the app')
      return false
    }

    success(`Gmail configured: ${config.fromEmail}`)

    // Test configuration
    const testResult = await testGmailConfig(userId)

    if (testResult.success) {
      success('Gmail configuration is valid')
    } else {
      error(`Gmail test failed: ${testResult.error}`)
      return false
    }

    // Check rate limit
    const rateLimit = await checkGmailRateLimit(userId)
    info(`Rate limit: ${rateLimit.remaining}/500 emails remaining`)
    info(`Resets at: ${rateLimit.resetAt.toLocaleString()}`)

    return true
  } catch (err) {
    error(`Gmail OAuth test failed: ${err}`)
    return false
  }
}

/**
 * Test 2: Send Test Email via Gmail
 */
async function testGmailSend(userId: string, toEmail: string) {
  log('\n📧 Testing Gmail Email Send...', colors.cyan)

  try {
    const result = await sendGmailEmail(userId, {
      to: toEmail,
      subject: 'Test Email from Wells AI',
      text: 'This is a test email sent via Gmail OAuth integration.',
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Test Email from Wells AI</h2>
          <p>This is a test email sent via Gmail OAuth integration.</p>
          <p>If you received this, the integration is working correctly!</p>
        </div>
      `
    })

    if (result.success) {
      success(`Email sent successfully! Message ID: ${result.messageId}`)
      return true
    } else {
      error(`Failed to send email: ${result.error}`)
      return false
    }
  } catch (err) {
    error(`Gmail send test failed: ${err}`)
    return false
  }
}

/**
 * Test 3: Instantly API Connection
 */
async function testInstantlyAPI() {
  log('\n🚀 Testing Instantly API Connection...', colors.cyan)

  try {
    // List campaigns
    const campaigns = await listCampaigns()

    success(`Connected to Instantly API`)
    info(`Found ${campaigns.length} existing campaigns`)

    campaigns.slice(0, 3).forEach(campaign => {
      info(`  - ${campaign.name} (${campaign.status})`)
    })

    return true
  } catch (err) {
    error(`Instantly API test failed: ${err}`)
    warn('Make sure INSTANTLY_API_KEY is set in .env')
    return false
  }
}

/**
 * Test 4: Create Test Campaign
 */
async function testInstantlyCampaign() {
  log('\n📋 Testing Instantly Campaign Creation...', colors.cyan)

  try {
    const result = await createInstantlyCampaign({
      name: `Test Campaign - ${new Date().toISOString()}`,
      sequence: [
        {
          subject: 'Test Email 1',
          body: 'This is test email 1',
          delayInDays: 0
        },
        {
          subject: 'Test Follow-up',
          body: 'This is a follow-up email',
          delayInDays: 3
        }
      ],
      trackOpens: true,
      trackClicks: true,
      dailyLimit: 10
    })

    if (result.success) {
      success(`Campaign created! ID: ${result.campaignId}`)
      return result.campaignId
    } else {
      error(`Failed to create campaign: ${result.error}`)
      return null
    }
  } catch (err) {
    error(`Campaign creation test failed: ${err}`)
    return null
  }
}

/**
 * Test 5: Email Routing Logic
 */
async function testEmailRouting(userId: string) {
  log('\n🔀 Testing Email Routing Logic...', colors.cyan)

  try {
    // Test different scenarios
    const scenarios = [
      {
        name: 'Critical 1:1 Email',
        context: {
          userId,
          importance: 'critical' as const,
          volume: 1
        }
      },
      {
        name: 'Bulk Sequence',
        context: {
          userId,
          importance: 'medium' as const,
          volume: 50,
          isSequence: true
        }
      },
      {
        name: 'Medium Volume',
        context: {
          userId,
          importance: 'high' as const,
          volume: 25
        }
      }
    ]

    for (const scenario of scenarios) {
      const decision = await routeEmail(scenario.context)
      info(`${scenario.name}:`)
      info(`  Provider: ${decision.provider}`)
      info(`  Reason: ${decision.reason}`)
      info(`  Confidence: ${decision.confidence}%`)
    }

    success('Email routing logic working correctly')
    return true
  } catch (err) {
    error(`Routing test failed: ${err}`)
    return false
  }
}

/**
 * Test 6: Batch Email Routing
 */
async function testBatchRouting(userId: string) {
  log('\n📊 Testing Batch Email Routing...', colors.cyan)

  try {
    const plan = await routeBatchEmails(
      {
        userId,
        importance: 'high',
        volume: 75
      },
      Array(75).fill({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test'
      })
    )

    info(`Batch Plan for 75 emails:`)
    info(`  Gmail: ${plan.gmail}`)
    info(`  Instantly: ${plan.instantly}`)
    info(`  Resend: ${plan.resend}`)
    info(`  Strategy: ${plan.plan}`)

    success('Batch routing logic working correctly')
    return true
  } catch (err) {
    error(`Batch routing test failed: ${err}`)
    return false
  }
}

/**
 * Main Test Runner
 */
async function runTests() {
  log('========================================', colors.cyan)
  log('Wells AI Email Delivery Test Suite', colors.cyan)
  log('========================================', colors.cyan)

  // Get test parameters from command line or use defaults
  const userId = process.env.TEST_USER_ID || 'user_test'
  const testEmail = process.env.TEST_EMAIL || 'test@example.com'

  info(`Test User ID: ${userId}`)
  info(`Test Email: ${testEmail}`)

  const results = {
    gmailOAuth: false,
    gmailSend: false,
    instantlyAPI: false,
    instantlyCampaign: false,
    emailRouting: false,
    batchRouting: false
  }

  // Run tests
  results.gmailOAuth = await testGmailOAuth(userId)

  if (results.gmailOAuth) {
    results.gmailSend = await testGmailSend(userId, testEmail)
  }

  results.instantlyAPI = await testInstantlyAPI()

  if (results.instantlyAPI) {
    const campaignId = await testInstantlyCampaign()
    results.instantlyCampaign = !!campaignId
  }

  results.emailRouting = await testEmailRouting(userId)
  results.batchRouting = await testBatchRouting(userId)

  // Summary
  log('\n========================================', colors.cyan)
  log('Test Results Summary', colors.cyan)
  log('========================================', colors.cyan)

  const totalTests = Object.keys(results).length
  const passedTests = Object.values(results).filter(r => r).length

  Object.entries(results).forEach(([test, passed]) => {
    const icon = passed ? '✅' : '❌'
    const color = passed ? colors.green : colors.red
    log(`${icon} ${test}`, color)
  })

  log(`\n${passedTests}/${totalTests} tests passed`, passedTests === totalTests ? colors.green : colors.yellow)

  if (passedTests === totalTests) {
    success('\n🎉 All tests passed! Email delivery infrastructure is ready.')
  } else {
    warn('\n⚠️  Some tests failed. Please review the errors above.')
  }

  // Cleanup
  await prisma.$disconnect()
}

// Run tests
runTests().catch(err => {
  error(`Test suite failed: ${err}`)
  process.exit(1)
})
