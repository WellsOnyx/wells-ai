/**
 * List Instantly Campaigns
 * Shows all available campaigns with IDs
 */

import { listCampaigns } from '../lib/instantly'

async function main() {
  console.log('📋 Listing Instantly Campaigns...\n')

  try {
    const campaigns = await listCampaigns()

    if (!campaigns || campaigns.length === 0) {
      console.log('❌ No campaigns found')
      return
    }

    console.log(`✅ Found ${campaigns.length} campaign(s):\n`)

    campaigns.forEach((campaign, idx) => {
      console.log(`${idx + 1}. ${campaign.name || 'Untitled Campaign'}`)
      console.log(`   ID: ${campaign.id}`)
      console.log(`   Status: ${campaign.status || 'Unknown'}`)
      if (campaign.leads_count !== undefined) {
        console.log(`   Leads: ${campaign.leads_count}`)
      }
      console.log('')
    })

    console.log('Use one of these campaign IDs to send emails via Instantly.')
    console.log('Add to .env.local: INSTANTLY_CAMPAIGN_ID=<id>\n')
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

main().catch(console.error)
