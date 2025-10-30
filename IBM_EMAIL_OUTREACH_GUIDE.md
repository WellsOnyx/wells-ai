# IBM Partner Outreach - Email Guide

## Quick Start

Send two ultra-soft intro emails to IBM contacts through the consent-gated email system.

## Prerequisites

1. **IBM Contact Details** - You need:
   - Email A: IBM Partner/Alliances contact (name + email)
   - Email B: IBM Product GTM / watsonx Assistant contact (name + email)

2. **SendGrid Configured** - Set in `.env.local`:
   ```bash
   SENDGRID_API_KEY=your_key_here
   FROM_EMAIL=cath@wellsonyx.com  # Or noreply@wellsonyx.com
   FROM_NAME=Cath Garcia
   ```

## How to Send

### Option 1: Automated Script (Recommended)

1. **Update recipients** in `scripts/queue-ibm-emails.ts`:
   ```typescript
   const RECIPIENTS = {
     emailA: {
       email: 'jane.smith@ibm.com',  // Real IBM Partner/Alliances contact
       firstName: 'Jane',
       role: 'IBM Partner/Alliances'
     },
     emailB: {
       email: 'john.doe@ibm.com',    // Real IBM Product GTM contact
       firstName: 'John',
       role: 'IBM Product GTM (watsonx Assistant)'
     }
   }
   ```

2. **Queue both emails**:
   ```bash
   npm run queue:ibm-emails
   ```

3. **Output shows action IDs**:
   ```
   Email A: jane.smith@ibm.com
   Action ID: act_1234567890

   Email B: john.doe@ibm.com
   Action ID: act_0987654321
   ```

4. **Approve & send** via API or consent system:
   ```bash
   # Use the action IDs from step 3
   curl -X POST http://localhost:3000/api/email/send \
     -H "Content-Type: application/json" \
     -d '{"actionId": "act_1234567890", "action": "send", "approvedBy": "cath"}'
   ```

### Option 2: Manual via UI

1. Navigate to `/partners/ibm/email`

2. **Email A** - Fill in:
   - **To:** `partner@ibm.com`
   - **To Name:** `Jane`
   - **Subject:** `quick co-sell alignment?`
   - **Message:** Copy from templates below

3. Click **"Queue for Approval"**

4. Review, then click **"Approve & Send"**

5. Repeat for **Email B**

## Email Templates

### Email A: IBM Partner/Alliances Co-Sell Alignment

**Subject:** `quick co-sell alignment?`

**Message:**
```
Hi {{FirstName}} —
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
cc: Jonah Manning (CEO)
```

---

### Email B: IBM Product GTM Sanity-Check

**Subject:** `sanity-check a 90-day Customer Ops pilot?`

**Message:**
```
Hi {{FirstName}} —
I'm Cath at Wells Onyx (cc Jonah). We're exploring a small Customer Ops pilot that pairs watsonx Assistant with our human-in-the-loop workflows to lift resolution speed in 90 days.

Would you be open to a quick sanity-check on the approach and where it fits best in your co-sell motion? We'll keep it light and follow your rules. Goal is to prove value on 1–2 accounts and learn how you want us to engage.

I can send a one-pager ahead of time if useful.
Quick windows (ET): Tue 10:30–11:00, Wed 2:00–2:30, Thu 11:30–12:00.

Thanks so much,
Cath
cc: Jonah
```

## Attachments

Both emails mention "I can send a one-pager if useful" - attach this when following up:
- **File:** `/out/ibm_customer_ops_co-sell_90day-pilot.pdf`
- **Generated via:** `npm run gen:ibm`

## Audit Trail

All emails are logged to the audit trail with:
- Action ID
- Policy version (2025.10.30.001)
- Timestamp
- Approval decision
- Recipient details
- Campaign: `ibm_partner_outreach`

## Consent Flow

```
Queue → Pending Approval → Approve → Send → Audit Log
```

Every email requires explicit approval before sending. No silent outbound.

## From/CC Configuration

- **From:** Cath Garcia (cath@wellsonyx.com)
- **CC:** Jonah Manning (CEO)

Update `FROM_EMAIL` and `FROM_NAME` in `.env.local` to match.

## Next Steps After Sending

1. Mark "Two target emails sent" ✅ on Christmas-Ready checklist
2. Track responses in Notion CRM
3. Follow up with one-pager PDF if requested
4. Schedule strategy calls with IBM contacts
5. Begin co-sell motion

---

**Status:** Ready to send as soon as IBM contacts are identified.
