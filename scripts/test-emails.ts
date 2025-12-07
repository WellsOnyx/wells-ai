/**
 * Email Testing Script
 *
 * Tests the email notification system using Resend
 *
 * Usage:
 *   npx tsx scripts/test-emails.ts
 */

import {
  sendLeadConfirmation,
  sendLeadNotification,
  sendDealUpdate,
  testEmailConfiguration,
} from '../lib/email'
import type { Lead } from '../lib/leads-db'

// ============================================================================
// TEST DATA
// ============================================================================

const mockLeadDetails = {
  id: 'test-lead-123',
  userName: 'John Doe',
  userEmail: process.env.TEST_EMAIL || 'test@example.com',
  journey: 'founder' as const,
  requirements: 'Looking for a senior full-stack developer with React and Node.js experience',
  timeline: 'Within 2 weeks',
  budget: 150000,
}

const mockLead: Lead = {
  id: 'test-lead-123',
  userId: 'user_test123',
  userEmail: process.env.TEST_EMAIL || 'test@example.com',
  userName: 'John Doe',
  userPhone: '+1 (555) 123-4567',
  userCompany: 'Acme Corp',
  journey: 'founder',
  requirements: 'Looking for a senior full-stack developer with React and Node.js experience',
  conversationHistory: [
    {
      role: 'user',
      content: "I'm looking for a senior developer for my startup",
    },
    {
      role: 'assistant',
      content: 'I can help with that! What technologies are you working with?',
    },
    {
      role: 'user',
      content: 'We use React and Node.js mainly, with PostgreSQL for the database',
    },
  ],
  status: 'new',
  priority: 'high',
  source: 'chat',
  intent: 'Hiring senior developer',
  budget: 150000,
  timeline: 'Within 2 weeks',
  contactedAt: null,
  contactedBy: null,
  lastContactAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  closedAt: null,
}

const mockDealUpdate = {
  id: 'test-lead-123',
  userName: 'John Doe',
  status: 'contacted' as const,
  statusMessage: "We've reviewed your request and one of our team members will be reaching out to you shortly.",
  nextSteps: 'Expect a call from Sarah tomorrow at 2 PM EST to discuss your requirements in detail.',
  contactName: 'Sarah Williams',
}

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

async function testConfiguration() {
  console.log('\n========================================')
  console.log('Testing Email Configuration')
  console.log('========================================\n')

  const isConfigured = await testEmailConfiguration()

  if (isConfigured) {
    console.log('✅ Email configuration is working!')
  } else {
    console.log('❌ Email configuration failed')
    console.log('\nMake sure RESEND_API_KEY is set in your .env.local file')
    process.exit(1)
  }
}

async function testLeadConfirmationEmail() {
  console.log('\n========================================')
  console.log('Testing Lead Confirmation Email')
  console.log('========================================\n')

  console.log('Sending to:', mockLeadDetails.userEmail)

  try {
    await sendLeadConfirmation(mockLeadDetails.userEmail, mockLeadDetails)
    console.log('✅ Lead confirmation email sent successfully!')
  } catch (error) {
    console.error('❌ Failed to send lead confirmation email:', error)
  }
}

async function testTeamNotificationEmail() {
  console.log('\n========================================')
  console.log('Testing Team Notification Email')
  console.log('========================================\n')

  const teamEmail = process.env.WELLS_TEAM_EMAIL || process.env.TEST_EMAIL || 'test@example.com'
  console.log('Sending to:', teamEmail)

  try {
    await sendLeadNotification(mockLead)
    console.log('✅ Team notification email sent successfully!')
  } catch (error) {
    console.error('❌ Failed to send team notification email:', error)
  }
}

async function testDealUpdateEmail() {
  console.log('\n========================================')
  console.log('Testing Deal Update Email')
  console.log('========================================\n')

  console.log('Sending to:', mockLeadDetails.userEmail)

  try {
    await sendDealUpdate(mockLeadDetails.userEmail, mockDealUpdate)
    console.log('✅ Deal update email sent successfully!')
  } catch (error) {
    console.error('❌ Failed to send deal update email:', error)
  }
}

async function testAllEmails() {
  console.log('\n========================================')
  console.log('Testing All Email Types')
  console.log('========================================\n')

  await testConfiguration()
  await testLeadConfirmationEmail()
  await testTeamNotificationEmail()
  await testDealUpdateEmail()
}

// ============================================================================
// MENU
// ============================================================================

async function showMenu() {
  const args = process.argv.slice(2)
  const command = args[0]

  console.log('\n🎯 Wells AI - Email Testing\n')

  if (!process.env.RESEND_API_KEY) {
    console.log('❌ RESEND_API_KEY not found in environment variables')
    console.log('Please add RESEND_API_KEY to your .env.local file\n')
    process.exit(1)
  }

  if (!process.env.TEST_EMAIL) {
    console.log('⚠️  TEST_EMAIL not set. Using test@example.com')
    console.log('Set TEST_EMAIL in .env.local to test with your own email\n')
  }

  switch (command) {
    case 'config':
      await testConfiguration()
      break

    case 'confirmation':
      await testLeadConfirmationEmail()
      break

    case 'notification':
      await testTeamNotificationEmail()
      break

    case 'update':
      await testDealUpdateEmail()
      break

    case 'all':
    default:
      await testAllEmails()
      break
  }

  console.log('\n========================================')
  console.log('Testing Complete!')
  console.log('========================================\n')
}

// ============================================================================
// RUN
// ============================================================================

showMenu()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
