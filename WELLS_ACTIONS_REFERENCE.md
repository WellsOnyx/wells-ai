# Wells AI - Action Reference Guide

**Status:** Production Ready
**Last Updated:** November 8, 2025

All actions Wells can take to help users.

---

## 🎯 Core Actions (All Journeys)

### **CREATE_PROFILE**
Creates user profile from onboarding conversation.

**Syntax:**
```
[ACTION:CREATE_PROFILE:{"company":"X","role":"Y","industry":"Z","goals":"...","preferredJourney":"seller"}]
```

**Parameters:**
- `company` (string, optional): Company name
- `role` (string, optional): User's job title
- `industry` (string, optional): Industry/sector
- `goals` (string, optional): What user wants to accomplish
- `preferredJourney` (string, required): buyer|seller|job_seeker|founder

**Database Impact:**
- Creates/updates record in `UserProfile` table
- Sets `Conversation.activeJourney` to `preferredJourney`
- Marks `Conversation.onboardingCompleted` = true
- Sets `Conversation.onboardingCompletedAt` timestamp

**Returns:**
```json
{
  "type": "profile_created",
  "params": { /* profile data */ }
}
```

---

### **SET_JOURNEY**
Switches active journey mid-conversation.

**Syntax:**
```
[ACTION:SET_JOURNEY:{"journey":"buyer"}]
```

**Parameters:**
- `journey` (string, required): buyer|seller|job_seeker|founder

**Database Impact:**
- Updates `Conversation.activeJourney`
- Updates `Conversation.lastActivity` with switch message

**Returns:**
```json
{
  "type": "journey_set",
  "journey": "buyer"
}
```

---

### **CREATE_MEMORY**
Stores important information about the user.

**Syntax:**
```
[ACTION:CREATE_MEMORY:{"category":"preferences","content":"Hates cold calling","importance":8}]
```

**Parameters:**
- `category` (string, optional): general|preferences|goals|constraints
- `content` (string, required): The fact to remember
- `importance` (number, 1-10, default: 5): How important this is

**Database Impact:**
- Ensures `UserContext` exists for user
- Creates `Memory` record
- Memories with importance ≥7 loaded in future conversations

**Returns:**
```json
{
  "type": "memory_created",
  "params": { /* memory data */ }
}
```

**When to Use:**
- User shares preferences ("I prefer email over calls")
- Budget constraints ("Under $10K budget")
- Timeline requirements ("Need this done by end of month")
- Non-negotiables ("Must be remote")
- Past experiences ("Tried cold email before, didn't work")

---

## 💼 Seller Journey Actions

### **CREATE_CAMPAIGN**
Creates an outbound sales campaign.

**Syntax:**
```
[ACTION:CREATE_CAMPAIGN:{"name":"SaaS CEOs Campaign","icp":{"industry":"SaaS","size":"50-200","role":"CEO"},"value_prop":"Save 20 hours/week with AI","cta":"Book a demo"}]
```

**Parameters:**
- `name` (string, required): Campaign name
- `icp` (object, optional): Ideal customer profile
  - `industry` (string): Target industry
  - `size` (string): Company size (e.g., "50-200", "500+")
  - `role` (string): Target job title
  - `location` (string): Geographic location
- `value_prop` (string, optional): Why they should care
- `messaging` (string, optional): Key messaging points
- `cta` (string, optional): Call to action

**Database Impact:**
- Creates `WellsOnyxCampaign` record
- Status = DRAFT
- Generates unique `campaignId`

**Returns:**
```json
{
  "type": "campaign_created",
  "campaignId": "abc123",
  "params": { /* campaign data */ }
}
```

---

### **FIND_LEADS**
Finds prospects matching ICP using Apollo.io.

**Syntax:**
```
[ACTION:FIND_LEADS:{"icp_criteria":{"title":"CEO","industry":"SaaS","company_size":"50-200","location":"United States"},"limit":50}]
```

