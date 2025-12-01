/**
 * Test Instantly API Connection
 *
 * Quick script to verify API key works and list campaigns
 */

const INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY

if (!INSTANTLY_API_KEY) {
  console.error('❌ INSTANTLY_API_KEY not found in environment')
  console.log('\nRun: vercel env pull .env.local --yes')
  process.exit(1)
}

async function testInstantly() {
  console.log('🔍 Testing Instantly API Connection...\n')

  try {
    // Test 1: List Campaigns
    console.log('📋 Fetching campaigns...')
    const campaignsResponse = await fetch('https://api.instantly.ai/api/v1/campaign/list', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INSTANTLY_API_KEY}`
      }
    })

    if (!campaignsResponse.ok) {
      throw new Error(`API returned ${campaignsResponse.status}: ${campaignsResponse.statusText}`)
    }

    const campaigns = await campaignsResponse.json()

    console.log('✅ API Connection Successful!\n')
    console.log('📊 Your Campaigns:')
    console.log('─'.repeat(80))

    if (campaigns && campaigns.length > 0) {
      campaigns.forEach((campaign: any, index: number) => {
        console.log(`\n${index + 1}. ${campaign.name}`)
        console.log(`   ID: ${campaign.id}`)
        console.log(`   Status: ${campaign.status || 'active'}`)
        console.log(`   Created: ${campaign.created_at || 'N/A'}`)
        if (campaign.total_leads) {
          console.log(`   Leads: ${campaign.total_leads}`)
        }
      })
    } else {
      console.log('\n   No campaigns found. You can create one via the API or Instantly dashboard.')
    }

    console.log('\n' + '─'.repeat(80))

    // Test 2: Get Account Info
    console.log('\n📊 Fetching account info...')
    const accountResponse = await fetch('https://api.instantly.ai/api/v1/account', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INSTANTLY_API_KEY}`
      }
    })

    if (accountResponse.ok) {
      const account = await accountResponse.json()
      console.log('✅ Account Info:')
      console.log(`   Email: ${account.email || 'N/A'}`)
      console.log(`   Plan: ${account.plan || 'N/A'}`)
      if (account.credits) {
        console.log(`   Credits: ${account.credits}`)
      }
    }

    // Recommendations
    console.log('\n' + '='.repeat(80))
    console.log('💡 NEXT STEPS:')
    console.log('='.repeat(80))

    if (campaigns && campaigns.length > 0) {
      console.log('\n1. Set default campaign ID (optional):')
      console.log(`   vercel env add INSTANTLY_DEFAULT_CAMPAIGN_ID`)
      console.log(`   Value: ${campaigns[0].id} (or choose another from above)`)
    } else {
      console.log('\n1. Create your first campaign in Instantly dashboard')
      console.log('   OR use the API to create one programmatically')
    }

    console.log('\n2. Test sending an email sequence:')
    console.log('   See: EMAIL_QUICK_START.md for examples')

    console.log('\n3. Integrate with Wells GTM:')
    console.log('   The email router will automatically use Instantly for bulk sequences')

    console.log('\n✅ Instantly API is ready to use!')

  } catch (error: any) {
    console.error('❌ Test Failed:', error.message)
    console.log('\nTroubleshooting:')
    console.log('1. Verify API key is correct in Vercel dashboard')
    console.log('2. Check Instantly.ai dashboard for API access')
    console.log('3. Ensure your plan includes API access')
    process.exit(1)
  }
}

testInstantly()
