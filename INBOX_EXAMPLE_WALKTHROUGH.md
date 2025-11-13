# Inbox System - Example Walkthrough

## Complete Example: Email to Response

This walkthrough demonstrates the complete flow from receiving an email to Wells responding.

### Scenario

**Sender**: Sarah Chen (sarah@acmecorp.com)
**Recipient**: Wells AI (jonah@inbox.wellsai.com)
**Channel**: Email
**Content**: Meeting request with urgency

---

## Step 1: Email Arrives

Sarah sends an email:

```
From: Sarah Chen <sarah@acmecorp.com>
To: jonah@inbox.wellsai.com
Subject: Urgent: Demo Request for Next Week

Hi Jonah,

We're very interested in Wells AI for our procurement team. We've been
struggling with supplier management and I think your solution could help.

Could we schedule a demo for next Tuesday or Wednesday? Our VP of Ops
wants to see it before our quarterly planning meeting on Friday.

Looking forward to hearing from you!

Best,
Sarah Chen
VP of Procurement
Acme Corporation
```

---

## Step 2: Resend Webhook Fires

Resend sends webhook to: `POST /api/inbox/webhooks/email`

**Webhook payload:**
```json
{
  "type": "email.received",
  "data": {
    "from": {
      "email": "sarah@acmecorp.com",
      "name": "Sarah Chen"
    },
    "to": [
      {
        "email": "jonah@inbox.wellsai.com"
      }
    ],
    "subject": "Urgent: Demo Request for Next Week",
    "text": "Hi Jonah,\n\nWe're very interested in Wells AI...",
    "html": "<p>Hi Jonah,</p>...",
    "headers": {
      "message-id": "<abc123@mail.gmail.com>",
      "date": "Mon, 13 Nov 2025 14:30:00 +0000"
    }
  }
}
```

---

## Step 3: Webhook Processing

**Webhook handler** (`/api/inbox/webhooks/email/route.ts`):

1. **Verify signature** ✓
2. **Log webhook event**:
```sql
INSERT INTO webhook_events (source, event_type, raw_payload, ...)
VALUES ('resend', 'email.received', {...}, ...);
```

3. **Extract data**:
   - User ID: `jonah` (from `jonah@inbox.wellsai.com`)
   - Sender: Sarah Chen (sarah@acmecorp.com)
   - Subject: "Urgent: Demo Request for Next Week"
   - Body: Full email text

4. **Find/create thread**:
   - Thread ID: `<abc123@mail.gmail.com>` (from message-id header)
   - First message in thread → Create new thread

```sql
INSERT INTO message_threads (
  user_id, channel, platform_thread_id, subject, participants, ...
) VALUES (
  'jonah', 'email', '<abc123@mail.gmail.com>',
  'Urgent: Demo Request for Next Week',
  '[{"email":"sarah@acmecorp.com","name":"Sarah Chen"},{"email":"jonah@inbox.wellsai.com"}]',
  ...
);
```

5. **Store message**:
```sql
INSERT INTO inbound_messages (
  user_id, channel, sender_email, sender_name,
  subject, body, thread_id, internal_thread_id,
  is_thread_start, urgency, requires_response, ...
) VALUES (
  'jonah', 'email', 'sarah@acmecorp.com', 'Sarah Chen',
  'Urgent: Demo Request for Next Week', 'Hi Jonah...',
  '<abc123@mail.gmail.com>', 'thread-uuid-123',
  true, 'normal', false, -- Will be updated by AI
  ...
);
```

6. **Return success**: `200 OK`

---

## Step 4: Claude Analyzes (Async)

**AI Understanding** (`lib/inbox/understanding.ts`):

Claude receives this prompt:

```
Analyze this incoming message and extract structured information.

**Message Details:**
- Channel: email
- From: Sarah Chen (sarah@acmecorp.com)
- Subject: Urgent: Demo Request for Next Week

**Message Body:**
Hi Jonah,

We're very interested in Wells AI for our procurement team. We've been
struggling with supplier management and I think your solution could help.

Could we schedule a demo for next Tuesday or Wednesday? Our VP of Ops
wants to see it before our quarterly planning meeting on Friday.

Looking forward to hearing from you!

Best,
Sarah Chen
VP of Procurement
Acme Corporation

**Your Task:**
Return JSON with: intent, urgency, sentiment, entities, actionItems,
requiresResponse, suggestedResponse, summary, keyTopics
```

