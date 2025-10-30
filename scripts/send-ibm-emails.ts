/**
 * Approve and Send Queued IBM Emails
 * Approves both emails and sends via SendGrid
 */

import { decide } from '../lib/consent'
import { sendEmail } from '../lib/email'

// ===== EMAIL DETAILS =====

const EMAILS = {
  emailA: {
    actionId: 'action_1761860598167_f8jy72irw',
    to: 'awilliams1@ibm.com',
    toName: 'Antoinette',
    subject: 'quick co-sell alignment?',
    text: `Hi Antoinette —
Cath here (cc Jonah, our CEO). We're a new IBM Partner and would love to start the relationship the right way: bring you a deal and follow your preferred co-sell motion.

Could we grab 20 minutes for a light strategy chat? I'd like your guidance on:
    •    which Customer Ops wedge you'd prioritize (watsonx Assistant vs. adjacent),
    •    the right way to register opportunities,
    •    any dos/don'ts we should observe in Q4.

To make this easy, we'll come with 1–2 named accounts and a simple 90-day pilot outline. If helpful, I can send a one-pager before we meet.

Open times (ET): Tue 10:30–11:00, Wed 2:00–2:30, Thu 11:30–12:00 — or happy to work around you.

Warmly,
Cath Garcia
Partners — Wells Onyx
cc: Jonah Manning (CEO)`,
    html: `
<p>Hi Antoinette —</p>
<p>Cath here (cc Jonah, our CEO). We're a new IBM Partner and would love to start the relationship the right way: bring you a deal and follow your preferred co-sell motion.</p>
<p>Could we grab 20 minutes for a light strategy chat? I'd like your guidance on:</p>
<ul>
  <li>which Customer Ops wedge you'd prioritize (watsonx Assistant vs. adjacent),</li>
  <li>the right way to register opportunities,</li>
  <li>any dos/don'ts we should observe in Q4.</li>
</ul>
<p>To make this easy, we'll come with 1–2 named accounts and a simple 90-day pilot outline. If helpful, I can send a one-pager before we meet.</p>
<p>Open times (ET): Tue 10:30–11:00, Wed 2:00–2:30, Thu 11:30–12:00 — or happy to work around you.</p>
<p>Warmly,<br>
Cath Garcia<br>
Partners — Wells Onyx<br>
cc: Jonah Manning (CEO)</p>
`
  },
  emailB: {
    actionId: 'action_1761860598169_gcfr2bnh0',
    to: 'madison.alexander@ibm.com',
    toName: 'Madison',
    subject: 'sanity-check a 90-day Customer Ops pilot?',
    text: `Hi Madison —
I'm Cath at Wells Onyx (cc Jonah). We're exploring a small Customer Ops pilot that pairs watsonx Assistant with our human-in-the-loop workflows to lift resolution speed in 90 days.

Would you be open to a quick sanity-check on the approach and where it fits best in your co-sell motion? We'll keep it light and follow your rules. Goal is to prove value on 1–2 accounts and learn how you want us to engage.

I can send a one-pager ahead of time if useful.
Quick windows (ET): Tue 10:30–11:00, Wed 2:00–2:30, Thu 11:30–12:00.

Thanks so much,
Cath
cc: Jonah`,
    html: `
<p>Hi Madison —</p>
<p>I'm Cath at Wells Onyx (cc Jonah). We're exploring a small Customer Ops pilot that pairs watsonx Assistant with our human-in-the-loop workflows to lift resolution speed in 90 days.</p>
<p>Would you be open to a quick sanity-check on the approach and where it fits best in your co-sell motion? We'll keep it light and follow your rules. Goal is to prove value on 1–2 accounts and learn how you want us to engage.</p>
<p>I can send a one-pager ahead of time if useful.<br>
Quick windows (ET): Tue 10:30–11:00, Wed 2:00–2:30, Thu 11:30–12:00.</p>
<p>Thanks so much,<br>
Cath<br>
cc: Jonah</p>
`
  }
}

// ===== APPROVE & SEND =====

