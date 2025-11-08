# Wells AI Engine - Phase 1 Test Plan

**Status:** Deployed to production
**URL:** https://grainandvault.com/app
**Date:** November 8, 2025
**Version:** Enhanced Conversational System v2

---

## 🎯 Test Objectives

Validate that Wells AI delivers:
1. Flawless onboarding experience
2. Intelligent, context-aware conversations
3. Seamless journey switching
4. Persistent memory and context
5. Real actions that work (database writes, API calls)
6. Natural, helpful, proactive personality

---

## 🧪 Test Scenarios

### **Test 1: Onboarding - Seller Journey**

**Goal:** Verify Wells can onboard a seller and immediately start helping them.

**Steps:**
1. Sign up → redirected to `/app`
2. Wells greeting: "Hey [Name], which journey are you on today?"
3. User: "I need to sell my product"
4. Wells should:
   - Ask 2-3 discovery questions naturally
   - Learn: what they sell, who they sell to, goals
   - Create profile with `[ACTION:CREATE_PROFILE:...]`
   - Set journey with `[ACTION:SET_JOURNEY:{journey:"seller"}]`
   - Immediately offer to help: "Great! Let's build your first campaign..."

**Expected Results:**
- ✅ Profile created in database (UserProfile table)
- ✅ Conversation marked as onboarded
- ✅ Active journey = "seller"
- ✅ Wells transitions to seller mode naturally
- ✅ No forms, no buttons, pure conversation

**Check Database:**
```sql
SELECT * FROM "UserProfile" WHERE "userId" = 'user_xxx';
SELECT * FROM "Conversation" WHERE "userId" = 'user_xxx';
SELECT "onboardingCompleted", "activeJourney" FROM "Conversation";
```

---

### **Test 2: Seller Journey - Campaign Creation**

**Goal:** Verify Wells can build and launch an outbound campaign.

**Steps:**
1. After onboarding (from Test 1)
2. User: "I sell AI-powered analytics to SaaS companies"
3. Wells should:
   - Extract ICP naturally
   - Suggest campaign strategy
   - Offer to find leads: "I can find 50 SaaS CEOs..."
   - Create campaign when ready

**Expected Wells Actions:**
- `[ACTION:CREATE_CAMPAIGN:{name:"...",icp:{...},value_prop:"..."}]`
- Should show initiative, not wait for permission

**Personality Check:**
- Direct, confident, proactive
- No corporate speak
- Uses contractions ("I'll find" not "I will find")
- Takes action, doesn't just advise

---

### **Test 3: Buyer Journey - Procurement**

**Goal:** Verify Wells can handle sourcing and RFQ creation.

**Steps:**
1. New user or journey switch
2. User: "I need to source 10,000 custom t-shirts"
3. Wells should:
   - Ask specific questions (specs, timeline, budget)
   - Create detailed RFQ
   - Find suppliers
   - Send RFQs

**Expected Wells Actions:**
- `[ACTION:CREATE_RFQ:{product:"custom t-shirts",specs:"...",quantity:10000,...}]`
- RFQ created in database with correct fields

**Check Database:**
```sql
SELECT * FROM "RFQ" WHERE "userId" = 'user_xxx';
SELECT "title", "description", "status" FROM "RFQ";
```

---

### **Test 4: Job Seeker Journey - Job Search**

**Goal:** Verify Wells can help someone find and apply to jobs.

**Steps:**
1. New user or journey switch
2. User: "I'm looking for a product manager role"
3. Wells should:
   - Discover skills, experience, preferences
   - Ask about resume
   - Offer to optimize resume
   - Find matching jobs
   - Apply on their behalf (with permission)

**Expected Wells Actions:**
- `[ACTION:FIND_JOBS:{skills:["..."],titles:["Product Manager"],...}]`
- `[ACTION:OPTIMIZE_RESUME:{target_role:"Product Manager"}]`
- Proactive and helpful tone

---