**Claude's Response:**
```json
{
  "intent": "request_meeting",
  "urgency": "high",
  "sentiment": "positive",
  "entities": {
    "names": ["Sarah Chen", "VP of Ops"],
    "companies": ["Acme Corporation", "Wells AI"],
    "dates": ["next Tuesday", "Wednesday", "Friday"],
    "products": ["procurement team", "supplier management"],
    "roles": ["VP of Procurement"]
  },
  "actionItems": [
    {
      "type": "task",
      "description": "Schedule demo for Tuesday or Wednesday",
      "priority": "high",
      "dueDate": "2025-11-19"
    },
    {
      "type": "deadline",
      "description": "Must complete before Friday quarterly planning",
      "priority": "high",
      "dueDate": "2025-11-22"
    }
  ],
  "requiresResponse": true,
  "suggestedResponse": "Hi Sarah,\n\nThanks for reaching out! I'd be happy to schedule a demo of Wells AI for your procurement team. I have availability on Tuesday at 2pm ET or Wednesday at 10am ET. Which works better for you and your VP of Ops?\n\nI'll prepare a customized demo focusing on supplier management and procurement workflows. Looking forward to showing you how Wells AI can help!\n\nBest,\nJonah",
  "summary": "Demo request from VP of Procurement at Acme Corp for supplier management solution, needs to happen before Friday",
  "keyTopics": ["demo request", "procurement", "supplier management", "scheduling", "quarterly planning"]
}
```

**Database Update:**
```sql
UPDATE inbound_messages SET
  processed_at = NOW(),
  intent = 'request_meeting',
  urgency = 'high',
  sentiment = 'positive',
  entities = '{"names": [...], "companies": [...]}',
  action_items = '[{"type": "task", ...}]',
  requires_response = true,
  suggested_response = 'Hi Sarah...'
WHERE id = 'message-uuid-456';
```

**Contact Creation:**
```sql
INSERT INTO contacts (
  user_id, email, name, company, role,
  relationship_type, importance_score,
  first_contact_date, last_contact_date,
  total_messages_received, preferred_channel
) VALUES (
  'jonah', 'sarah@acmecorp.com', 'Sarah Chen',
  'Acme Corporation', 'VP of Procurement',
  'customer', 80, -- High importance (VP + urgent demo)
  NOW(), NOW(), 1, 'email'
);
```

---

## Step 5: Query Inbox

**Frontend/User queries inbox:**

```bash
GET /api/inbox?requiresResponse=true&urgency=high
Headers:
  x-user-id: jonah
```

**Response:**
```json
{
  "success": true,
  "messages": [
    {
      "id": "message-uuid-456",
      "userId": "jonah",
      "channel": "email",
      "senderName": "Sarah Chen",
      "senderEmail": "sarah@acmecorp.com",
      "subject": "Urgent: Demo Request for Next Week",
      "body": "Hi Jonah...",
      "intent": "request_meeting",
      "urgency": "high",
      "sentiment": "positive",
      "requiresResponse": true,
      "suggestedResponse": "Hi Sarah,\n\nThanks for reaching out!...",
      "actionItems": [
        {
          "type": "task",
          "description": "Schedule demo for Tuesday or Wednesday",
          "priority": "high",
          "dueDate": "2025-11-19"
        }
      ],
      "createdAt": "2025-11-13T14:30:00Z"
    }
  ],
  "stats": {
    "unprocessedCount": 0,
    "requiresResponseCount": 1,
    "totalReturned": 1
  }
}
```

---

## Step 6: Review & Respond

**User reviews AI-suggested response**:

Option A: **Use AI response as-is**
```bash
POST /api/inbox/message-uuid-456/respond
Headers:
  x-user-id: jonah
Body:
{
  "requireApproval": false  # Send immediately
}
```

Option B: **Edit AI response**
```bash
POST /api/inbox/message-uuid-456/respond
Headers:
  x-user-id: jonah
Body:
{
  "responseBody": "Hi Sarah,\n\nThanks for reaching out! I'd be happy to schedule a demo. Let's do Tuesday at 2pm ET. I'll send a calendar invite.\n\nBest,\nJonah",
  "requireApproval": false
}
```

Option C: **Draft for later**
```bash
POST /api/inbox/message-uuid-456/respond
Headers:
  x-user-id: jonah
Body:
{
  "responseBody": "...",
  "requireApproval": true  # Save as draft
}
```

---

## Step 7: Send Response

**Backend sends email via Resend:**

```typescript
// lib/inbox/channels/email.ts
const result = await resend.emails.send({
  from: 'jonah@inbox.wellsai.com',
  to: 'sarah@acmecorp.com',
  subject: 'Re: Urgent: Demo Request for Next Week',
  text: 'Hi Sarah,\n\nThanks for reaching out!...',
  headers: {
    'In-Reply-To': '<abc123@mail.gmail.com>',
    'References': '<abc123@mail.gmail.com>'
  }
});
```

