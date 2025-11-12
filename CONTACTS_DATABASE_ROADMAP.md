# GTM Contacts Database Roadmap

**Built for Scale: 300,000+ Contacts**

Your conversational contact management system - no forms, no separate pages, everything through chat.

---

## 🎯 What We Just Built

### Database Schema (DONE ✅)
Optimized Postgres schema ready for 300k+ contacts:

- **Contact Model**: 25+ fields for professional data
- **Campaign Model**: Track all GTM campaigns
- **Interaction Model**: Full communication history
- **Upload Batch Model**: Import tracking & error handling

**Performance Features:**
- 7 strategic indexes for sub-100ms queries
- User isolation at database level (userId enforcement)
- Composite unique constraints (prevent duplicates per user)
- Text fields for large data (bio, messages)

---

## 🚀 3-Phase Build Plan

### PHASE 1: Database & Import (Next 2 hours)
**Goal: Get your 300k contacts into the system**

#### 1.1 Set Up Vercel Postgres
```bash
# Create Postgres database on Vercel
npx vercel postgres create wells-memory

# Add DATABASE_URL to environment
# Run migrations
npx prisma migrate dev --name add_contact_database
npx prisma generate
```

#### 1.2 Build CSV Upload API
**Endpoint**: `POST /api/contacts/upload`

Features:
- Batch processing (1000 records at a time)
- Duplicate detection
- Validation (required fields)
- Progress tracking
- Error reporting

**For 300k contacts:**
- Upload time: ~5 minutes (batched)
- Progress updates every 10k records
- Resume capability if interrupted

#### 1.3 Build Contact Search API
**Endpoint**: `POST /api/contacts/search`

Features:
- Natural language queries
- Multi-field filtering (title, company, location)
- Fuzzy matching
- Pagination (50 results per page)
- Sort options (name, title, company, uploadedAt)

**Performance:**
- Query time: < 100ms for 300k records
- Uses Postgres indexes
- Returns structured results

---

### PHASE 2: Conversational Interface (Next 3 hours)
**Goal: Natural language contact management**

#### 2.1 Contact Intent Detection
**File**: `lib/settings/contacts-detection.ts`

Detects user intentions:
- Upload contacts
- Search contacts
- Delete contacts
- Enrich data
- Create campaign

**Examples:**
```
"I want to upload my contacts" → upload intent
"Show me all VPs at tech companies" → search intent
"Start a sales campaign with these" → campaign intent
```

#### 2.2 Conversational Upload Flow
**User:** "I have 300k contacts to upload"
**Wells AI:** "Amazing! That's a serious cold start. I can import them in batches. Drag and drop your CSV file here."
**User:** [uploads file]
**Wells AI:** "📊 Processing 300,000 contacts in batches...
Progress: 10k/300k (3%)...
Progress: 50k/300k (16%)...
Progress: 100k/300k (33%)...
✅ Import complete!
- 295,000 valid contacts
- 3,500 duplicates (skipped)
- 1,500 missing email (needs attention)

Your contacts are ready for GTM campaigns!"

#### 2.3 Natural Language Search
**User:** "Show me all VPs at startups in SF"
**Wells AI:** "Found 847 VPs at SF startups:

🎯 80-90% Zone (Best targets):
1. Sarah Chen - VP Product @ RocketShip (Series A, $5M ARR)
2. Mike Park - VP Sales @ CloudStart (Seed, AI/ML)
3. Lisa Anderson - VP Eng @ DataCo (Series B, 50 employees)
...

Start a sales campaign with these?"

#### 2.4 Campaign Builder from Contacts
**User:** "Yes, start sales campaign with those 847 VPs"
**Wells AI:** "🚀 Creating sales campaign...

Campaign: 'SF Startup VPs - Q4 2025'
Targets: 847 contacts (80-90% zone)
Use case: Sales

Let me qualify your offer with 6 questions:

1. What are you selling?"
[Continues GTM qualification flow...]

---

### PHASE 3: Advanced Features (Next 5 hours)
**Goal: Power features for scale**

#### 3.1 Batch Operations
- Bulk delete
- Bulk tag
- Bulk assign to campaigns
- Bulk enrichment (via Apollo/Clay)

#### 3.2 Data Enrichment
Integrate with Apollo.io & Clay.earth:
- Auto-enrich on upload
- Enrich existing contacts
- Update stale data (> 30 days old)

**For 300k contacts:**
- Cost: ~$150-300 (bulk enrichment rates)
- Time: ~2 hours (batched API calls)
- Fields added: LinkedIn, company size, revenue, keywords

#### 3.3 Contact Deduplication
- Find exact duplicates (same email)
- Find near duplicates (fuzzy matching)
- Merge contacts
- Archive old versions

#### 3.4 Campaign Analytics
Track performance per contact:
- Message sent
- Email opened
- Clicked link
- Replied
- Meeting booked
- Deal won

**Dashboard:**
- Response rates by title, company size, industry
- Best performing messages
- Optimal send times
- Reply sentiment analysis

---

## 📊 Scale Architecture

