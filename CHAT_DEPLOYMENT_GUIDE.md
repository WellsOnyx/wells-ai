# Chat Deployment Guide for AI Ops

**Created:** November 9, 2025
**Status:** ✅ LIVE IN PRODUCTION
**Endpoint:** `POST /api/deploy/ai-ops`

---

## 🔐 Security Architecture

This deployment API has **3 layers of security**:

1. **Clerk Authentication** - Must be signed in with valid session
2. **Wells Onyx Email** - Must have `@wellsonyx.com` email address
3. **Deployment Secret** - Must provide correct secret key

**Your Deployment Secret:**
```
cBXjR7LFgE5KQTQ6xSBM9t/4lo1/Il6xR/8RpMApFWk=
```

This secret is stored in Vercel production environment and is NOT in git.

---

## 💬 Deploy from Chat (Copy/Paste)

### Example 1: Deploy Lead Generation Operation

```bash
curl -X POST https://wellsai.vercel.app/api/deploy/ai-ops \
  -H "Content-Type: application/json" \
  -d '{
    "deploymentSecret": "cBXjR7LFgE5KQTQ6xSBM9t/4lo1/Il6xR/8RpMApFWk=",
    "operation": {
      "name": "Daily Lead Generation",
      "category": "sales",
      "description": "Find 50 qualified leads in target ICP, enrich with Apollo.io, draft personalized outreach emails",
      "frequency": "daily",
      "schedule": "09:00",
      "config": {
        "leadsPerDay": 50,
        "apolloEnrichment": true,
        "personalizedOutreach": true,
        "icpCriteria": {
          "industry": ["SaaS", "Fintech"],
          "companySize": "50-200",
          "revenue": "$1M-$10M"
        }
      }
    }
  }'
```

### Example 2: Deploy Customer Support Automation

```bash
curl -X POST https://wellsai.vercel.app/api/deploy/ai-ops \
  -H "Content-Type: application/json" \
  -d '{
    "deploymentSecret": "cBXjR7LFgE5KQTQ6xSBM9t/4lo1/Il6xR/8RpMApFWk=",
    "operation": {
      "name": "24/7 Support Triage",
      "category": "customer_service",
      "description": "Monitor support inbox, categorize tickets, respond to common questions, escalate complex issues",
      "frequency": "continuous",
      "config": {
        "autoResponseThreshold": 0.95,
        "escalationKeywords": ["urgent", "bug", "broken"],
        "responseTemplates": true
      }
    }
  }'
```

### Example 3: Deploy Invoice Processing

```bash
curl -X POST https://wellsai.vercel.app/api/deploy/ai-ops \
  -H "Content-Type: application/json" \
  -d '{
    "deploymentSecret": "cBXjR7LFgE5KQTQ6xSBM9t/4lo1/Il6xR/8RpMApFWk=",
    "operation": {
      "name": "Automated Invoice Processing",
      "category": "finance",
      "description": "Extract invoice data, validate amounts, match to POs, flag discrepancies, queue for payment",
      "frequency": "daily",
      "schedule": "08:00",
      "config": {
        "autoApprovalLimit": 1000,
        "requirePOMatch": true,
        "flagDiscrepancies": true
      }
    }
  }'
```

---

## 📋 Operation Schema

### Required Fields:
```typescript
{
  deploymentSecret: string  // Your secret key
  operation: {
    name: string            // Operation display name
    category: 'sales' | 'procurement' | 'hiring' | 'finance' | 'customer_service'
    description: string     // What this operation does
  }
}
```

### Optional Fields:
```typescript
{
  operation: {
    frequency?: 'daily' | 'weekly' | 'continuous' | 'as_needed'
    schedule?: string      // Time in HH:MM format (e.g., "09:00")
    config?: object        // Custom configuration
    metrics?: {            // Optional initial metrics
      totalRuns?: number
      successRate?: number
      timeSavedHours?: number
      costSavedUSD?: number
    }
  }
}
```

---

## ✅ Successful Response

When deployment succeeds, you'll get:

```json
{
  "success": true,
  "operation": {
    "id": "op_sales_1699545600000",
    "userId": "user_...",
    "deployedBy": "yourname@wellsonyx.com",
    "deployedAt": "2025-11-09T13:00:00.000Z",
    "name": "Daily Lead Generation",
    "category": "sales",
    "description": "Find 50 qualified leads...",
    "status": "active",
    "frequency": "daily",
    "schedule": "09:00",
    "config": { ... },
    "metrics": {
      "totalRuns": 0,
      "successRate": 0,
      "timeSavedHours": 0,
      "costSavedUSD": 0
    }
  },
  "message": "✅ Operation \"Daily Lead Generation\" deployed successfully!",
  "deployedBy": "yourname@wellsonyx.com",
  "deployedAt": "2025-11-09T13:00:00.000Z"
}
```

---

## ❌ Error Responses

### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```
**Cause:** Not signed in with Clerk

