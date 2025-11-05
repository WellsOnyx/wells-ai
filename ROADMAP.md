# Grain & Vault - Product Roadmap

**Philosophy:** Ship one thing at a time. Complete each feature before moving to the next. Quality over quantity.

---

## ✅ SHIPPED

### Phase 1: Foundation (Complete)
- [x] Dynamic homepage with animated infrastructure
- [x] Early investor landing page ($1.00 GRAIN locked pricing)
- [x] Real-time NAV price display
- [x] Founding investor email capture
- [x] Rebrand Wells AI → Wells
- [x] Memory system with Prisma database
- [x] SMS integration via Twilio
- [x] Partner referral system architecture

---

## 🚀 NOW SHIPPING (Priority Order)

### 1. Gmail OAuth for 1:1 Executive Outreach
**Why First:** Instantly credits refreshed. Highest deliverability. Perfect for Wells Onyx's exec search business.

**User Story:**
"I need to send a personalized email to the CEO of Acme Corp from my personal Gmail account, so it has maximum deliverability and appears in my Sent folder."

**Acceptance Criteria:**
- [ ] User can click "Connect Gmail" in Settings
- [ ] OAuth flow requests `gmail.send` permission
- [ ] Refresh token stored encrypted in EmailProvider table
- [ ] Wells can send email FROM user's actual Gmail
- [ ] Email appears in user's Gmail Sent folder
- [ ] Rate limiting respects Gmail's 500/day limit
- [ ] Wells suggests Gmail for single high-value sends

**API Endpoint:**
```
POST /api/gtm/email/send
{
  "provider": "gmail",
  "to": "ceo@targetcompany.com",
  "subject": "...",
  "body": "...",
  "userId": "user_123"
}
```

**Database Migration:**
```bash
# Already designed in EMAIL_DELIVERY_ARCHITECTURE.md
npx prisma migrate dev --name add_email_providers
```

**Files to Create:**
- `app/api/auth/gmail/callback/route.ts` - OAuth callback handler
- `app/api/gtm/email/send/route.ts` - Unified send endpoint
- `app/api/gtm/email/providers/route.ts` - List user's connected providers
- `app/settings/email/page.tsx` - Email provider settings UI
- `lib/email/gmail.ts` - Gmail API wrapper
- `lib/email/router.ts` - Provider selection logic

**Estimated Time:** 1 day

---

### 2. Instantly API Integration
**Why Next:** Credits refreshed. Perfect for sequences and follow-ups.

**User Story:**
"I want to add 10 qualified leads to an automated 3-email sequence that follows up every 3 days, tracked in Instantly."

**Acceptance Criteria:**
- [ ] User can connect Instantly API key in Settings
- [ ] Wells creates campaign in Instantly via API
- [ ] Wells adds prospects to sequence with custom variables
- [ ] Wells tracks open/click/reply rates
- [ ] Multi-step sequences (3-7 emails) configured via Wells
- [ ] Instantly handles warmup and sending schedule

**API Endpoint:**
```
POST /api/gtm/email/sequence
{
  "provider": "instantly",
  "campaignName": "Q1 Executive Search",
  "prospects": [...],
  "sequence": [
    { "day": 0, "subject": "...", "body": "..." },
    { "day": 3, "subject": "...", "body": "..." }
  ]
}
```

**Files to Create:**
- `lib/email/instantly.ts` - Instantly API wrapper
- `app/api/gtm/campaign/create/route.ts` - Campaign creation
- `app/api/gtm/campaign/prospects/route.ts` - Add prospects to campaign

**Estimated Time:** 1 day

---

### 3. Wells Training: Grain & Vault Deep Knowledge
**Why Next:** Wells needs to explain the platform intimately and guide users on maximizing benefits.

**User Story:**
"When I ask Wells 'How does GRAIN work?', it should explain the stablecoin mechanics, NAV appreciation, and how to maximize returns."

**Acceptance Criteria:**
- [ ] Wells understands GRAIN tokenomics (1:1 USDC backing)
- [ ] Wells explains NAV auto-appreciation from transaction fees
- [ ] Wells guides users on founding investor benefits
- [ ] Wells knows Vault Treasury mechanics (escrow, settlements)
- [ ] Wells can compare GRAIN to traditional stablecoins
- [ ] Wells encourages early adoption with concrete examples

**Implementation:**
```typescript
// In app/api/chat/route.ts system prompt
const WELLS_KNOWLEDGE = `
You are Wells, the conversational interface for Grain & Vault.

## Platform Knowledge

**GRAIN Stablecoin:**
- Fully backed 1:1 by USDC in Vault Treasury
- Auto-appreciating: NAV increases as transaction fees accrue
- Launched at $1.00, current NAV tracks in real-time
- Founding investors locked in $1.00 entry price
- Every transaction on platform increases NAV for all holders
- Deployed on Base blockchain for low fees and fast settlements

