/**
 * Queue IBM Partner Outreach Emails
 * Queues two ultra-soft intro emails through consent system
 */

import { queueEmail } from '../lib/email'
import { createEmailHTML } from '../lib/email'

// ===== EMAIL TEMPLATES =====

const EMAIL_A = {
  subject: 'quick co-sell alignment?',

  textTemplate: (firstName: string) => `Hi ${firstName} —
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

  htmlTemplate: (firstName: string) => `
<p>Hi ${firstName} —</p>
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
}

const EMAIL_B = {
  subject: 'sanity-check a 90-day Customer Ops pilot?',

  textTemplate: (firstName: string) => `Hi ${firstName} —
I'm Cath at Wells Onyx (cc Jonah). We're exploring a small Customer Ops pilot that pairs watsonx Assistant with our human-in-the-loop workflows to lift resolution speed in 90 days.

Would you be open to a quick sanity-check on the approach and where it fits best in your co-sell motion? We'll keep it light and follow your rules. Goal is to prove value on 1–2 accounts and learn how you want us to engage.

I can send a one-pager ahead of time if useful.
Quick windows (ET): Tue 10:30–11:00, Wed 2:00–2:30, Thu 11:30–12:00.

Thanks so much,
Cath
cc: Jonah`,

  htmlTemplate: (firstName: string) => `
<p>Hi ${firstName} —</p>
<p>I'm Cath at Wells Onyx (cc Jonah). We're exploring a small Customer Ops pilot that pairs watsonx Assistant with our human-in-the-loop workflows to lift resolution speed in 90 days.</p>
<p>Would you be open to a quick sanity-check on the approach and where it fits best in your co-sell motion? We'll keep it light and follow your rules. Goal is to prove value on 1–2 accounts and learn how you want us to engage.</p>
<p>I can send a one-pager ahead of time if useful.<br>
Quick windows (ET): Tue 10:30–11:00, Wed 2:00–2:30, Thu 11:30–12:00.</p>
<p>Thanks so much,<br>
Cath<br>
cc: Jonah</p>
`
}

// ===== RECIPIENT CONFIGURATION =====

interface Recipient {
  email: string
  firstName: string
  role: string
}

// Real IBM contacts from leads.csv
const RECIPIENTS = {
  emailA: {
    email: 'awilliams1@ibm.com',
    firstName: 'Antoinette',
    role: 'IBM eAI Partnerships (watsonx)'
  } as Recipient,

  emailB: {
    email: 'madison.alexander@ibm.com',
    firstName: 'Madison',
    role: 'IBM AI Partnerships (watsonx SME)'
  } as Recipient
}

// ===== QUEUE EMAILS =====

async function queueEmails() {
  console.log('📧 Queueing IBM Partner Outreach Emails\n')

  const results: { email: string; actionId: string; recipient: string }[] = []

  // Queue Email A
  console.log('Queueing Email A: IBM Partner/Alliances co-sell alignment...')
  try {
    const actionIdA = await queueEmail({
      to: RECIPIENTS.emailA.email,
      toName: RECIPIENTS.emailA.firstName,
      subject: EMAIL_A.subject,
      html: EMAIL_A.htmlTemplate(RECIPIENTS.emailA.firstName),
      text: EMAIL_A.textTemplate(RECIPIENTS.emailA.firstName),
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
      actionId: actionIdA,
      recipient: `${RECIPIENTS.emailA.firstName} (${RECIPIENTS.emailA.role})`
    })

    console.log(`✅ Email A queued: ${actionIdA}\n`)
  } catch (error: any) {
    console.error(`❌ Failed to queue Email A: ${error.message}\n`)
  }

  // Queue Email B
  console.log('Queueing Email B: IBM Product GTM sanity-check...')
  try {
    const actionIdB = await queueEmail({
      to: RECIPIENTS.emailB.email,
      toName: RECIPIENTS.emailB.firstName,
      subject: EMAIL_B.subject,
      html: EMAIL_B.htmlTemplate(RECIPIENTS.emailB.firstName),
      text: EMAIL_B.textTemplate(RECIPIENTS.emailB.firstName),
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
      actionId: actionIdB,
      recipient: `${RECIPIENTS.emailB.firstName} (${RECIPIENTS.emailB.role})`
    })

    console.log(`✅ Email B queued: ${actionIdB}\n`)
  } catch (error: any) {
    console.error(`❌ Failed to queue Email B: ${error.message}\n`)
  }

  // Summary
  console.log('═══════════════════════════════════════════════════')
  console.log('✅ EMAILS QUEUED FOR APPROVAL')
  console.log('═══════════════════════════════════════════════════\n')

  results.forEach(({ email, actionId, recipient }) => {
    console.log(`Email ${email}: ${recipient}`)
    console.log(`Action ID: ${actionId}`)
    console.log(`Status: Pending approval\n`)
  })

  console.log('Next Steps:')
  console.log('1. Review the emails in the consent queue')
  console.log('2. Approve via consent.decide(actionId, "approve", "cath")')
  console.log('3. Emails will be sent via SendGrid')
  console.log('4. All actions logged to audit trail\n')

  console.log('Note: Update RECIPIENTS in this script with actual IBM contacts before sending.\n')

  return results
}

// ===== MAIN =====

async function main() {
  try {
    await queueEmails()
    console.log('🎉 Done!\n')
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

main().catch(console.error)