async function sendEmails() {
  console.log('📧 Approving and Sending IBM Partner Outreach Emails\n')

  const results: { email: string; to: string; status: string }[] = []

  // Email A
  console.log('📤 Email A → Antoinette Williams (awilliams1@ibm.com)')
  console.log('   Subject: "quick co-sell alignment?"')
  try {
    // Approve via consent system
    console.log('   ⏳ Approving...')
    await decide(EMAILS.emailA.actionId, 'approve', 'cath')

    // Send via SendGrid
    console.log('   ⏳ Sending...')
    await sendEmail(EMAILS.emailA.actionId, {
      to: EMAILS.emailA.to,
      toName: EMAILS.emailA.toName,
      subject: EMAILS.emailA.subject,
      html: EMAILS.emailA.html,
      text: EMAILS.emailA.text,
      metadata: {
        campaign: 'ibm_partner_outreach',
        emailType: 'intro_partner_alliances',
        from: 'Cath Garcia',
        cc: 'Jonah Manning (CEO)',
        partner: 'ibm'
      }
    })

    results.push({
      email: 'A',
      to: EMAILS.emailA.to,
      status: 'sent'
    })

    console.log('   ✅ Sent!\n')
  } catch (error: any) {
    results.push({
      email: 'A',
      to: EMAILS.emailA.to,
      status: `failed: ${error.message}`
    })
    console.log(`   ❌ Failed: ${error.message}\n`)
  }

  // Email B
  console.log('📤 Email B → Madison Alexander (madison.alexander@ibm.com)')
  console.log('   Subject: "sanity-check a 90-day Customer Ops pilot?"')
  try {
    // Approve via consent system
    console.log('   ⏳ Approving...')
    await decide(EMAILS.emailB.actionId, 'approve', 'cath')

    // Send via SendGrid
    console.log('   ⏳ Sending...')
    await sendEmail(EMAILS.emailB.actionId, {
      to: EMAILS.emailB.to,
      toName: EMAILS.emailB.toName,
      subject: EMAILS.emailB.subject,
      html: EMAILS.emailB.html,
      text: EMAILS.emailB.text,
      metadata: {
        campaign: 'ibm_partner_outreach',
        emailType: 'intro_product_gtm',
        from: 'Cath Garcia',
        cc: 'Jonah Manning (CEO)',
        partner: 'ibm'
      }
    })

    results.push({
      email: 'B',
      to: EMAILS.emailB.to,
      status: 'sent'
    })

    console.log('   ✅ Sent!\n')
  } catch (error: any) {
    results.push({
      email: 'B',
      to: EMAILS.emailB.to,
      status: `failed: ${error.message}`
    })
    console.log(`   ❌ Failed: ${error.message}\n`)
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
  console.log(`📊 Total: ${sentCount}/${results.length} emails sent\n`)

  if (sentCount === results.length) {
    console.log('🎉 All emails sent successfully!')
    console.log('📝 Next Steps:')
    console.log('   1. Track responses in Notion CRM')
    console.log('   2. Prepare to send one-pager PDF if requested')
    console.log('   3. Schedule strategy calls')
    console.log('   4. Present Acme Health + Northwind Insurance as pilot candidates')
    console.log('   5. Mark "Two target emails sent" ✅ on Christmas-Ready checklist\n')
  } else {
    console.log('⚠️  Some emails failed to send.')
    console.log('   Check SendGrid configuration in .env.local')
    console.log('   Verify SENDGRID_API_KEY, FROM_EMAIL, FROM_NAME\n')
  }

  return results
}

// ===== MAIN =====

async function main() {
  try {
    console.log('⚠️  IMPORTANT: This will send real emails to IBM contacts!')
    console.log('   - Antoinette Williams (awilliams1@ibm.com)')
    console.log('   - Madison Alexander (madison.alexander@ibm.com)')
    console.log('')
    console.log('   Emails will be sent from: Cath Garcia')
    console.log('   (Configure FROM_EMAIL and FROM_NAME in .env.local)')
    console.log('')
    console.log('   Starting in 3 seconds...\n')

    // Wait 3 seconds to give time to cancel if needed
    await new Promise(resolve => setTimeout(resolve, 3000))

    await sendEmails()
    console.log('✅ Done!\n')
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

main().catch(console.error)
