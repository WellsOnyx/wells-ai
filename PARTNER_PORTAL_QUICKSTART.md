# Partner Portal Quick Start Guide

**Test the complete partner onboarding flow in 5 minutes**

---

## Prerequisites

- Wells AI application running locally or deployed
- Supabase database with `white_label_partners` table
- Browser with developer tools (optional)

---

## Step 1: Visit Partner Landing Page

```
URL: http://localhost:3000/partners
```

**What you'll see:**
- Hero section: "Embed Treasury Infrastructure. Earn 20% Revenue Share."
- Benefits cards (Revenue, Integration, Security)
- How It Works (4-step diagram)
- Use cases (Marketplaces, Accounting, HR, etc.)
- CTA button: "Apply Now"

**Action:** Click "Apply Now"

---

## Step 2: Fill Out Application Form

```
URL: http://localhost:3000/partners/apply
```

### Step 1 of 4: Company Information

```
Company Name: Test Corp
Platform Name: TestPay
Domain: testcorp.io
Industry: Marketplace
```

Click "Next"

### Step 2 of 4: Contact Information

```
Full Name: John Smith
Email: john@testcorp.io
Phone: +1 (555) 123-4567
```

Click "Next"

### Step 3 of 4: Platform Details

```
Estimated Monthly Volume: $100K - $500K
Estimated Monthly Transactions: 100 - 1,000
Use Case: "Marketplace platform connecting freelancers with clients.
          Need embedded payments for escrow and instant payouts."
Current Payment Provider: Stripe (optional)
```

Click "Next"

### Step 4 of 4: Revenue Share

```
Adjust slider to 20% (default)
```

**See real-time breakdown:**
- Wells Fee (1% of transaction): $10.00
- Your Share (20%): $2.00
- Wells Net: $8.00

Click "Submit Application"

---

## Step 3: Copy Credentials (CRITICAL!)

**⚠️ IMPORTANT: These are shown only once!**

You'll see a success screen with:

```
✓ Application Approved!

API Key: wl_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4
         [Copy button]

Webhook Secret: abc123def456ghi789jkl012mno345pqr678stu901vwx234
                [Copy button]
```

**Action:**
1. Click "Copy" next to API Key
2. Paste it somewhere safe (Notes app, password manager)
3. Click "Copy" next to Webhook Secret
4. Paste it somewhere safe

Then click "Go to Dashboard"

---

## Step 4: Explore Dashboard

```
URL: http://localhost:3000/partners/dashboard
```

**You'll see:**

### Overview Cards (will show $0 initially)
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ Total       │ Fees        │ Trans-      │ Avg         │
│ Volume      │ Earned      │ actions     │ Transaction │
│ $0          │ $0          │ 0           │ $0          │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

### Volume Chart
- Empty bar chart (no data yet)

### API Status
```
Status: ● Operational (green)
Uptime: 99.99%
Avg Response: 87ms
Revenue Share: 20%
```

### Recent Transactions
- Empty table (no transactions yet)

**Navigation:**
- Click "API Docs" to see documentation
- Click "Settings" to configure webhook

---

## Step 5: Review API Documentation

```
URL: http://localhost:3000/partners/docs
```

**Tabs:**
1. **Overview** - Base URL, features, rate limits
2. **Authentication** - How to use API key
3. **API Endpoints** - Code examples (cURL, JS, Python)
4. **Webhooks** - Event types, payload examples
5. **Error Handling** - HTTP status codes

**Try copying a code example:**
- Click on "JavaScript" section
- Click "Copy" button
- Paste in your text editor

---

## Step 6: Configure Settings

```
URL: http://localhost:3000/partners/settings
```

### Update Contact Information
```
Full Name: John Smith
Email: john.smith@testcorp.io
Phone: +1 (555) 123-4567
```

Click "Save Contact Info"

### Configure Webhook
```
Webhook URL: https://testcorp.io/webhooks/wells
```

Click "Save Webhook URL"

**You'll see:** Green success message "Settings saved successfully"

### Test API Key Regeneration (Optional)

1. Scroll to "API Key Management"
2. Click "Regenerate API Key"
3. Modal appears with warning
4. Click "Yes, Regenerate"
5. New API key displayed
6. Copy it (shown only once!)
7. Click "I've Copied It - Use This Key"

⚠️ **Warning:** Old API key is now invalid!

---

## Step 7: Test the API

### Using cURL

```bash
# 1. Process a test transaction
curl -X POST http://localhost:3000/api/partners/transact \
  -H "X-API-Key: wl_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "external_id": "test_tx_001",
    "sender_id": "user_100",
    "sender_email": "sender@example.com",
    "recipient_id": "user_200",
    "recipient_email": "recipient@example.com",
    "amount": 1000,
    "currency": "USDC",
    "metadata": {
      "order_id": "order_123",
      "test": true
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "transaction": {
    "id": "uuid-here",
    "external_id": "test_tx_001",
    "amount": 1000,
    "currency": "USDC",
    "status": "completed",
    "fees": {
      "total": 10.00,
      "partner_share": 2.00
    },
    "created_at": "2025-12-07T10:30:00Z"
  }
}
```

### Using JavaScript (Node.js)

```javascript
const apiKey = 'wl_your_api_key_here';

async function testTransaction() {
  const response = await fetch('http://localhost:3000/api/partners/transact', {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      external_id: 'test_tx_001',
      sender_id: 'user_100',
      sender_email: 'sender@example.com',
      recipient_id: 'user_200',
      recipient_email: 'recipient@example.com',
      amount: 1000,
      currency: 'USDC',
      metadata: {
        order_id: 'order_123',
        test: true
      }
    })
  });

  const data = await response.json();
  console.log('Transaction Result:', data);
}

testTransaction();
```

