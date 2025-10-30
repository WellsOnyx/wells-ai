# Twilio A2P 10DLC Setup - For Sam

**Date**: Oct 30, 2025
**Task**: Complete A2P 10DLC registration for Wells Onyx SMS
**Timeline**: 10-15 minutes to fill forms, 24-48 hours for approval
**Cost**: ~$20 one-time, $1.50/month ongoing

---

## What's Already Done ✅

- Twilio account created
- Phone number purchased: **+1 (832) 702-3075**
- SMS opt-in page live: https://wellsai.vercel.app/sms-opt-in
- Toll-free verification attempted (rejected - that's why we're doing this)

---

## What You Need to Do

Complete 3-step registration in Twilio console to enable SMS on the local number.

---

## Step 1: Access Twilio Console

1. Go to: https://console.twilio.com
2. Login with: **[Jonah will provide credentials]**
3. In left sidebar, click: **Messaging** → **Regulatory Compliance** → **A2P 10DLC Overview**
4. You should see 3 registration steps:
   - Create Standard Customer Profile
   - Register Standard Brand
   - Register Standard Campaign

---

## Step 2: Create Customer Profile (FREE)

**Click on "Profile needs" or "Create Customer Profile"**

### Form Fields & Answers:

**Business Information:**
- **Business Legal Name**: `Wells Onyx LLC` (or whatever legal entity Jonah confirms)
- **DBA/Trade Name** (if asked): `Wells Onyx`
- **Business Type**: `Limited Liability Company (LLC)` OR `Sole Proprietorship` (ask Jonah which)
- **Tax ID Type**:
  - If LLC: `EIN` (ask Jonah for EIN)
  - If Sole Prop: `SSN` (Jonah provides)
- **Tax ID Number**: `[Ask Jonah]`

**Business Address:**
```
[Ask Jonah for official business address]
Street:
City:
State:
ZIP:
Country: United States
```

**Business Contact:**
- **First Name**: `Jonah`
- **Last Name**: `Manning`
- **Email**: `jonah@wellsonyx.com`
- **Phone**: `850-459-1961`
- **Job Title**: `CEO`

**Business Details:**
- **Website**: `https://wellsonyx.com`
- **Industry**: `Professional Services` or `Business Services`
- **Year Established**: `[Ask Jonah - likely 2024 or 2025]`
- **Number of Employees**: `1-10`

**Stock Information** (if asked):
- **Publicly traded?**: `No`
- **Stock ticker**: Leave blank

**Business Regions:**
- **Countries you operate in**: `United States`
- **States/Regions**: `All 50 states` OR `Florida` (ask Jonah)

Click **Save** or **Continue**

---

## Step 3: Register Brand ($4.50 one-time)

**Click "Register Standard Brand"**

### Form Fields & Answers:

**Brand Type:**
- Select: `Standard Brand` (NOT Low-Volume)
- Cost: $46 one-time (Standard) OR $4.50 (Low-Volume - choose this if asked)

**Brand Information:**
- **Brand Name**: `Wells Onyx`
- **Brand Website**: `https://wellsonyx.com`
- **Vertical/Industry**: `Professional Services` or `Business Services`
- **Brand Description**:
```
Wells Onyx provides B2B procurement, executive search, and business services. We send transactional SMS notifications to suppliers and partners regarding quotes, orders, and procurement updates.
```

**Brand Relationship to Customer Profile:**
- Select: `Direct Brand` (Wells Onyx owns the messaging)

**Social Media** (optional but helps approval):
- **LinkedIn**: `https://www.linkedin.com/company/wells-onyx` (if exists, otherwise leave blank)
- **Twitter**: Leave blank unless Jonah has one
- **Facebook**: Leave blank unless Jonah has one

**Additional Info:**
- **Help/Support Email**: `jonah@wellsonyx.com`
- **Support Phone**: `850-459-1961`

Click **Submit** and pay $4.50 (or $46 for Standard)

**Wait 5-10 minutes for brand approval** (usually instant, sometimes takes 1 hour)

---

## Step 4: Register Campaign ($15 one-time + $1.50/month)

**After brand is approved, click "Register Standard Campaign"**

### Form Fields & Answers:

**Campaign Type:**
- **Use Case**: `2-Way` OR `Notifications` (choose Notifications)
- **Campaign Description**:
```
Wells Onyx sends transactional notifications to suppliers and partners about:
- New procurement requests (RFQs)
- Quote deadlines and reminders
- Purchase order updates
- Payment confirmations
- Account notifications

Recipients opt-in by providing phone number during onboarding or texting us to confirm.
```

**Message Flow:**
- **Sample Message 1**:
```
Wells Onyx: New RFQ #1234 - Circuit Boards (Qty: 500). Quote due: Nov 5. Reply: 1=View Details | 2=Pass
```
- **Sample Message 2**:
```
Wells Onyx: Quote #5678 approved! PO #9012 issued. Total: $12,500. Expected delivery: Nov 15.
```
- **Sample Message 3**:
```
Wells Onyx: Payment processed for PO #9012. $12,500 sent via ACH. Expected in 2-3 business days.
```

