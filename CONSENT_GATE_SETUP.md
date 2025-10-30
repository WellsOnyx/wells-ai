# Consent Gate System - Setup & Usage

**Built:** Oct 30, 2025
**Goal:** No outbound actions without human approval

---

## What Is Consent Gate?

The Consent Gate ensures Wells AI **never** sends SMS, emails, partner outreach, or any outbound action without explicit human approval.

**Flow:**
1. AI wants to take action (send SMS, email, etc.)
2. Action is queued for approval
3. User sees modal: `<Approve | Reject | View Details>`
4. User clicks → Decision logged to Notion audit
5. Action executes (if approved) or cancelled (if rejected)

**Audit:** Every decision is logged with `{actionId, user, timestamp, decision}` for compliance.

---

## Files Created

```
app/components/ConsentModal.tsx       # UI modal component
lib/consent.ts                         # Core consent logic + Notion audit
app/api/consent/decide/route.ts       # API: Process decision
app/api/consent/pending/route.ts      # API: Get pending actions
```

---

## Notion Setup (5 minutes)

### Step 1: Create Audit Actions Database

1. Go to your Notion workspace
2. Create new database: **"Audit Actions"**
3. Add these properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| Action ID | Title | Unique action identifier |
| Action Type | Select | Options: sms, email, partner_outreach, rfq_notification, payment, gtm_outreach, hr_offer |
| Title | Rich Text | Action description |
| Recipient | Rich Text | Who receives the action (email/phone) |
| Decision | Select | Options: approve, reject |
| Decided By | Rich Text | User who made decision |
| Decided At | Date | Timestamp of decision |
| Reason | Rich Text | Optional reason for rejection |
| Message Preview | Rich Text | Preview of message content |

### Step 2: Get Database ID

1. Click "..." menu → **Copy link to view**
2. Extract database ID from URL:
   ```
   https://notion.so/username/XXXXXXXXXXXXX?v=...
                              ↑ This is the database ID
   ```

### Step 3: Add to Environment Variables

In Vercel or `.env.local`:

```bash
NOTION_AUDIT_ACTIONS_DB=your_database_id_here
```

**Done!** Consent decisions will now be logged to Notion.

---

## Usage Guide

### Example 1: SMS with Consent

**Before (no consent):**
```typescript
// Directly send SMS - BAD ❌
await twilioClient.messages.create({
  body: message,
  from: TWILIO_PHONE_NUMBER,
  to: recipientPhone,
})
```

**After (with consent):**
```typescript
import { queueAction } from '@/lib/consent'

// Queue action for approval
const action = queueAction({
  actionType: 'sms',
  title: 'Send RFQ notification to supplier',
  description: `Notify ${supplierName} about new RFQ #${rfqId}`,
  recipient: recipientPhone,
  messagePreview: `Wells Onyx: New RFQ #${rfqId} - ${productName}. Quote due: ${deadline}. Reply 1=View | 2=Pass`,
  metadata: {
    rfqId,
    supplierName,
    productName,
    deadline
  }
})

// Return action to frontend for user approval
return { success: true, actionId: action.actionId, requiresConsent: true }
```

**Frontend shows ConsentModal:**
```tsx
import ConsentModal from '@/app/components/ConsentModal'
import { useState } from 'react'

function MyComponent() {
  const [pendingAction, setPendingAction] = useState(null)

  const handleDecision = async (actionId, decision) => {
    const response = await fetch('/api/consent/decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionId,
        decision,
        decidedBy: 'jonah@wellsonyx.com' // Or get from session
      })
    })

    const result = await response.json()

    if (result.success && decision === 'approve') {
      // NOW send the SMS
      await sendSMS(...)
    }
  }

  return (
    <>
      {pendingAction && (
        <ConsentModal
          action={pendingAction}
          onDecision={handleDecision}
          onClose={() => setPendingAction(null)}
        />
      )}
    </>
  )
}
```

---

### Example 2: Partner Outreach with Consent

```typescript
import { queueAction } from '@/lib/consent'

// Queue partner email for approval
const action = queueAction({
  actionType: 'partner_outreach',
  title: 'Send AWS co-sell email',
  description: 'Initial outreach to AWS Partner Manager about Wells Onyx co-sell opportunity',
  recipient: 'aws-partner@example.com',
  messagePreview: `Subject: Wells Onyx + AWS: Executive Search Co-Sell Opportunity\n\nHi [Partner Manager],\n\nI'm Jonah Manning, CEO at Wells Onyx...`,
  metadata: {
    partner: 'AWS',
    partnerTier: 1,
    estimatedRevenue: 10000000
  }
})

