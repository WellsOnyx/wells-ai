# Job Seeker System - Quick Start Guide

## For End Users (Job Seekers)

### Get Started in 5 Minutes

1. **Visit the onboarding page:**
   ```
   https://your-domain.com/job-seeker/onboarding
   ```

2. **Complete 4 simple steps:**
   - Step 1: Your basic info (name, email, location)
   - Step 2: Career details (current role, desired role, skills)
   - Step 3: Upload resume (optional - AI will parse it!)
   - Step 4: Set preferences (remote, relocation, salary)

3. **View your matches:**
   - Redirects to `/job-seeker/dashboard`
   - See jobs with compatibility scores
   - Green = great match (80%+)
   - Yellow = good match (60-79%)

4. **Apply in one click:**
   - Click "Apply Now" on any job
   - AI generates your cover letter
   - Submit and track in "My Applications"

### Pro Tips

**Get Better Matches:**
- Add 5-10 relevant skills
- Write detailed experience summary
- Upload your resume for AI parsing

**Speed Up Applications:**
- Let AI generate cover letters
- Edit and personalize before submitting
- Apply to 3-5 jobs per week for best results

**Track Your Progress:**
- Check `/job-seeker/applications` regularly
- Update profile as you gain skills
- Respond quickly to interview requests

## For Developers

### Setup (2 minutes)

1. **Environment variables:**
```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...          # For AI features
CLERK_SECRET_KEY=sk_test_...          # For authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...

# Optional (for notifications)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
```

2. **Install dependencies:**
```bash
npm install
```

3. **Run development server:**
```bash
npm run dev
```

4. **Test the flow:**
   - Visit `http://localhost:3000/job-seeker/onboarding`
   - Complete onboarding with test data
   - View dashboard at `/job-seeker/dashboard`

### Key Endpoints

```typescript
// Profile Management
GET    /api/job-seeker/profile          // Get user profile
POST   /api/job-seeker/profile          // Create profile
PATCH  /api/job-seeker/profile          // Update profile

// Job Matching
GET    /api/job-seeker/match            // Get matched jobs

// Applications
POST   /api/job-seeker/apply            // Submit application
GET    /api/job-seeker/apply            // Get all applications

// AI Services
POST   /api/job-seeker/resume-parse     // Parse resume
POST   /api/job-seeker/resume-optimize  // Optimize resume
```

### Quick Test

```bash
# 1. Create a test profile
curl -X POST http://localhost:3000/api/job-seeker/profile \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "currentRole": "Senior Engineer",
    "desiredRole": "VP Engineering",
    "skills": ["Leadership", "Python", "AWS"],
    "experience": "10+ years in tech",
    "location": "San Francisco, CA"
  }'

# 2. Get job matches
curl http://localhost:3000/api/job-seeker/match

# 3. Parse a resume
curl -X POST http://localhost:3000/api/job-seeker/resume-parse \
  -H "Content-Type: application/json" \
  -d '{"resumeText": "Your resume text here..."}'
```

## For Hiring Companies

### Receive Applications

When a candidate applies to your Executive Talent RFQ:

1. **SMS Notification:**
   ```
   🔷 WELLS AI - NEW CANDIDATE

   Job: VP of Engineering
   Candidate: Jane Doe
   Current Role: Senior Engineer
   Skills: Leadership, Python, AWS

   View Application: [link]

   Reply: 1=Interview | 2=Pass
   ```

2. **Email Notification (if configured):**
   - Full candidate profile
   - Cover letter
   - Resume
   - Match score

3. **View in Dashboard:**
   - All applications in one place
   - Candidate details
   - Quick actions

### Best Practices

**Review Applications:**
- Check compatibility score
- Read AI-generated cover letter
- Review candidate's current role

**Respond Quickly:**
- Candidates apply to multiple jobs
- Quick response = higher acceptance rate
- SMS reply: "1" for interview, "2" to pass

**Track in Notion:**
- All applications sync to Notion
- Update status as you progress
- Analytics built-in

## Chat Integration

### As a Job Seeker

Just talk naturally:

```
You: "I'm looking for a new job"
Wells AI: "I can help with that! Have you completed your job seeker profile?"

You: "Not yet"
Wells AI: "Let me guide you through onboarding. Visit /job-seeker/onboarding"

You: "I already have a profile"
Wells AI: "Great! You have 5 new job matches. View them at /job-seeker/dashboard"

You: "Show me my applications"
Wells AI: "You have 3 active applications. View at /job-seeker/applications"
```

### Keywords that Trigger Job Seeker Mode

- "job"
- "career"
- "resume"
- "looking for work"
- "find a job"
- "hire me"
- "employment"
- "position"

## Troubleshooting

### Profile Not Saving
- Check Clerk credentials
- Ensure user is authenticated
- Verify all required fields filled

### No Job Matches
- Add more skills
- Broaden desired role
- Check if Executive Talent RFQs exist in Notion

### AI Features Not Working
- Verify ANTHROPIC_API_KEY is set
- Check API key has credits
- Try again (rate limits)

### Cover Letter Not Generating
- Same as AI features
- Fallback: Write manually
- Can still submit application

## Architecture Overview

```
┌─────────────────┐
│   Job Seeker    │
│   Onboarding    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│  Clerk Profile  │◄─────┤  Resume AI   │
│   (Metadata)    │      │   Parser     │
└────────┬────────┘      └──────────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│  Job Matching   │◄─────┤  Notion RFQs │
│    Engine       │      │ (Executive)  │
└────────┬────────┘      └──────────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│   Dashboard     │      │ Cover Letter │
│  (Matches)      │◄─────┤   Generator  │
└────────┬────────┘      └──────────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│  Application    │─────►│   Notify     │
│   Submission    │      │   Company    │
└────────┬────────┘      └──────────────┘
         │
         ▼
┌─────────────────┐
│  Applications   │
│    Tracking     │
└─────────────────┘
```

## What's Next?

### Immediate Improvements
1. Add email notifications (Resend)
2. Add SMS alerts for job matches
3. Build resume PDF export
4. Add interview scheduling

### Future Features
1. Video profiles
2. Skill assessments
3. Referral system
4. Analytics dashboard

## Support

Need help? Check:
- Full documentation: `JOB_SEEKER_SYSTEM.md`
- API schemas: `lib/schemas/index.ts`
- Matching logic: `lib/job-seeker/matching.ts`
- Resume parser: `lib/job-seeker/resume-parser.ts`

## Success Metrics

Track these to measure success:
- Profile completion rate
- Average match quality score
- Application conversion rate
- Time from match to apply
- Employer response rate

## Launch Checklist

Before going live:

- [ ] Test full onboarding flow
- [ ] Verify job matching works
- [ ] Test cover letter generation
- [ ] Confirm application submission
- [ ] Check email notifications (if configured)
- [ ] Test SMS alerts (if configured)
- [ ] Mobile responsive check
- [ ] Load test with 100+ RFQs
- [ ] Security audit complete
- [ ] Analytics tracking set up

---

**You're ready to launch!** 🚀

The job seeker system is fully functional and integrates seamlessly with Wells AI's existing marketplace. Start onboarding job seekers today!
