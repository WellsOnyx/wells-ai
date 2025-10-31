/**
 * Test GTM MVP - Run this to verify everything works
 *
 * NEW: Now uses Instantly for BOTH lead finding AND email sending
 * No more Apollo needed (saves $49/month)
 *
 * Usage:
 * NOTION_API_KEY=xxx NOTION_DEALS_DB_ID=xxx INSTANTLY_API_KEY=xxx INSTANTLY_CAMPAIGN_ID=xxx npx tsx scripts/test-gtm-mvp.ts
 *
 * Optional for SMS:
 * TWILIO_FROM=+1234567890 npx tsx scripts/test-gtm-mvp.ts
 */

import { buildICPFromNotion } from '../lib/gtm/icp-analyzer'
import { searchInstantlyLeads } from '../lib/gtm/instantly-leads'
import { createCampaign, sendCampaign } from '../lib/gtm/campaign-engine'

async function test() {
  console.log('🚀 Testing GTM MVP...\n')

  // Step 1: Check environment variables
  console.log('1️⃣ Checking environment variables...')
  const required = {
    NOTION_API_KEY: process.env.NOTION_API_KEY,
    NOTION_DEALS_DB_ID: process.env.NOTION_DEALS_DB_ID,
    INSTANTLY_API_KEY: process.env.INSTANTLY_API_KEY,
    INSTANTLY_CAMPAIGN_ID: process.env.INSTANTLY_CAMPAIGN_ID,
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
    console.log('export INSTANTLY_API_KEY=...')
    console.log('export INSTANTLY_CAMPAIGN_ID=...')
    console.log('export ANTHROPIC_API_KEY=...')
    console.log('\nOptional for SMS:')
    console.log('export TWILIO_FROM=+1234567890')
    process.exit(1)
  }

  console.log('✅ All required environment variables set')
  if (process.env.TWILIO_FROM) {
    console.log('✅ Twilio configured for SMS')
  }
  console.log()

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

  // Step 3: Search Instantly for prospects (no more Apollo!)
  console.log('3️⃣ Searching Instantly for prospects...')
  try {
    const leads = await searchInstantlyLeads({
      apiKey: process.env.INSTANTLY_API_KEY!,
      titles: ['CEO', 'VP Sales', 'Head of Revenue'],
      limit: 5, // Just 5 for testing
    })

    console.log(`✅ Found ${leads.length} prospects`)
    leads.forEach((lead, i) => {
      console.log(
        `   ${i + 1}. ${lead.first_name} ${lead.last_name} - ${lead.title} at ${lead.company_name} (${lead.email})`
      )
    })
    console.log()
  } catch (error: any) {
    console.error('❌ Failed to search Instantly:', error.message)
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
      instantlyApiKey: process.env.INSTANTLY_API_KEY,
      userRelationship: 'cold', // All cold outreach for testing
      productDescription: 'AI-powered B2B transaction platform',
      twilioFrom: process.env.TWILIO_FROM,
    })

    console.log(`✅ Campaign created: ${campaign.id}`)
    console.log(`   Prospects: ${campaign.prospects.length}`)
    console.log(`   Messages: ${campaign.messages.length}`)
    console.log(`   Using Wells AI stack: ${campaign.usingWellsStack ? 'YES ($79/month)' : 'NO'}`)
    console.log()

    // Show first EMAIL message as preview
    const firstEmailMessage = campaign.messages.find((m) => m.channel === 'email')
    const firstProspect = campaign.prospects.find(
      (p) => p.id === firstEmailMessage?.prospectId
    )

    if (firstEmailMessage && firstProspect) {
      console.log('📧 Sample email:')
      console.log(`   To: ${firstProspect.name} (${firstProspect.email})`)
      console.log(`   Subject: ${firstEmailMessage.subject}`)
      console.log(`   Body:\n${firstEmailMessage.body}`)
      console.log()
    }

    // Show channel breakdown
    const emailMessages = campaign.messages.filter((m) => m.channel === 'email')
    const smsMessages = campaign.messages.filter(
      (m) => m.channel === 'sms' && m.canSend
    )
    const linkedinMessages = campaign.messages.filter((m) => m.channel === 'linkedin')

    console.log('📊 Channel breakdown:')
    console.log(`   Emails: ${emailMessages.length}`)
    console.log(`   SMS: ${smsMessages.length} (${campaign.messages.filter((m) => m.channel === 'sms' && !m.canSend).length} blocked by guardrails)`)
    console.log(`   LinkedIn drafts: ${linkedinMessages.length} (manual send)`)
    console.log()

    // Step 5: Ask user if they want to send
    console.log('5️⃣ Ready to send?')
    console.log('⚠️  This will send REAL messages to REAL people!')
    console.log()
    console.log('To send, run:')
    console.log(`SEND_EMAILS=yes npx tsx scripts/test-gtm-mvp.ts`)
    console.log()

    if (process.env.SEND_EMAILS === 'yes') {
      console.log('📤 Sending multi-channel campaign...')

      // Approve all messages
      campaign.messages.forEach((msg) => {
        msg.approved = true
      })

      const result = await sendCampaign({
        campaign,
        instantlyApiKey: process.env.INSTANTLY_API_KEY!,
        instantlyCampaignId: process.env.INSTANTLY_CAMPAIGN_ID,
        twilioFrom: process.env.TWILIO_FROM,
      })

      console.log(`✅ Campaign sent!`)
      console.log(`   Total sent: ${result.sent}`)
      console.log(`   Total failed: ${result.failed}`)
      console.log(`   Breakdown:`)
      console.log(`     Emails: ${result.breakdown.email}`)
      console.log(`     SMS: ${result.breakdown.sms}`)
      console.log(`     LinkedIn drafts: ${result.breakdown.linkedin}`)
      console.log()
      console.log('🎉 GTM MVP is WORKING!')
      console.log()
      console.log('Next steps:')
      console.log('- Check your Instantly dashboard for email sending status')
      if (result.breakdown.sms > 0) {
        console.log('- Check Twilio for SMS delivery status')
      }
      if (result.breakdown.linkedin > 0) {
        console.log('- Send LinkedIn drafts manually from your LinkedIn account')
      }
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
