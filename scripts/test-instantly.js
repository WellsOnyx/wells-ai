#!/usr/bin/env node
/**
 * Instantly API Test Script
 * Tests the Instantly.ai API integration
 */

const API_KEY = 'ba8a76eb-e37f-4aa2-976d-f4d8e29decec:uDoANcRDluKZ'
const BASE_URL = 'https://api.instantly.ai/api/v1'

async function testInstantlyAPI() {
  console.log('🧪 Testing Instantly API Integration\n')
  console.log('=' .repeat(60))

  // Test 1: List Campaigns
  console.log('\n📋 Test 1: List All Campaigns')
  console.log('-'.repeat(60))

  try {
    const response = await fetch(`${BASE_URL}/campaign/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ api_key: API_KEY })
    })

    const data = await response.json()

    if (response.ok && !data.error) {
      console.log('✅ SUCCESS - Campaigns retrieved')

      if (data.campaigns && data.campaigns.length > 0) {
        console.log(`\nFound ${data.campaigns.length} campaign(s):\n`)

        data.campaigns.forEach((campaign, idx) => {
          console.log(`${idx + 1}. ${campaign.name}`)
          console.log(`   ID: ${campaign.id}`)
          console.log(`   Status: ${campaign.status}`)
          console.log(`   Created: ${campaign.created_at || 'N/A'}`)
          if (campaign.stats) {
            console.log(`   Stats:`)
            console.log(`     - Sent: ${campaign.stats.sent || 0}`)
            console.log(`     - Opened: ${campaign.stats.opened || 0}`)
            console.log(`     - Replied: ${campaign.stats.replied || 0}`)
          }
          console.log()
        })

        // Show recommendation
        const activeCampaigns = data.campaigns.filter(c => c.status === 'active')
        if (activeCampaigns.length > 0) {
          console.log('💡 RECOMMENDED DEFAULT CAMPAIGN:')
          console.log(`   Set INSTANTLY_DEFAULT_CAMPAIGN_ID="${activeCampaigns[0].id}"`)
        }
      } else {
        console.log('⚠️  No campaigns found')
      }
    } else {
      console.log('❌ FAILED - Error:', data.error || response.statusText)
    }
  } catch (error) {
    console.log('❌ FAILED - Exception:', error.message)
  }

  // Test 2: Get Account Info
  console.log('\n👤 Test 2: Get Account Information')
  console.log('-'.repeat(60))

  try {
    const response = await fetch(`${BASE_URL}/account/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ api_key: API_KEY })
    })

    const data = await response.json()

    if (response.ok && !data.error) {
      console.log('✅ SUCCESS - Account info retrieved')
      console.log('\nAccount Details:')
      console.log(`   Email: ${data.email || 'N/A'}`)
      console.log(`   Name: ${data.name || 'N/A'}`)
      console.log(`   Company: ${data.company || 'N/A'}`)
      console.log(`   Plan: ${data.plan || 'N/A'}`)
      console.log(`   Credits: ${data.credits || 'N/A'}`)
    } else {
      console.log('❌ FAILED - Error:', data.error || response.statusText)
    }
  } catch (error) {
    console.log('❌ FAILED - Exception:', error.message)
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 TEST SUMMARY')
  console.log('='.repeat(60))
  console.log('\nAPI Key Format: UUID:SECRET')
  console.log('Base URL: https://api.instantly.ai/api/v1')
  console.log('Auth Method: POST with api_key in JSON body')
  console.log('\n✅ Tests Complete!')
}

// Run tests
testInstantlyAPI().catch(console.error)