**Opt-In Process:**
- **How do users opt-in?**:
```
Users opt-in by:
1. Providing phone number during Wells Onyx supplier registration
2. Texting us to confirm opt-in
3. Replying to initial SMS with "1" to confirm

Opt-in page: https://wellsai.vercel.app/sms-opt-in
```

**Opt-Out Process:**
- **How do users opt-out?**:
```
Users can text STOP to immediately unsubscribe. They receive confirmation: "You've been unsubscribed from Wells Onyx SMS."
```

**Help/Info:**
- **Help response**:
```
Users can text HELP to receive: "Wells Onyx Help: You'll receive procurement notifications. Reply STOP to unsubscribe. Questions? Call 850-459-1961 or email jonah@wellsonyx.com"
```

**Message Volume:**
- **Estimated daily volume**: `100-500 messages per day` (start conservative)
- **Estimated monthly volume**: `3,000-15,000 messages per month`

**Privacy & Terms:**
- **Privacy Policy URL**: `https://wellsai.vercel.app/privacy`
- **Terms & Conditions URL**: `https://wellsai.vercel.app/terms`

**Compliance:**
- Check box: `We comply with TCPA regulations`
- Check box: `We have explicit user consent before sending`
- Check box: `We provide clear opt-out instructions`

Click **Submit** and pay $15 + $1.50/month

---

## Step 5: Wait for Approval

**Timeline**: 24-48 hours (sometimes instant)

**What to expect:**
1. Email to jonah@wellsonyx.com when approved
2. Campaign status changes from "Pending" to "Approved"
3. SMS immediately enabled on phone number +1 (832) 702-3075

**If rejected:**
- Check email for rejection reason
- Usually: need more detail in campaign description or samples
- Resubmit with more info (no extra fee for resubmission)

---

## Step 6: Update Vercel Environment Variable

**After approval, tell Jonah to update this:**

In Vercel project settings, update:
```
TWILIO_PHONE_NUMBER=+18327023075
```

(This is the purchased number - needs to be in env vars for SMS to work)

---

## Step 7: Test SMS (After Approval)

**Once approved, test it:**

1. Go to: https://wellsai.vercel.app/api/sms/test
2. Send POST request with:
```json
{
  "testMessage": "Test from Wells Onyx - SMS is working!"
}
```

OR

3. In Twilio console, go to: Messaging → Try it out → Send an SMS
4. From: `+1 (832) 702-3075`
5. To: `850-459-1961` (Jonah's cell)
6. Body: `Test message`
7. Click Send

**If you receive the text: ✅ SMS IS WORKING**

---

## Troubleshooting

### Issue: Brand registration rejected
**Solution**:
- Add more detail to brand description
- Add social media links (LinkedIn, Twitter)
- Use business email domain (not @gmail)
- Provide business registration documents

### Issue: Campaign registration rejected
**Solution**:
- Add more sample messages (show variety)
- Be more specific in campaign description
- Clarify opt-in process with URL
- Show clear opt-out instructions

### Issue: Low Trust Score
**Solution**:
- Trust Score affects throughput (messages/day)
- Start with low volume, build reputation
- Higher score comes with time + compliance
- Low score still allows 200-500 msgs/day (enough for Wells)

---

## Costs Summary

- **Customer Profile**: FREE
- **Brand Registration**: $4.50 (Low-Volume) OR $46 (Standard) - one-time
- **Campaign Registration**: $15 one-time
- **Campaign Monthly Fee**: $1.50/month per campaign
- **Phone Number**: $1.15/month (already paid)

**Total One-Time**: ~$20
**Total Monthly**: ~$2.65

---

## Information You Need from Jonah

Before starting, confirm with Jonah:

1. **Business Legal Name**: Wells Onyx LLC? Or different entity?
2. **Business Type**: LLC or Sole Proprietorship?
3. **EIN or SSN**: Tax ID number
4. **Business Address**: Official address for registration
5. **Year Established**: When was Wells Onyx founded?
6. **Twilio Login**: Username/password for Twilio console

---

## Expected Timeline

- **Your time**: 10-15 minutes to fill forms
- **Approval time**: 24-48 hours
- **Total time to working SMS**: 1-3 days

---

## After It's Working

Once SMS is approved and working:

**Test endpoint**: https://wellsai.vercel.app/api/sms/test
**Webhook**: https://wellsai.vercel.app/api/webhooks/sms (for receiving replies)

SMS will be used for:
- Supplier notifications (RFQs, POs, payments)
- Partner notifications
- Customer notifications
- 2-way communication (they can reply)

---

## Questions?

- **Twilio Support**: https://support.twilio.com
- **A2P 10DLC Docs**: https://www.twilio.com/docs/messaging/regulatory/a2p-10dlc
- **Jonah**: jonah@wellsonyx.com / 850-459-1961

---

**Good luck Sam! This should take 10-15 minutes. Let Jonah know when it's approved.**