### **Test 5: Founder Journey - Multi-Journey Orchestration**

**Goal:** Verify Wells can handle complex, multi-faceted founder needs.

**Steps:**
1. User: "I'm a founder, I need to hire, source materials, AND sell"
2. Wells should:
   - Understand they need all 3 journeys
   - Prioritize: "Let's start with hiring. What role?"
   - Switch between journeys seamlessly
   - Track everything

**Expected Behavior:**
- Journey switches dynamically based on conversation
- Context maintained across switches
- No confusion, clean transitions

**Example:**
```
User: "I need to hire a designer"
Wells: [switches to job_seeker mode] "Got it. What kind of designer..."
User: "Also, I need to source laptops for the team"
Wells: [switches to buyer mode] "On it. How many laptops..."
```

---

### **Test 6: Context Persistence - Return User**

**Goal:** Verify Wells remembers returning users.

**Steps:**
1. Complete Test 1 (onboarding)
2. Log out
3. Log back in, go to `/app`
4. Start new message

**Expected Behavior:**
- Wells references past context: "Hey [Name], ready to continue building that campaign?"
- Conversation history loaded from database
- User profile and preferences remembered
- Journey still set correctly

**Check Database:**
```sql
SELECT * FROM "Message" WHERE "conversationId" = 'conv_xxx' ORDER BY "createdAt" ASC;
SELECT "messageCount", "lastActivityAt" FROM "Conversation";
SELECT * FROM "Memory" WHERE "userId" = 'user_xxx';
```

---

### **Test 7: Journey Switching Mid-Conversation**

**Goal:** Verify seamless journey transitions.

**Steps:**
1. Start in seller journey
2. User: "Actually, I want to hire someone instead"
3. Wells should:
   - Acknowledge the switch naturally
   - Update activeJourney in database
   - Switch personality/prompts to job_seeker mode
   - Start helping immediately

**Expected Wells Actions:**
- `[ACTION:SET_JOURNEY:{journey:"job_seeker"}]`
- Database updated
- No friction, no "are you sure?" gates

---

### **Test 8: Memory Creation and Retrieval**

**Goal:** Verify Wells learns and remembers important details.

**Steps:**
1. During conversation, share personal info:
   - "I hate cold calling"
   - "My budget is tight, under $10K"
   - "I need this done by end of month"
2. Continue conversation
3. Wells should reference these memories naturally

**Expected Wells Actions:**
- `[ACTION:CREATE_MEMORY:{category:"preferences",content:"Hates cold calling",importance:8}]`
- Memories stored in database
- Retrieved and referenced in future prompts

**Check Database:**
```sql
SELECT * FROM "Memory" WHERE "userId" = 'user_xxx' ORDER BY "importance" DESC;
SELECT * FROM "UserContext" WHERE "userId" = 'user_xxx';
```

---

### **Test 9: Error Handling**

**Goal:** Verify graceful failure.

**Steps:**
1. Send malformed input
2. Trigger action that fails (e.g., missing required field)
3. Test timeout scenarios

**Expected Behavior:**
- Wells responds naturally: "Sorry, I hit a snag. Can you try that again?"
- No crashes, no raw error messages
- Conversation continues smoothly

---

### **Test 10: Personality and Voice**

**Goal:** Ensure Wells sounds like Wells, not a chatbot.