**Database Updates:**
```sql
-- Create outbound message
INSERT INTO outbound_messages (
  user_id, in_reply_to, thread_id, channel,
  recipient_email, subject, body,
  status, sent_at, platform_message_id
) VALUES (
  'jonah', 'message-uuid-456', 'thread-uuid-123', 'email',
  'sarah@acmecorp.com', 'Re: Urgent: Demo Request for Next Week',
  'Hi Sarah...',
  'sent', NOW(), 'resend-msg-789'
);

-- Mark original message as responded
UPDATE inbound_messages SET
  responded_at = NOW(),
  response_message_id = 'outbound-uuid-789'
WHERE id = 'message-uuid-456';

-- Update contact stats
UPDATE contacts SET
  total_messages_sent = total_messages_sent + 1,
  last_contact_date = NOW()
WHERE user_id = 'jonah' AND email = 'sarah@acmecorp.com';

-- Update thread
UPDATE message_threads SET
  message_count = message_count + 1,
  last_message_at = NOW()
WHERE id = 'thread-uuid-123';
```

---

## Step 8: Sarah Replies

Sarah responds:

```
From: Sarah Chen <sarah@acmecorp.com>
To: jonah@inbox.wellsai.com
Subject: Re: Urgent: Demo Request for Next Week

Perfect! Tuesday at 2pm ET works great. I'll have our VP of Ops
join as well.

Could you send the calendar invite? And do we need to prepare anything?

Thanks!
Sarah
```

**Webhook fires again** → Same flow, but now:
- Thread already exists (uses `In-Reply-To` header)
- `is_thread_start = false`
- Thread context includes previous messages
- Claude analyzes with full conversation history

**Claude's understanding:**
```json
{
  "intent": "follow_up",
  "urgency": "normal",
  "sentiment": "positive",
  "entities": {
    "dates": ["Tuesday", "2pm ET"],
    "names": ["VP of Ops"]
  },
  "actionItems": [
    {
      "type": "task",
      "description": "Send calendar invite for Tuesday 2pm ET",
      "priority": "high"
    },
    {
      "type": "question",
      "description": "Do they need to prepare anything?",
      "priority": "medium"
    }
  ],
  "requiresResponse": true,
  "suggestedResponse": "Hi Sarah,\n\nGreat! I'll send the calendar invite right away. No preparation needed on your end - I'll walk you through everything during the demo.\n\nLooking forward to it!\n\nBest,\nJonah"
}
```

---

## Auto-Response Example

**Configure auto-response rule:**

```typescript
import { AutoResponseRules } from '@/lib/inbox/db'

// Auto-acknowledge meeting confirmations
await AutoResponseRules.create({
  userId: 'jonah',
  name: 'Auto-acknowledge meeting confirmations',
  enabled: true,
  priority: 90,
  intentFilter: 'follow_up',
  keywordFilters: ['works great', 'confirmed', 'perfect'],
  actionType: 'auto_respond',
  responseTemplate: 'Thanks for confirming! I\'ll send the details shortly.',
  requireApproval: true, // Draft for review
  cooldownHours: 24
})
```

Now when Sarah confirms, Wells can auto-draft a response.

---

## Monitoring & Analytics

**Query recent activity:**
```sql
-- Messages received today
SELECT channel, COUNT(*) as count
FROM inbound_messages
WHERE user_id = 'jonah'
  AND created_at >= CURRENT_DATE
GROUP BY channel;

-- Response rate
SELECT
  COUNT(*) FILTER (WHERE responded_at IS NOT NULL) as responded,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE responded_at IS NOT NULL) / COUNT(*), 2) as response_rate
FROM inbound_messages
WHERE user_id = 'jonah'
  AND requires_response = true
  AND created_at >= CURRENT_DATE - INTERVAL '7 days';

-- Average response time
SELECT
  AVG(EXTRACT(EPOCH FROM (responded_at - created_at)) / 3600) as avg_hours
FROM inbound_messages
WHERE user_id = 'jonah'
  AND responded_at IS NOT NULL
  AND created_at >= CURRENT_DATE - INTERVAL '30 days';
```

**Contact insights:**
```sql
-- Most active contacts
SELECT
  name, email, company,
  total_messages_received,
  total_messages_sent,
  last_contact_date
FROM contacts
WHERE user_id = 'jonah'
ORDER BY total_messages_received DESC
LIMIT 10;

-- High-importance contacts needing response
SELECT
  c.name, c.company, c.importance_score,
  COUNT(im.id) as pending_messages
FROM contacts c
LEFT JOIN inbound_messages im ON c.email = im.sender_email
WHERE c.user_id = 'jonah'
  AND im.requires_response = true
  AND im.responded_at IS NULL
  AND c.importance_score >= 70
GROUP BY c.id
ORDER BY c.importance_score DESC;
```

---

## Summary

This system provides:

1. **Unified inbox** across all channels
2. **AI understanding** of every message
3. **Context-aware threading**
4. **Automated response drafting**
5. **Contact relationship tracking**
6. **Complete audit trail**
7. **Foundation for AI-to-AI communication**

Wells can now:
- Receive messages from anywhere
- Understand intent and urgency
- Draft appropriate responses
- Track all relationships
- Respond across any channel
- Build conversation memory
- Enable fully autonomous communication
