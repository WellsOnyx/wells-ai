/**
 * GTM Onboarding Check - CRITICAL SAFETY
 *
 * NO ONE can send emails/SMS/etc without:
 * 1. Being logged in (Clerk)
 * 2. Having completed onboarding
 * 3. Having API keys configured
 * 4. Approving the campaign
 */

import { clerkClient } from '@clerk/nextjs/server'

export interface OnboardingStatus {
  isComplete: boolean
  missingSteps: string[]
  hasNotionSetup: boolean
  hasInstantlySetup: boolean
  hasTwilioSetup: boolean
  canSendEmails: boolean
  canSendSMS: boolean
  usingWellsStack: boolean
}

export async function checkGTMOnboarding(
  userId: string
): Promise<OnboardingStatus> {
  const client = await clerkClient()
  const user = await client.users.getUser(userId)

  const privateMetadata = user.privateMetadata as any
  const publicMetadata = user.publicMetadata as any

  const missingSteps: string[] = []

  // Check Notion setup (REQUIRED for ICP analysis)
  const hasNotionSetup = !!(
    privateMetadata.notionApiKey && privateMetadata.notionDealsDbId
  )

  if (!hasNotionSetup) {
    missingSteps.push('Connect Notion (Settings → Integrations → Notion)')
  }

  // Check Instantly setup (for emails + leads)
  const hasInstantlySetup = !!(
    privateMetadata.instantlyApiKey && privateMetadata.instantlyCampaignId
  )

  // Check if using Wells AI stack (no Instantly API key = use Wells stack)
  const usingWellsStack = !hasInstantlySetup

  if (!hasInstantlySetup && !process.env.WELLS_INSTANTLY_API_KEY) {
    missingSteps.push(
      'Connect Instantly OR use Wells AI GTM stack (FREE - we only charge 0.33% on deals you close)'
    )
  }

  // Check Twilio setup (OPTIONAL - for SMS)
  const hasTwilioSetup = !!privateMetadata.twilioFrom

  // Determine what user can do
  const canSendEmails = hasNotionSetup && (hasInstantlySetup || !!process.env.WELLS_INSTANTLY_API_KEY)
  const canSendSMS = canSendEmails && hasTwilioSetup

  const isComplete = missingSteps.length === 0 && canSendEmails

  return {
    isComplete,
    missingSteps,
    hasNotionSetup,
    hasInstantlySetup,
    hasTwilioSetup,
    canSendEmails,
    canSendSMS,
    usingWellsStack,
  }
}

/**
 * Get user's GTM credentials
 */
export async function getGTMCredentials(userId: string): Promise<{
  notionApiKey: string
  notionDealsDbId: string
  instantlyApiKey: string
  instantlyCampaignId?: string
  twilioFrom?: string
  usingWellsStack: boolean
}> {
  const client = await clerkClient()
  const user = await client.users.getUser(userId)

  const privateMetadata = user.privateMetadata as any

  const notionApiKey = privateMetadata.notionApiKey
  const notionDealsDbId = privateMetadata.notionDealsDbId
  const instantlyApiKey =
    privateMetadata.instantlyApiKey || process.env.WELLS_INSTANTLY_API_KEY
  const instantlyCampaignId =
    privateMetadata.instantlyCampaignId || process.env.INSTANTLY_CAMPAIGN_ID
  const twilioFrom = privateMetadata.twilioFrom

  if (!notionApiKey || !notionDealsDbId) {
    throw new Error('Notion not configured. Complete onboarding first.')
  }

  if (!instantlyApiKey) {
    throw new Error(
      'No Instantly account configured. Either connect your own or subscribe to Wells AI GTM stack.'
    )
  }

  const usingWellsStack = !privateMetadata.instantlyApiKey

  return {
    notionApiKey,
    notionDealsDbId,
    instantlyApiKey,
    instantlyCampaignId,
    twilioFrom,
    usingWellsStack,
  }
}

/**
 * Check if user can perform GTM action (throws if not)
 */
export async function requireGTMAccess(userId: string): Promise<void> {
  const status = await checkGTMOnboarding(userId)

  if (!status.isComplete) {
    throw new Error(
      `GTM not set up. Missing: ${status.missingSteps.join(', ')}`
    )
  }

  if (!status.canSendEmails) {
    throw new Error('Cannot send emails. Complete GTM setup first.')
  }
}

export default {
  checkGTMOnboarding,
  getGTMCredentials,
  requireGTMAccess,
}