**Vault Treasury:**
- Holds all USDC backing GRAIN tokens
- Processes B2B payments, escrow, and settlements
- Earns 0.33% fee on every transaction
- 100% of fees flow to GRAIN holders via NAV appreciation
- Transparent reserves - users can verify backing on-chain

**Founding Investor Opportunity:**
- Lock in $1.00 price before public launch
- Minimum $10,000 investment
- 87 spots remaining of 100 total
- Early investors get preferential fee structures
- NAV already at $1.0417 and rising

**How to Maximize Benefits:**
1. Become a founding investor at $1.00
2. Use Vault for all B2B transactions (earn fees while you transact)
3. Hold GRAIN long-term to capture NAV appreciation
4. Refer partners to increase transaction volume (increases your NAV)
`;
```

**Files to Modify:**
- `app/api/chat/route.ts` - Add Grain & Vault knowledge to system prompt
- Add examples of user questions and Wells responses

**Estimated Time:** 2 hours

---

### 4. Enterprise Homepage: Wells Interface Front & Center
**Why Next:** Emotional response. Show, don't tell.

**User Story:**
"When I land on the homepage, I should immediately see Wells in action, not just read about it."

**Acceptance Criteria:**
- [ ] Hero section features live Wells chat interface
- [ ] Demo conversation showcasing real capabilities
- [ ] Animated typing indicators and responses
- [ ] Click "Try Wells" button to open full chat
- [ ] Wells ghost visible and engaging
- [ ] Mobile-responsive chat embed

**Design Concept:**
```
+--------------------------------------------------+
|  [Grain & Vault Logo]              [Sign In]    |
+--------------------------------------------------+
|                                                  |
|   Infrastructure You Can See                     |
|                                                  |
|   [Live Wells Chat Interface - 40% of screen]   |
|   ┌─────────────────────────────────┐           |
|   │ 👻 Wells                        │           |
|   │ ───────────────────────────────│           |
|   │ User: I need to find a CFO     │           |
|   │                                 │           |
|   │ Wells: I'll search our network │           |
|   │ of 2,847 financial executives...│          |
|   │ [Animated search visualization]│           |
|   │                                 │           |
|   │ Found 12 matches. Top 3:       │           |
|   │ • Sarah Chen (ex-Stripe CFO)  │           |
|   │ • Mike Torres (B2B SaaS)      │           |
|   │ • Lisa Wang (FinTech)         │           |
|   └─────────────────────────────────┘           |
|                                                  |
|   [CTA: Talk to Wells →]                        |
+--------------------------------------------------+
```

**Files to Modify:**
- `app/components/EnterpriseLanding.tsx` - Redesign hero section
- Create demo conversation component with auto-play

**Estimated Time:** 4 hours

---

### 5. SendGrid Integration (Bulk Email)
**Why Later:** Less urgent. Gmail + Instantly cover most use cases.

**User Story:**
"I want to send a newsletter to 500 verified opt-ins about Grain & Vault launch."

**Estimated Time:** 1 day

---

### 6. Partner Recommendation in Wells Chat
**Why Later:** Infrastructure exists, just needs chat integration.

**User Story:**
"When I mention 'payment processing' in chat, Wells should recommend Connect Services with referral link."

**Estimated Time:** 2 hours

---

## 📋 BACKLOG (Not Prioritized)

### Email Features
- [ ] Outlook OAuth integration
- [ ] Salesforce email sending
- [ ] HubSpot email sending
- [ ] Apollo integration
- [ ] Email template library
- [ ] A/B testing for subject lines
- [ ] Email warmup automation

### GTM Features
- [ ] ICP analysis dashboard
- [ ] Lead scoring ML model
- [ ] Automated outreach sequences
- [ ] Deal pipeline kanban
- [ ] Revenue attribution tracking
- [ ] Meeting scheduling integration

### Platform Features
- [ ] GRAIN smart contract deployment
- [ ] Vault escrow automation
- [ ] ACH/Wire payment rails
- [ ] Crypto settlement options
- [ ] Partner referral tracking dashboard
- [ ] Investor portal with NAV charts

### Mobile
- [ ] Wells iOS app
- [ ] Push notifications
- [ ] Biometric auth
- [ ] Offline mode

---

## 🎯 Success Metrics

### Email Delivery
- Gmail OAuth: 90%+ deliverability rate
- Instantly: 50%+ open rate on cold outreach
- Average response rate: 15%+

### Platform Adoption
- Founding investors: 100 spots filled
- GRAIN market cap: $1M+ by launch
- Transaction volume: $10M in first 90 days

### Wells Engagement
- Daily active users: 100+
- Average session length: 8+ minutes
- User satisfaction: 4.5+ stars

---

## 📞 Support

Questions about the roadmap? Ask Wells:
- **Chat:** https://wellsai.vercel.app/app
- **SMS:** Text "Wells" to your registered number

---

**Last Updated:** 2025-01-05
**Next Feature Shipping:** Gmail OAuth (estimated 2025-01-06)

Built by Wells Onyx
Powered by Grain & Vault