### Using Python

```python
import requests
import os

api_key = 'wl_your_api_key_here'

response = requests.post(
    'http://localhost:3000/api/partners/transact',
    headers={
        'X-API-Key': api_key,
        'Content-Type': 'application/json'
    },
    json={
        'external_id': 'test_tx_001',
        'sender_id': 'user_100',
        'sender_email': 'sender@example.com',
        'recipient_id': 'user_200',
        'recipient_email': 'recipient@example.com',
        'amount': 1000,
        'currency': 'USDC',
        'metadata': {
            'order_id': 'order_123',
            'test': True
        }
    }
)

print('Transaction Result:', response.json())
```

---

## Step 8: Verify Dashboard Updated

After processing a test transaction, refresh the dashboard:

```
URL: http://localhost:3000/partners/dashboard
```

**You should now see:**

### Overview Cards (Updated!)
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ Total       │ Fees        │ Trans-      │ Avg         │
│ Volume      │ Earned      │ actions     │ Transaction │
│ $1,000      │ $2.00       │ 1           │ $1,000      │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

### Volume Chart
- One bar showing today's volume

### Recent Transactions
```
┌──────────────┬─────────┬──────────┬───────────┬──────────┐
│ ID           │ Amount  │ Your Fee │ Status    │ Date     │
├──────────────┼─────────┼──────────┼───────────┼──────────┤
│ test_tx_001  │ $1,000  │ $2.00    │ completed │ Dec 7    │
└──────────────┴─────────┴──────────┴───────────┴──────────┘
```

---

## Step 9: Check Silent Enrollment (Database)

**Query Supabase:**

```sql
-- Check if sender account was created
SELECT * FROM silent_accounts
WHERE email = 'sender@example.com';

-- Check if recipient account was created
SELECT * FROM silent_accounts
WHERE email = 'recipient@example.com';

-- Both should have:
-- • wallet_address (0x...)
-- • first_touch = 'white_label_TestPay'
-- • activation_level = 'ghost'
-- • metadata with partner_id
```

**Result:** Two new silent accounts created automatically!

---

## Step 10: Test Error Handling

### Invalid API Key
```bash
curl -X POST http://localhost:3000/api/partners/transact \
  -H "X-API-Key: invalid_key" \
  -H "Content-Type: application/json" \
  -d '{"sender_id": "user_1", "recipient_id": "user_2", "amount": 100}'
```

**Expected Response:**
```json
{
  "error": "Invalid API key"
}
```
**Status Code:** 401

### Missing Required Fields
```bash
curl -X POST http://localhost:3000/api/partners/transact \
  -H "X-API-Key: wl_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"sender_id": "user_1"}'
```

**Expected Response:**
```json
{
  "error": "sender_id, recipient_id, and amount are required"
}
```
**Status Code:** 400

### Invalid Amount
```bash
curl -X POST http://localhost:3000/api/partners/transact \
  -H "X-API-Key: wl_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"sender_id": "user_1", "recipient_id": "user_2", "amount": -100}'
```

**Expected Response:**
```json
{
  "error": "Amount must be positive"
}
```
**Status Code:** 400

---

## Testing Checklist

- [ ] Landing page loads and displays correctly
- [ ] Application form validates required fields
- [ ] Multi-step navigation works (Next/Back buttons)
- [ ] Revenue share slider updates breakdown in real-time
- [ ] Application submission creates partner record
- [ ] API key and webhook secret displayed on success
- [ ] Dashboard loads with API key authentication
- [ ] Dashboard shows $0 values initially
- [ ] API documentation pages render correctly
- [ ] Settings page updates contact info
- [ ] Settings page updates webhook URL
- [ ] API key regeneration shows warning modal
- [ ] Transaction API processes successfully
- [ ] Dashboard updates after transaction
- [ ] Silent accounts created automatically
- [ ] Error responses return correct status codes
- [ ] Logout clears session and redirects

---

## Common Issues & Solutions

### "No API key found" error
**Solution:** Make sure you clicked "Go to Dashboard" from the success screen, or manually store the API key:
```javascript
sessionStorage.setItem('wells_partner_api_key', 'wl_your_key_here');
```

### Dashboard shows "Failed to load partner data"
**Solution:**
1. Check API key is stored: `sessionStorage.getItem('wells_partner_api_key')`
2. Verify API key is valid in database
3. Check Supabase connection

### Transaction fails with 500 error
**Solution:**
1. Check Supabase service role key is set
2. Verify `white_label_partners` table exists
3. Check database logs for errors

### Volume chart is empty
**Solution:** Process at least one transaction, then refresh the page

---

## Next Steps

After testing the portal:

1. **Integration Testing**
   - Build a sample partner app
   - Integrate the transaction API
   - Test webhook delivery

2. **Load Testing**
   - Simulate multiple partners
   - Process bulk transactions
   - Monitor API performance

3. **Admin Features**
   - Build partner admin panel
   - Add partner analytics
   - Create revenue reports

4. **Production Deployment**
   - Set up production database
   - Configure production API keys
   - Enable webhook signatures
   - Set up monitoring/alerts

---

## Support

**Questions?**
- Check `/partners/docs` for API documentation
- Review `PARTNER_PORTAL_README.md` for detailed guide
- See `PARTNER_PORTAL_FLOW.md` for visual diagrams

**Found a bug?**
- Check browser console for errors
- Review API response in Network tab
- Check Supabase logs for database errors

---

**Happy Testing!**

The partner portal is now ready for production use. Each partner onboarded = thousands of silent accounts enrolled.