// User approves → Email sends
// User rejects → Email cancelled, decision logged
```

---

### Example 3: Bulk Actions with Consent

```typescript
// Queue multiple actions at once
const actions = suppliers.map(supplier =>
  queueAction({
    actionType: 'sms',
    title: `Notify ${supplier.name} about RFQ`,
    description: `Send RFQ notification to ${supplier.name}`,
    recipient: supplier.phone,
    messagePreview: `Wells Onyx: New RFQ #${rfqId}...`,
    metadata: { supplierId: supplier.id, rfqId }
  })
)

// User sees batch approval modal:
// "Approve all (12 actions)" or "Review individually"
```

---

## API Endpoints

### POST `/api/consent/decide`

Process a consent decision.

**Request:**
```json
{
  "actionId": "action_1698765432_abc123",
  "decision": "approve",
  "decidedBy": "jonah@wellsonyx.com",
  "reason": "Looks good, sending"
}
```

**Response:**
```json
{
  "success": true,
  "decision": {
    "actionId": "action_1698765432_abc123",
    "decision": "approve",
    "decidedBy": "jonah@wellsonyx.com",
    "decidedAt": "2025-10-30T15:30:00.000Z"
  },
  "action": {
    "actionId": "action_1698765432_abc123",
    "actionType": "sms",
    "title": "Send RFQ notification to supplier",
    "status": "approved"
  }
}
```

### GET `/api/consent/pending`

Get all pending actions awaiting approval.

**Response:**
```json
{
  "success": true,
  "count": 3,
  "actions": [
    {
      "actionId": "action_123",
      "actionType": "sms",
      "title": "Send RFQ notification",
      "description": "Notify supplier about RFQ",
      "recipient": "+18325551234",
      "messagePreview": "Wells Onyx: New RFQ...",
      "status": "pending",
      "createdAt": "2025-10-30T15:00:00.000Z"
    },
    // ... more actions
  ]
}
```

---

## Testing

### Test Flow (3 minutes)

1. **Queue a test action:**
```typescript
const action = queueAction({
  actionType: 'sms',
  title: 'Test SMS notification',
  description: 'Testing consent flow',
  recipient: '+18505551234',
  messagePreview: 'Test message from Wells AI'
})
```

2. **Check pending actions:**
```bash
curl https://wellsai.vercel.app/api/consent/pending
```

3. **Approve the action:**
```bash
curl -X POST https://wellsai.vercel.app/api/consent/decide \
  -H "Content-Type: application/json" \
  -d '{
    "actionId": "action_123...",
    "decision": "approve",
    "decidedBy": "test-user"
  }'
```

4. **Check Notion:** Decision should appear in Audit Actions database

---

## Benefits

### Compliance
- ✅ TCPA compliance (no SMS without consent)
- ✅ CAN-SPAM compliance (no email without approval)
- ✅ Audit trail for regulators

### Safety
- ✅ No rogue AI sending messages
- ✅ Human review before outbound actions
- ✅ Catch mistakes before they happen

### Trust
- ✅ Users trust Wells AI (they control everything)
- ✅ Transparency (see exactly what AI wants to do)
- ✅ Peace of mind (nothing happens without approval)

---

## Next Steps

### Phase 1: Manual Approval (Current)
- Every action requires click-to-approve
- Good for testing, low volume

### Phase 2: Smart Approval (Future)
- Auto-approve low-risk actions (RFQ confirmations)
- Require approval for high-risk (large payments, new partners)
- ML learns from past decisions

### Phase 3: Batch Approval (Future)
- Queue all actions for day
- Review batch at 9am: "Approve all (47 actions)"
- Or review individually

---

## Troubleshooting

### "Action not found in pending queue"
**Cause:** Action was already approved/rejected or expired
**Fix:** Check `/api/consent/pending` to see current queue

### "Audit log not saved to Notion"
**Cause:** `NOTION_AUDIT_ACTIONS_DB` not configured
**Fix:** Add database ID to environment variables

### Modal not showing
**Cause:** Frontend not polling for pending actions
**Fix:** Fetch `/api/consent/pending` periodically or on action trigger

---

## Questions?

- **Jonah:** jonah@wellsonyx.com / 850-459-1961
- **Notion Setup:** Check NOTION_HR_SETUP.md for similar database setup guide
- **Code:** See `lib/consent.ts` for implementation details

---

**Wells AI: World-class means human-in-the-loop for every action.**