**Parameters:**
- `titles` (string[], optional): Job titles to search for
- `icp_criteria` (object, optional): Search criteria
  - `title` (string): Job title
  - `industry` (string): Industry name
  - `company_size` (string): Company size range
  - `location` (string): Location/region
- `limit` (number, default: 25): Max prospects to return

**External API:**
- Uses Apollo.io API (requires `APOLLO_API_KEY` env var)
- Rate limits apply (check Apollo account)

**Returns (Success):**
```json
{
  "type": "leads_found",
  "count": 47,
  "total": 47,
  "prospects": [
    {
      "id": "abc123",
      "name": "John Doe",
      "email": "john@company.com",
      "title": "CEO",
      "company": "Company Inc",
      "companyDomain": "company.com",
      "linkedInUrl": "linkedin.com/in/johndoe",
      "location": "San Francisco, CA"
    }
    // ... up to 10 in response
  ]
}
```

**Returns (Failure):**
```json
{
  "type": "leads_search_failed",
  "error": "API key not configured",
  "fallback": "Apollo API not configured or rate limited"
}
```

**When to Use:**
- After CREATE_CAMPAIGN to find targets
- When user asks "find companies that match"
- During campaign setup phase

---

## 🛒 Buyer Journey Actions

### **CREATE_RFQ**
Creates a Request for Quote for procurement.

**Syntax:**
```
[ACTION:CREATE_RFQ:{"product":"Custom T-Shirts","category":"apparel","specs":"100% cotton, sizes S-XXL, 2-color print","quantity":10000,"unit":"pieces","budget":{"min":5000,"max":15000},"delivery_date":"2025-03-01"}]
```

**Parameters:**
- `product` (string, required): What they're sourcing
- `category` (string, default: "general"): Product category
- `specs` (string, optional): Detailed specifications
- `quantity` (number, optional): How many units
- `unit` (string, optional): Unit of measure
- `budget` (object, optional): Budget range
  - `min` (number): Minimum budget
  - `max` (number): Maximum budget
- `delivery_date` (string, optional): When they need it

**Database Impact:**
- Creates `RFQ` record
- Status = "open"
- Maps:
  - `product` → `title`
  - `specs` → `description`

**Returns:**
```json
{
  "type": "rfq_created",
  "rfqId": "rfq_abc123"
}
```

---

### **FIND_SUPPLIERS**
Finds suppliers matching procurement needs.

**Status:** Placeholder (coming soon)

**Syntax:**
```
[ACTION:FIND_SUPPLIERS:{"category":"electronics","location":"asia","certifications":["ISO9001"],"min_rating":4.0}]
```

**Returns:**
```json
{
  "type": "suppliers_found",
  "message": "Supplier search coming soon - RFQ created and will match with suppliers",
  "suppliers": []
}
```

**TODO:**
- Build supplier database
- Implement supplier matching algorithm
- Add verification/rating system

---

## 👔 Job Seeker Journey Actions

### **FIND_JOBS**
Finds job opportunities matching user profile.

**Status:** Placeholder (coming soon)

**Syntax:**
```
[ACTION:FIND_JOBS:{"skills":["React","TypeScript"],"titles":["Frontend Engineer","Software Engineer"],"location":"remote","min_salary":100000,"max_salary":150000}]
```

**Returns:**
```json
{
  "type": "jobs_found",
  "message": "Job search coming soon - building job matching engine",
  "jobs": []
}
```

**TODO:**
- Integrate with job board APIs (LinkedIn, Indeed, etc.)
- Build job matching algorithm
- Add application tracking

---

## 🚀 Founder Journey Actions

Founder journey can use ALL actions from other journeys, plus:

### **ANALYZE_BUSINESS**
Analyzes business metrics and health.

**Status:** Not yet implemented

**Syntax:**
```
[ACTION:ANALYZE_BUSINESS:{"metrics":["revenue","burn","runway"],"period":"last_30_days"}]
```

---

### **CREATE_TASK**
Creates a task/todo item.

**Status:** Not yet implemented