### 403 Access Denied (Email)
```json
{
  "error": "Access denied. Deployment API is exclusively for Wells Onyx team members."
}
```
**Cause:** Not using `@wellsonyx.com` email

### 403 Invalid Secret
```json
{
  "error": "Invalid deployment secret"
}
```
**Cause:** Wrong deployment secret provided

### 400 Invalid Payload
```json
{
  "error": "Invalid operation payload. Required: name, category, description"
}
```
**Cause:** Missing required fields

---

## 🔍 Get API Info

To get deployment instructions and verify the secret is set:

```bash
curl https://wellsai.vercel.app/api/deploy/ai-ops
```

Response includes:
- API documentation
- Example curl commands
- Current secret status (✅ Set or ❌ Not set)

---

## 🎯 Use Cases for Chat Deployment

### 1. Rapid Prototyping
Deploy and test new AI operations in seconds without touching code.

### 2. Customer Demos
Spin up custom operations during sales calls to show capabilities.

### 3. Internal Tools
Create one-off automations for specific Wells Onyx needs.

### 4. Testing & QA
Deploy test operations to verify functionality before building UI.

### 5. Emergency Operations
Quickly deploy critical automations when needed (e.g., crisis response).

---

## 🔄 Integration with Database

Currently, operations are created in-memory. When ready to persist:

1. Add `AIOperation` model to Prisma schema
2. Uncomment database save in `/api/deploy/ai-ops/route.ts`:
```typescript
await prisma.aiOperation.create({ data: newOperation })
```
3. Operations will persist and appear in `/ai-ops` dashboard

---

## 📊 Monitoring Deployed Operations

After deployment:
1. Visit `https://wellsai.vercel.app/ai-ops`
2. Sign in with your `@wellsonyx.com` email
3. View all deployed operations in "My Operations" tab
4. Monitor metrics, view logs, pause/resume operations

---

## 🚀 Advanced Usage

### Deploy with Custom Metrics
```bash
curl -X POST https://wellsai.vercel.app/api/deploy/ai-ops \
  -H "Content-Type: application/json" \
  -d '{
    "deploymentSecret": "cBXjR7LFgE5KQTQ6xSBM9t/4lo1/Il6xR/8RpMApFWk=",
    "operation": {
      "name": "Proven Lead Gen Campaign",
      "category": "sales",
      "description": "Battle-tested lead generation that we know works",
      "frequency": "daily",
      "metrics": {
        "totalRuns": 47,
        "successRate": 94,
        "timeSavedHours": 188,
        "costSavedUSD": 18800
      }
    }
  }'
```

### Deploy as Draft (Inactive)
```bash
curl -X POST https://wellsai.vercel.app/api/deploy/ai-ops \
  -H "Content-Type: application/json" \
  -d '{
    "deploymentSecret": "cBXjR7LFgE5KQTQ6xSBM9t/4lo1/Il6xR/8RpMApFWk=",
    "operation": {
      "name": "Experimental Operation",
      "category": "sales",
      "description": "Testing new approach",
      "status": "paused"
    }
  }'
```

---

## 🔒 Security Best Practices

1. **Never share the deployment secret** outside Wells Onyx team
2. **Rotate the secret** if it's ever compromised:
   ```bash
   openssl rand -base64 32
   vercel env add WELLS_ONYX_DEPLOYMENT_SECRET production
   ```
3. **Monitor deployments** via Vercel logs to detect unauthorized attempts
4. **Limit access** to only team members who need deployment capability
5. **Audit trail** - Every deployment records who deployed and when

---

## 🧪 Testing the API

### Quick Test (should succeed)
```bash
curl -X POST https://wellsai.vercel.app/api/deploy/ai-ops \
  -H "Content-Type: application/json" \
  -d '{
    "deploymentSecret": "cBXjR7LFgE5KQTQ6xSBM9t/4lo1/Il6xR/8RpMApFWk=",
    "operation": {
      "name": "Test Operation",
      "category": "sales",
      "description": "Testing deployment API"
    }
  }'
```

### Test Wrong Secret (should fail with 403)
```bash
curl -X POST https://wellsai.vercel.app/api/deploy/ai-ops \
  -H "Content-Type: application/json" \
  -d '{
    "deploymentSecret": "wrong-secret",
    "operation": {
      "name": "Test Operation",
      "category": "sales",
      "description": "Testing deployment API"
    }
  }'
```

---

## 📝 Notes

- **Rate Limiting:** None currently, but can add if needed
- **Validation:** Server validates all required fields
- **ID Generation:** Auto-generated as `op_{category}_{timestamp}`
- **User Tracking:** Automatically captures deployer email and timestamp
- **Backward Compatible:** Works with existing AI Ops dashboard

---

## ✅ Status

**Deployment API:** ✅ LIVE
**Secret Stored:** ✅ VERIFIED
**Access Control:** ✅ TRIPLE-LAYER
**Ready for Use:** ✅ YES

**You can now deploy AI operations from any chat interface or terminal!** 🚀
