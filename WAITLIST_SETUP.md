# Wells AI - Viral Waitlist Setup Guide

## Overview

The viral waitlist system includes:
- **Early access page** at `/early-access` with slick teaser marketing
- **Invite system** - Each signup gets 3 invite codes
- **Position tracking** - Show user's position in line (FOMO)
- **Priority access** - Invited users skip ahead in line
- **Admin dashboard** at `/admin/waitlist` to manage signups
- **Social sharing** - Twitter & LinkedIn integration

## Setup Instructions

### 1. Create Notion Waitlist Database

1. Go to your Notion workspace
2. Create a new database called "Wells AI Waitlist"
3. Add the following properties:

| Property Name | Type | Description |
|--------------|------|-------------|
| Email | Email | User's email address |
| Invite Code | Text | Unique 8-char code (auto-generated) |
| Position | Number | Position in waitlist |
| Invites Remaining | Number | How many invites left (starts at 3) |
| Invites Used | Number | How many invites user has sent |
| Referred By | Relation | Link to person who referred them |
| Status | Select | Options: Waiting, Priority, Approved |
| Joined Date | Date | When they signed up |

4. **Get the database ID:**
   - Open the database as a full page
   - Copy the URL - it looks like: `https://notion.so/myworkspace/abc123?v=xyz`
   - The database ID is the part after the last `/` and before the `?`
   - Example: `abc123def456ghi789` (32 characters)

### 2. Add Environment Variable

Add to your `.env.local`:

```bash
NOTION_WAITLIST_DATABASE_ID=your_database_id_here
```

### 3. Deploy

```bash
# Commit changes
git add -A
git commit -m "Add viral waitlist system"

# Deploy to Vercel
vercel --prod

# Add environment variable in Vercel dashboard:
# Settings → Environment Variables → Add
# NOTION_WAITLIST_DATABASE_ID = your_database_id_here
```

### 4. Test the Flow

1. **Visit early access page:**
   ```
   https://yoursite.com/early-access
   ```

2. **Sign up with your email**
   - You'll get position #1
   - Receive a unique invite code
   - See you have 3 invites remaining

3. **Share your invite link:**
   ```
   https://yoursite.com/early-access?invite=YOUR_CODE
   ```

4. **When someone uses your invite:**
   - They skip ahead in line (top 25%)
   - Your "Invites Used" count increases
   - They also get 3 invites to share

5. **View admin dashboard:**
   ```
   https://yoursite.com/admin/waitlist
   ```
   - See all signups
   - Track invite usage
   - Export to CSV

## How the Invite System Works

### Basic Flow:
1. User A signs up → Gets position #1, receives invite code `ABC123XY`
2. User A shares link: `yoursite.com/early-access?invite=ABC123XY`
3. User B clicks link → Sees "You've been invited!" banner
4. User B signs up → Skips to position #3 (top 25%), gets own invite code
5. User A's "Invites Used" counter goes from 0 → 1

### Gamification:
- **Each person gets 3 invites**
- **For every 3 people who join using your code**, you move up 1 position
- **Invited users** start in top 25% instead of end of line
- **Social proof** - Shows total signups and your position

### Viral Loop:
```
User 1 → Invites 3 people
   User 2 → Invites 3 people
   User 3 → Invites 3 people
   User 4 → Invites 3 people
Each cycle: 1 → 4 → 16 → 64 → 256 → ...
```

## Customization

### Change Number of Invites
Edit `/app/api/waitlist/join/route.ts`:
```typescript
'Invites Remaining': {
  number: 5  // Change from 3 to 5
}
```

### Adjust Priority Boost
Edit `/app/api/waitlist/join/route.ts`:
```typescript
const position = priority
  ? Math.max(1, Math.floor(allSignups.results.length / 2)) // Top 50% instead of 25%
  : allSignups.results.length + 1
```

### Custom Teaser Copy
Edit `/app/early-access/page.tsx`:
- Update hero headline
- Add/remove feature cards
- Customize success message

## Embedding on Wells Onyx

You can iframe or link to the early access page from WellsOnyx.com:

### Option 1: Link
```html
<a href="https://wellsai.vercel.app/early-access">
  Join Wells AI Early Access
</a>
```

### Option 2: Embed
```html
<iframe
  src="https://wellsai.vercel.app/early-access"
  width="100%"
  height="800px"
  frameborder="0"
></iframe>
```

## Admin Functions

### View Waitlist
- URL: `/admin/waitlist`
- Requires: Clerk authentication
- Features:
  - See all signups
  - Sort by position
  - View invite usage
  - Export to CSV

### Approve Users
To manually approve users:
1. Go to Notion database
2. Find the user
3. Change Status from "Waiting" → "Approved"
4. Send them access email manually

### Track Viral Growth
In Notion, create a formula property:
```
Invites Used * 3 = Total Referrals
```

Or use Notion charts to visualize:
- Signups over time
- Invite usage rate
- Top referrers

## Marketing Tips

### Launch Strategy:
1. **Seed the list** - Invite 20-30 friends/colleagues first
2. **Influencer outreach** - Give codes to industry influencers
3. **Social proof** - Share milestones ("500 people on waitlist!")
4. **FOMO** - Emphasize scarcity ("Only accepting 100 in first batch")

### Social Media Copy:
```
Just joined the waitlist for @WellsAI - the future of enterprise
commerce starts with a conversation.

Skip the line with my invite: [link]

AI-powered. Zero friction. Success-based pricing.
```

### Email Sequence:
1. **Confirmation** - "You're #X on the waitlist"
2. **Week 1** - "Here's what we're building..."
3. **Week 2** - "You moved up! Now #Y"
4. **Week 3** - "Invite friends to skip the line"
5. **Approval** - "It's your turn! Here's your access link"

## Security Notes

- **Rate limiting** - Add Vercel rate limiting to prevent spam
- **Email validation** - Already checks for @ symbol, consider email verification
- **Duplicate prevention** - Already blocks duplicate emails
- **Invite limits** - Each code can only be used 3 times

## Troubleshooting

**"Waitlist not configured" error:**
- Check `.env.local` has `NOTION_WAITLIST_DATABASE_ID`
- Verify Notion integration has access to the database
- Make sure database ID is correct (32 characters)

**Invites not tracking:**
- Check Notion database has "Invites Used" number property
- Verify "Referred By" is a Relation property
- Check API logs in Vercel

**Position not calculating:**
- Ensure "Position" is a Number property in Notion
- Check sorting in admin view

## Next Steps

1. ✅ Set up Notion database
2. ✅ Add environment variable
3. ✅ Deploy to production
4. 📧 Set up email notifications (coming soon)
5. 📊 Add analytics tracking (PostHog/Mixpanel)
6. 🎨 A/B test landing page copy
7. 🚀 Launch to public!

---

Built with trust. Scaled with purpose.

**Wells AI** | Part of the Wells Onyx constellation