**Syntax:**
```
[ACTION:CREATE_TASK:{"description":"Launch marketing campaign","priority":"high","assignee":"user_123","due_date":"2025-02-15"}]
```

---

## 🔧 Implementation Details

### **How Actions Work:**

1. **Wells includes action in response:**
   ```
   Wells: "I'll create that campaign for you now."
   [ACTION:CREATE_CAMPAIGN:{"name":"..."}]
   Wells: "Campaign created! Ready to find leads?"
   ```

2. **Backend extracts actions:**
   - Regex: `/\[ACTION:([A-Z_]+):(\{[^}]+\})\]/g`
   - Parses JSON params
   - Executes action handler

3. **Action executes:**
   - Database write
   - API call
   - Both
   - Returns result

4. **Frontend receives:**
   ```json
   {
     "response": "Clean message without action markers",
     "conversationId": "conv_123",
     "actions": [
       { "type": "campaign_created", "campaignId": "..." }
     ]
   }
   ```

5. **Frontend strips markers:**
   - User sees: "I'll create that campaign for you now. Campaign created! Ready to find leads?"
   - Actions logged to console
   - Can show toasts/notifications

### **Error Handling:**

All actions wrapped in try/catch:
```typescript
try {
  // Execute action
} catch (error) {
  actions.push({
    type: 'error',
    action: actionType,
    error: error.message
  })
}
```

Wells sees error and can respond naturally:
```
Wells: "Sorry, I hit a snag with the lead search. Can you try that again?"
```

---

## 📊 Action Analytics

Track action usage in database:

```sql
-- Most used actions
SELECT
  jsonb_array_elements(actions)->>'type' as action_type,
  COUNT(*) as usage_count
FROM (
  SELECT actions FROM conversation_logs
) logs
GROUP BY action_type
ORDER BY usage_count DESC;
```

---

## 🎯 Best Practices

### **When to Use Actions:**

✅ **DO use actions for:**
- Creating database records (profiles, campaigns, RFQs)
- Calling external APIs (Apollo, job boards)
- Storing memories (important user info)
- Switching journeys
- Real work that helps the user

❌ **DON'T use actions for:**
- Simple responses
- Asking questions
- Explaining things
- Showing examples
- Brainstorming

### **Action Frequency:**

- **Onboarding:** 1-2 actions (CREATE_PROFILE, SET_JOURNEY)
- **Active work:** 2-5 actions per session
- **Complex tasks:** Chain actions (CREATE_CAMPAIGN → FIND_LEADS → SEND_OUTREACH)

### **Action Timing:**

- Take action when you have enough info
- Don't ask permission (unless first time or sensitive)
- Show initiative: "I'll find those leads for you now"
- Confirm after: "Found 47 matches. Want to see them?"

---

## 🚧 Coming Soon

### **Seller Journey:**
- `SEND_OUTREACH` - Send emails via Instantly.ai
- `GENERATE_OUTREACH` - AI-generated personalized messages
- `GET_CAMPAIGN_STATS` - Campaign analytics

### **Buyer Journey:**
- `SEND_RFQ` - Send RFQ to suppliers
- `COMPARE_QUOTES` - Analyze supplier quotes
- `NEGOTIATE` - Automated negotiation

### **Job Seeker Journey:**
- `PARSE_RESUME` - Extract resume data
- `OPTIMIZE_RESUME` - Improve for ATS
- `APPLY_TO_JOB` - Auto-apply to jobs
- `PREP_INTERVIEW` - Interview preparation
- `NEGOTIATE_OFFER` - Salary negotiation

### **Founder Journey:**
- `LAUNCH_GTM_CAMPAIGN` - Full GTM orchestration
- `HIRE_ROLE` - Recruitment workflow
- `SOURCE_PRODUCT` - Procurement workflow
- `ANALYZE_COMPETITORS` - Competitive analysis
- `BUILD_FORECAST` - Financial modeling

---

**Built by:** Wells AI
**For:** Making Wells actually do work, not just advise
**Status:** Production-ready, continuously improving

Test it: https://grainandvault.com/app
