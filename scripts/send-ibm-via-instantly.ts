/**
 * Send IBM Emails via Instantly
 * Adds both IBM contacts to Instantly campaign
 */

import { addLeadToCampaign } from '../lib/instantly'

// ===== CONFIGURATION =====

const CAMPAIGN_ID = 'eccf70e8-aefd-4cd1-853b-9a4bd63a0c63' // partnerships Telecom

const IBM_CONTACTS = [
  {
    email: 'awilliams1@ibm.com',
    firstName: 'Antoinette',
    lastName: 'Williams',
    companyName: 'IBM',
    role: 'eAI Partnerships (watsonx)',
    emailType: 'A - Partner/Alliances Co-Sell Alignment'
  },
  {
    email: 'madison.alexander@ibm.com',
    firstName: 'Madison',
    lastName: 'Alexander',
    companyName: 'IBM',
    role: 'AI Partnerships (watsonx SME)',
    emailType: 'B - Product GTM Sanity-Check'
  }
]

// ===== SEND EMAILS =====

async function sendEmails() {
  console.log('📧 Sending IBM Partner Outreach Emails via Instantly\n')
  console.log(`Campaign: "partnerships Telecom"`)
  console.log(`Campaign ID: ${CAMPAIGN_ID}\n`)

  const results: { email: string; to: string; status: string }[] = []

  for (const contact of IBM_CONTACTS) {
    console.log(`📤 ${contact.emailType}`)
    console.log(`   To: ${contact.firstName} ${contact.lastName} (${contact.email})`)
    console.log(`   Role: ${contact.role}`)

    try {
      const result = await addLeadToCampaign({
        lead: {
          email: contact.email,
          firstName: contact.firstName,
          lastName: contact.lastName,
          companyName: contact.companyName,
          customVariables: {
            role: contact.role,
            source: 'wells_onyx_ibm_outreach',
            partner: 'ibm',
            wedge: 'Customer Ops',
            target_accounts: 'Acme Health, Northwind Insurance'
          }
        },
        campaignId: CAMPAIGN_ID,
        skipIfInWorkspace: false,
        skipIfInCampaign: true
      })

      if (result.success) {
        results.push({
          email: contact.emailType.split(' - ')[0],
          to: contact.email,
          status: 'sent'
        })
        console.log(`   ✅ Added to campaign\n`)
      } else {
        results.push({
          email: contact.emailType.split(' - ')[0],
          to: contact.email,
          status: `failed: ${result.error}`
        })
        console.log(`   ❌ Failed: ${result.error}\n`)
      }
    } catch (error: any) {
      results.push({
        email: contact.emailType.split(' - ')[0],
        to: contact.email,
        status: `error: ${error.message}`
      })
      console.log(`   ❌ Error: ${error.message}\n`)
    }
  }

  // Summary
  console.log('═══════════════════════════════════════════════════')
  console.log('📨 EMAIL SUMMARY')
  console.log('═══════════════════════════════════════════════════\n')

  results.forEach(({ email, to, status }) => {
    const emoji = status === 'sent' ? '✅' : '❌'
    console.log(`${emoji} Email ${email}: ${to}`)
    console.log(`   Status: ${status}\n`)
  })

  const sentCount = results.filter(r => r.status === 'sent').length
  console.log(`📊 Total: ${sentCount}/${results.length} emails sent via Instantly\n`)

  if (sentCount === results.length) {
    console.log('🎉 All emails sent successfully!')
    console.log('📝 Next Steps:')
    console.log('   1. Emails will be sent via Instantly campaign sequence')
    console.log('   2. Track responses in Instantly dashboard')
    console.log('   3. Follow up with one-pager PDF if requested')
    console.log('   4. Schedule strategy calls with IBM')
    console.log('   5. Present Acme Health + Northwind Insurance as pilot candidates')
    console.log('   6. ✅ Mark "Two target emails sent" on Christmas-Ready checklist\n')
  } else {
    console.log('⚠️  Some emails failed to send.')
    console.log('   Check Instantly API configuration\n')
  }

  return results
}

// ===== MAIN =====

async function main() {
  try {
    console.log('⚠️  PRODUCTION MODE: This will send real emails via Instantly!')
    console.log('   - Antoinette Williams (awilliams1@ibm.com)')
    console.log('   - Madison Alexander (madison.alexander@ibm.com)')
    console.log('')
    console.log('   Campaign: "partnerships Telecom" (Co-Sell)')
    console.log('   From: Wells Onyx (via Instantly)')
    console.log('')
    console.log('   Starting in 3 seconds...\n')

    await new Promise(resolve => setTimeout(resolve, 3000))

    await sendEmails()
    console.log('✅ Done!\n')
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

main().catch(console.error)
