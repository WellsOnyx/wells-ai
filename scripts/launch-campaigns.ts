#!/usr/bin/env npx tsx

/**
 * Quick-launch script for Wells Onyx GTM campaigns
 * Usage: npx tsx scripts/launch-campaigns.ts [practice-group]
 *
 * Examples:
 *   npx tsx scripts/launch-campaigns.ts executive-search
 *   npx tsx scripts/launch-campaigns.ts ai-ops
 *   npx tsx scripts/launch-campaigns.ts idre-agency
 *   npx tsx scripts/launch-campaigns.ts all
 */

import { getCampaignTemplate } from '../lib/gtm/campaign-templates'

const PRACTICE_GROUPS = ['executive-search', 'ai-ops', 'idre-agency'] as const
type PracticeGroup = typeof PRACTICE_GROUPS[number]

async function launchCampaign(practiceGroup: PracticeGroup) {
  const template = getCampaignTemplate(practiceGroup)

  console.log(`\n🚀 Launching ${template.name}...\n`)

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/gtm/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template)
    })

    const result = await response.json()

    if (result.success) {
      console.log(`✅ Campaign launched successfully!`)
      console.log(`   Campaign ID: ${result.campaignId}`)
      console.log(`   Targets to discover: ${template.targetCount}`)
      console.log(`   Messages per day: ${template.messagesPerDay}`)
      console.log(`\n📊 Next steps:`)
      console.log(`   1. Check Notion GTM Campaigns database`)
      console.log(`   2. Wait for target discovery (1-2 minutes)`)
      console.log(`   3. Review generated outreach at ${process.env.NEXT_PUBLIC_APP_URL}/gtm/approve`)
      console.log(`   4. Approve messages and start sending\n`)
    } else {
      console.log(`❌ Campaign launch failed: ${result.error}`)
      if (result.error?.includes('NOTION_GTM')) {
        console.log(`\n💡 Tip: Set up Notion databases first`)
        console.log(`   See: NOTION_GTM_SETUP.md`)
      }
    }
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`)
  }
}

async function main() {
  const arg = process.argv[2]?.toLowerCase()

  if (!arg || arg === 'help') {
    console.log(`
Wells Onyx - GTM Campaign Launcher

Usage:
  npx tsx scripts/launch-campaigns.ts [practice-group]

Practice Groups:
  executive-search    Executive Search & C-Suite Placements
  ai-ops             AI Operations (24/7 monitoring)
  idre-agency        IDRE Agency (No Surprises Act)
  all                Launch all 3 campaigns

Examples:
  npx tsx scripts/launch-campaigns.ts executive-search
  npx tsx scripts/launch-campaigns.ts all
`)
    return
  }

  if (arg === 'all') {
    console.log('🎯 Launching all 3 autonomous GTM campaigns...')
    for (const pg of PRACTICE_GROUPS) {
      await launchCampaign(pg)
      // Small delay between launches
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    console.log('\n✅ All campaigns launched!')
  } else if (PRACTICE_GROUPS.includes(arg as PracticeGroup)) {
    await launchCampaign(arg as PracticeGroup)
  } else {
    console.log(`❌ Unknown practice group: ${arg}`)
    console.log(`   Valid options: ${PRACTICE_GROUPS.join(', ')}, all`)
  }
}

main()