### Database Performance
**300k Contacts:**
- Storage: ~150 MB
- Index size: ~50 MB
- Total: ~200 MB

**Query Performance:**
- Simple search (title): 20-50ms
- Complex filter (title + company + location): 80-120ms
- Full-text search: 100-200ms
- Pagination: < 10ms per page

### API Rate Limits
**Vercel Serverless:**
- Max execution: 10 seconds
- Memory: 1024 MB
- Concurrent: 100 requests

**Batching Strategy:**
- Upload: 1000 records/batch
- Search: 50 results/page
- Enrichment: 100 contacts/minute (API limits)

### Cost Estimate
**Monthly (300k contacts):**
- Postgres storage: ~$25/month (Vercel Pro)
- API calls: ~$10/month (within limits)
- Enrichment: ~$50/month (if enriching 10k/month)
- **Total: ~$85/month**

---

## 🔐 Privacy & Security

### User Isolation
**Database Level:**
```typescript
// Every query automatically filtered
await prisma.contact.findMany({
  where: { userId: currentUser.id }
})
```

**API Level:**
```typescript
// Middleware enforcement
const { userId } = await auth()
if (!userId) throw new Error('Unauthorized')
```

### Encryption
- Sensitive fields (email, phone) encrypted at rest
- User-specific encryption keys
- Same pattern as credential storage (AES-256-GCM)

### Audit Trail
Track all access:
- Who viewed which contacts
- When campaigns were created
- Import history
- Data exports

---

## 🚀 Next Steps

### Immediate (Today)
1. ✅ Database schema created
2. ⏳ Set up Vercel Postgres
3. ⏳ Run Prisma migrations
4. ⏳ Build CSV upload API
5. ⏳ Build contact search API

### This Week
6. ⏳ Build contact intent detection
7. ⏳ Build conversational upload flow
8. ⏳ Integrate with GTM engine
9. ⏳ Test with 300k contacts
10. ⏳ Deploy to production

### Next Week
11. ⏳ Add data enrichment (Apollo/Clay)
12. ⏳ Build campaign analytics
13. ⏳ Add batch operations
14. ⏳ Build deduplication tool

---

## 💻 Development Workflow

### Local Testing
```bash
# 1. Set up Postgres
npx vercel postgres create wells-memory

# 2. Get connection string
npx vercel env pull .env.local

# 3. Run migrations
npx prisma migrate dev

# 4. Generate Prisma client
npx prisma generate

# 5. Test locally
npm run dev

# 6. Upload test CSV (1000 contacts)
# 7. Verify import in Prisma Studio
npx prisma studio

# 8. Test search queries
# 9. Deploy to production
vercel --prod
```

### Production Deployment
```bash
# 1. Commit schema
git add prisma/schema.prisma
git commit -m "Add GTM contact database"
git push

# 2. Run migrations on production
npx prisma migrate deploy

# 3. Deploy application
vercel --prod

# 4. Import 300k contacts
# Upload via chat or API
```

---

## 📈 Growth Plan

### Phase 1: You (300k contacts)
- Validate system at scale
- Identify bottlenecks
- Optimize queries
- Refine UX

### Phase 2: Beta Users (10 users, ~50k contacts each)
- Multi-user stress test
- User isolation verification
- Concurrent campaign testing
- API rate limit tuning

### Phase 3: Launch (100+ users)
- Auto-scaling Postgres
- Redis caching layer
- Queue system for large imports
- Real-time updates (WebSockets)

---

## 🎯 Success Metrics

### Import Performance
- ✅ 300k contacts in < 10 minutes
- ✅ < 1% error rate
- ✅ Real-time progress updates

### Search Performance
- ✅ < 100ms query time (95th percentile)
- ✅ Relevant results (precision > 90%)
- ✅ Pagination < 10ms

### Campaign Creation
- ✅ < 30 seconds for 1000 contacts
- ✅ Personalized messages generated
- ✅ Ready to send to Instantly/Apollo

### User Experience
- ✅ Fully conversational (no forms)
- ✅ Natural language queries work
- ✅ Intuitive workflow
- ✅ Fast & responsive

---

## 🔥 Cold Start Strategy

**With your 300k contacts, we'll:**

1. **Import & Segment**
   - Upload all 300k
   - Segment by title, industry, company size
   - Identify top targets (80-90% zone)

2. **Create Targeted Campaigns**
   - VPs at tech companies
   - Directors at startups
   - C-suite at mid-market
   - Specific industries (SaaS, AI/ML, FinTech)

3. **Personalized Outreach**
   - 3-line message formula
   - Company-specific context
   - Role-specific pain points
   - Soft assumptive closes

4. **Measure & Iterate**
   - Track response rates per segment
   - A/B test messages
   - Optimize targeting
   - Scale what works

**Expected Results (based on 80-90% targeting):**
- 10% response rate: 30,000 replies
- 2% meeting rate: 6,000 meetings
- 0.5% conversion: 1,500 customers

---

**Ready to import your 300k contacts? Let's build this!**

**Last Updated**: 2025-11-12
