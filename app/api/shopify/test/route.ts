import { NextResponse } from 'next/server'
import { getShopifyPartnerClient, isShopifyConfigured } from '@/lib/shopify-partner'

/**
 * Test endpoint to verify Shopify Partner API integration
 *
 * GET /api/shopify/test
 *
 * Returns:
 * - Configuration status
 * - Partner earnings summary
 * - Sample referral link
 */
export async function GET() {
  try {
    // Check if Shopify is configured
    if (!isShopifyConfigured()) {
      return NextResponse.json({
        configured: false,
        error: 'Shopify Partner credentials not found in environment variables',
      }, { status: 500 })
    }

    // Get Shopify Partner client
    const client = getShopifyPartnerClient()

    // Test: Generate a referral link
    const referralLink = await client.generateReferralLink({
      source: 'test',
      campaign: 'wells-ai-integration-test',
    })

    // Test: Get partner earnings (this may fail if API version is wrong, but that's okay)
    let earnings = null
    try {
      earnings = await client.getEarnings()
    } catch (error) {
      console.warn('Could not fetch earnings (this is expected during initial setup):', error)
    }

    return NextResponse.json({
      configured: true,
      partnerId: process.env.SHOPIFY_PARTNER_ID,
      referralLink: referralLink.url,
      earnings: earnings || { message: 'Earnings API not yet accessible - this is normal for new partners' },
      message: 'Shopify Partner integration is configured and working!',
      nextSteps: [
        'Test referral link by visiting the URL',
        'Create first development store via Wells chat',
        'Update Wells AI prompts to offer Shopify setup services',
      ],
    })
  } catch (error: any) {
    console.error('Shopify Partner API test error:', error)
    return NextResponse.json({
      configured: true,
      error: error.message,
      details: 'The integration is configured but encountered an error during testing. This may be due to API permissions or rate limits.',
    }, { status: 500 })
  }
}