**Evaluation Criteria:**
- ✅ Uses contractions (I'll, you're, can't)
- ✅ Short, punchy sentences when appropriate
- ✅ Direct and confident, not tentative
- ✅ No corporate jargon ("leverage synergies", "circle back")
- ✅ Takes action without asking permission (first time gets approval gate)
- ✅ Proactive: suggests, anticipates, solves before asked
- ✅ Smart: understands nuance, reads between lines

**Bad Examples (what NOT to say):**
- ❌ "I would be happy to assist you with that"
- ❌ "Let's circle back on that"
- ❌ "I will proceed to create the campaign"
- ❌ "Please provide the following information..."

**Good Examples (Wells voice):**
- ✅ "I'll build that campaign for you"
- ✅ "Found 47 companies that match. Want me to reach out?"
- ✅ "You're targeting the wrong ICP. Here's why..."
- ✅ "I got them down from $2.50 to $1.85 per unit"

---

## 📊 Success Metrics

### **Phase 1 = Bulletproof if:**

1. **Onboarding:** 100% success rate, <30 seconds to complete
2. **Journeys:** All 4 work flawlessly, no bugs
3. **Actions:** All action markers execute correctly, write to database
4. **Context:** Conversation history persists, memories retrieved
5. **Personality:** Sounds natural, helpful, proactive (not robotic)
6. **Switching:** Journey changes work mid-conversation, no friction
7. **Errors:** Graceful handling, no crashes
8. **Performance:** <2s response time from Wells
9. **Database:** All tables update correctly (UserProfile, Conversation, Message, Memory, RFQ)
10. **UX:** Pure conversational, NO forms, NO buttons

---

## 🔧 Technical Validation

### **Database Schema Check:**
```bash
# Verify all tables exist
npx prisma db pull
npx prisma validate
```

### **Check Recent Conversations:**
```sql
SELECT
  c.id,
  c."userId",
  c."activeJourney",
  c."onboardingCompleted",
  c."messageCount",
  COUNT(m.id) as actual_messages
FROM "Conversation" c
LEFT JOIN "Message" m ON m."conversationId" = c.id
GROUP BY c.id
ORDER BY c."lastActivityAt" DESC
LIMIT 10;
```

### **Check User Profiles:**
```sql
SELECT
  up.*,
  c."activeJourney",
  c."onboardingCompleted"
FROM "UserProfile" up
JOIN "User" u ON up."userId" = u.id
LEFT JOIN "Conversation" c ON c."userId" = u.id
ORDER BY up."createdAt" DESC;
```

### **Check Memories:**
```sql
SELECT
  m.*,
  uc.company,
  uc.role
FROM "Memory" m
JOIN "UserContext" uc ON m."userId" = uc."userId"
ORDER BY m."importance" DESC, m."createdAt" DESC
LIMIT 20;
```

---

## 🐛 Known Issues to Monitor

1. **Action Regex:** Ensure `[ACTION:TYPE:{json}]` parsing works with complex JSON
2. **JSON Parsing:** Malformed JSON in action params could crash
3. **Conversation State:** Race conditions if user sends messages rapidly
4. **Memory Retrieval:** Large memory sets could slow down prompt building
5. **Prisma Connection:** Connection pool exhaustion under load

---

## 🚀 Next Steps After Testing

Once Phase 1 is bulletproof:

### **Phase 2: GRAIN & Vault Integration**
- Deploy smart contracts to Base testnet
- Circle USDC integration
- Auto-appreciation mechanism
- Replace Airwallex with GRAIN

### **Phase 3: AI Ops Module**
- Build operator dashboard
- Implement first 3 nodes (email, CRM, leads)
- Launch with beta clients

---

## 📝 Testing Checklist

- [ ] Test 1: Onboarding - Seller
- [ ] Test 2: Seller Journey - Campaign
- [ ] Test 3: Buyer Journey - RFQ
- [ ] Test 4: Job Seeker Journey
- [ ] Test 5: Founder Journey - Multi-journey
- [ ] Test 6: Context Persistence
- [ ] Test 7: Journey Switching
- [ ] Test 8: Memory System
- [ ] Test 9: Error Handling
- [ ] Test 10: Personality Check

- [ ] Database validation queries
- [ ] Performance testing (<2s responses)
- [ ] Load testing (10+ concurrent users)
- [ ] Mobile responsiveness (chat UI)

---

**Ready to test?** Start with Test 1, work through sequentially. Document any bugs in GitHub issues.

**Production URL:** https://grainandvault.com/app
**Testing User:** Create fresh accounts to avoid pollution

**Let's make Wells legendary.**
