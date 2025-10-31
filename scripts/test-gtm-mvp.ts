/**
 * Test GTM MVP - Run this to verify everything works
 *
 * Usage:
 * NOTION_API_KEY=xxx NOTION_DEALS_DB_ID=xxx APOLLO_API_KEY=xxx INSTANTLY_API_KEY=xxx npx tsx scripts/test-gtm-mvp.ts
 */

import { buildICPFromNotion } from '../lib/gtm/icp-analyzer'
import { searchApollo } from '../lib/gtm/apollo-search'
import { createCampaign, sendCampaign } from '../lib/gtm/campaign-engine'

async function test() {
  console.log('🚀 Testing GTM MVP...\n')

  // Step 1: Check environment variables
  console.log('1️⃣ Checking environment variables...')
  const required = {
    NOTION_API_KEY: process.env.NOTION_API_KEY,
    NOTION_DEALS_DB_ID: process.env.NOTION_DEALS_DB_ID,
    APOLLO_API_KEY: process.env.APOLLO_API_KEY,
    INSTANTLY_API_KEY: process.env.INSTANTLY_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  }

  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    console.error('❌ Missing environment variables:', missing.join(', '))
    console.log('\nSet them like this:')
    console.log('export NOTION_API_KEY=ntn_...')
    console.log('export NOTION_DEALS_DB_ID=...')
    console.log('export APOLLO_API_KEY=...')
    console.log('export INSTANTLY_API_KEY=...')
    console.log('export ANTHROPIC_API_KEY=...')
    process.exit(1)
  }

  console.log('✅ All environment variables set\n')

  // Step 2: Build ICP from Notion
  console.log('2️⃣ Building ICP from Notion deals...')
  try {
    const icp = await buildICPFromNotion(
      process.env.NOTION_API_KEY!,
      process.env.NOTION_DEALS_DB_ID!
    )

    console.log('✅ ICP built successfully')
    console.log(`   Industries: ${icp.industries.join(', ') || 'None'}`)
    console.log(`   Titles: ${icp.titles.join(', ') || 'None'}`)
    console.log(`   Avg deal size: $${icp.avgDealSize.toLocaleString()}`)
    console.log(`   Summary: ${icp.summary}`)
    console.log()
  } catch (error: any) {
    console.error('❌ Failed to build ICP:', error.message)
    process.exit(1)
  }

  // Step 3: Search Apollo for prospects
  console.log('3️⃣ Searching Apollo for prospects...')
  try {
    const prospects = await searchApollo({
      titles: ['CEO', 'VP Sales', 'Head of Revenue'],
      limit: 5, // Just 5 for testing
    })

    console.log(`✅ Found ${prospects.length} prospects`)
    prospects.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name} - ${p.title} at ${p.company} (${p.email})`)
    })
    console.log()
  } catch (error: any) {
    console.error('❌ Failed to search Apollo:', error.message)
    process.exit(1)
  }

  // Step 4: Create campaign (with 5 prospects for testing)
  console.log('4️⃣ Creating test campaign...')
  try {
    const campaign = await createCampaign({
      userId: 'test_user',
      userRequest: 'Find me customers',
      notionApiKey: process.env.NOTION_API_KEY!,
      notionDealsDbId: process.env.NOTION_DEALS_DB_ID!,
    })

    console.log(`✅ Campaign created: ${campaign.id}`)
    console.log(`   Prospects: ${campaign.prospects.length}`)
    console.log(`   Messages: ${campaign.messages.length}`)
    console.log()

    // Show first message as preview
    const firstMessage = campaign.messages[0]
    const firstProspect = campaign.prospects.find((p) => p.id === firstMessage.prospectId)

    console.log('📧 Sample email:')
    console.log(`   To: ${firstProspect?.name} (${firstProspect?.email})`)
    console.log(`   Subject: ${firstMessage.subject}`)
    console.log(`   Body:\n${firstMessage.body}`)
    console.log()

    // Step 5: Ask user if they want to send
    console.log('5️⃣ Ready to send?')
    console.log('⚠️  This will send REAL emails to REAL people!')
    console.log()
    console.log('To send, run:')
    console.log(`SEND_EMAILS=yes npx tsx scripts/test-gtm-mvp.ts`)
    console.log()

    if (process.env.SEND_EMAILS === 'yes') {
      console.log('📤 Sending emails via Instantly...')

      // Approve all messages
      campaign.messages.forEach((msg) => {
        msg.approved = true
      })

      const result = await sendCampaign(campaign, process.env.INSTANTLY_API_KEY!)

      console.log(`✅ Campaign sent!`)
      console.log(`   Sent: ${result.sent}`)
      console.log(`   Failed: ${result.failed}`)
      console.log()
      console.log('🎉 GTM MVP is WORKING!')
    } else {
      console.log('💡 Test complete! Everything is working.')
      console.log('   Set SEND_EMAILS=yes to actually send.')
    }
  } catch (error: any) {
    console.error('❌ Failed to create campaign:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

test().catch(console.error)
