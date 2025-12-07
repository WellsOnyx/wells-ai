# Team Collaboration System - Quick Start

## What Was Built

A comprehensive team collaboration system for Wells AI that allows businesses with human teams to work together effectively. The AI understands team structure, roles, and facilitates intelligent collaboration.

## Files Created

### Database Schema
- `/scripts/schema-teams.sql` - Complete database schema with 14 tables

### Services (lib/teams/)
- `team-service.ts` - Organization and team management (700+ lines)
- `permissions.ts` - Role-based access control (550+ lines)
- `assignments.ts` - Work assignment system (350+ lines)
- `activity.ts` - Activity tracking and logging (400+ lines)
- `comments.ts` - Team comments and @mentions (450+ lines)
- `handoffs.ts` - Conversation handoffs (350+ lines)
- `ai-team-context.ts` - AI team awareness (400+ lines)

### API Routes
- `/app/api/organizations/route.ts` - Create/list organizations
- `/app/api/organizations/[orgId]/route.ts` - Get/update organization
- `/app/api/organizations/[orgId]/members/route.ts` - Manage members
- `/app/api/activity/route.ts` - Activity feed
- `/app/api/assignments/route.ts` - Assignment management
- `/app/api/comments/route.ts` - Comments and mentions
- `/app/api/handoffs/route.ts` - Handoff management

### Documentation
- `TEAM_COLLABORATION_GUIDE.md` - Complete guide with examples
- `TEAM_COLLABORATION_QUICK_START.md` - This file

## Database Setup

```bash
# Run the schema
psql $POSTGRES_URL < scripts/schema-teams.sql
```

This creates all necessary tables:
- organizations, organization_members
- teams, team_members
- invites
- activity_log
- permissions (pre-seeded with role permissions)
- assignments
- comments, mentions
- handoffs
- shared_context
- notification_preferences
- audit_trail

## Quick Integration Examples

### 1. Add Team Context to Chat AI

Update your chat route to make AI team-aware:

```typescript
// In app/api/chat/route.ts
import { getTeamContext } from '@/lib/teams/ai-team-context'

export async function POST(request: NextRequest) {
  const { userId } = await auth()

  // ... existing code ...

  // Get user's organization (if any)
  const orgs = await getUserOrganizations(userId)
  const orgId = orgs[0]?.id

  // Add team context to AI
  let enhancedPrompt = systemPrompt
  if (orgId) {
    const teamContext = await getTeamContext(userId, orgId)
    enhancedPrompt = `${systemPrompt}${teamContext}`
  }

  // Call Claude with enhanced prompt
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: enhancedPrompt, // Now includes team context
    messages: messages,
  })

  // ... rest of chat logic ...
}
```

Now the AI knows:
- Who's on the team
- User's role and permissions
- Active assignments
- Pending handoffs
- Recent team activity

### 2. Create an Organization

```typescript
import { createOrganization } from '@/lib/teams/team-service'

// User clicks "Create Organization" button
const org = await createOrganization(
  'Acme Corp',
  userId,
  {
    industry: 'Technology',
    companySize: 'startup'
  }
)

// Redirect to organization dashboard
router.push(`/team/${org.slug}`)
```

### 3. Invite Team Members

```typescript
import { inviteToOrganization } from '@/lib/teams/team-service'

// Invite dialog form submission
const invite = await inviteToOrganization(
  orgId,
  email,
  'admin', // or 'member', 'viewer'
  currentUserId,
  'Welcome! Looking forward to working with you.'
)

// Send email with magic link
await sendEmail({
  to: email,
  subject: 'Join Acme Corp on Wells AI',
  html: `
    <p>You've been invited to join Acme Corp!</p>
    <a href="${process.env.NEXT_PUBLIC_URL}/invites/${invite.token}">
      Accept Invitation
    </a>
  `
})
```

### 4. Assign a Deal to Team Member

```typescript
import { assignToUser } from '@/lib/teams/assignments'
import { hasPermission } from '@/lib/teams/permissions'

// Check if user can assign
const canAssign = await hasPermission(userId, orgId, 'deals', 'edit')

if (canAssign) {
  await assignToUser('deal', dealId, teamMemberId, userId)

  // Log activity
  await logActivity(
    orgId,
    userId,
    'deal.assigned',
    'deal',
    dealId,
    { assignedTo: teamMemberId, assignedBy: userId }
  )
}
```

### 5. Add Comments with @Mentions

```typescript
import { addComment } from '@/lib/teams/comments'

// User submits comment
const comment = await addComment(
  'deal',
  dealId,
  userId,
  'Hey @[Sarah](user_123), can you review the pricing on this? @[John](user_456) for final approval.',
  { isInternal: true }
)

// Mentioned users (user_123, user_456) automatically get notifications
```

### 6. AI-Suggested Handoff

```typescript
import { suggestHandoff } from '@/lib/teams/ai-team-context'

// User asks AI: "How do I approve this $100k payment?"
const teamMembers = await getOrganizationMembers(orgId)

const { suggestedMember, reason, confidence } = await suggestHandoff(
  conversationHistory,
  teamMembers.map(m => ({
    userId: m.userId,
    name: m.displayName || m.userId,
    role: m.role,
    title: m.title,
    department: m.department
  }))
)

if (confidence > 0.7) {
  // AI responds: "This requires treasury approval. I recommend
  // handing this off to Sarah Johnson (CFO). Would you like me
  // to initiate the handoff?"

  if (userConfirms) {
    await initiateHandoff(
      orgId,
      'conversation',
      conversationId,
      userId,
      suggestedMember,
      reason
    )
  }
}
```

## AI Team Awareness Examples

### Example 1: Role-Aware Responses

```
User: "Approve this $75k payment to vendor"

AI: "I see you're a member, but payment approvals over $50k require
     admin or owner approval. I've notified Sarah Chen (Admin) to
     review this payment. You can track the approval in the activity feed."
```

### Example 2: Automatic Assignment Suggestions

```
User: "We have a new lead for enterprise sales"

AI: "Got it! Based on your team structure, I can see that John Smith
     leads the Sales team. Should I assign this lead to him, or would
     you prefer to assign it to someone else on the sales team?"
```

### Example 3: Context Across Team Conversations

```
[Sarah asks AI]: "What's the status of the Acme Corp deal?"
AI: "The Acme Corp deal is currently assigned to John. He added a
     comment 2 hours ago saying pricing is finalized at $50k and
     they're ready to sign. You're tagged for final approval since
     it's over the $25k threshold."

[Later, John asks AI]: "Did Sarah approve the Acme deal?"
AI: "Not yet. Sarah was notified 2 hours ago when you finalized
     pricing. Want me to send her a reminder?"
```

## Permission Examples

### Checking Permissions in API Routes

```typescript
import { hasPermission } from '@/lib/teams/permissions'

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  const { orgId, dealId } = await request.json()

  // Check if user can create deals
  const canCreate = await hasPermission(userId, orgId, 'deals', 'create')

  if (!canCreate) {
    return NextResponse.json(
      { error: 'You do not have permission to create deals' },
      { status: 403 }
    )
  }

  // Proceed with deal creation
  // ...
}
```

### Specialized Permission Checks

```typescript
import { canApproveTreasury, canViewDeal } from '@/lib/teams/permissions'

// Treasury approval
const { canApprove, reason } = await canApproveTreasury(userId, orgId, 100000)

if (!canApprove) {
  console.log(reason)
  // "Amount exceeds admin limit of 100,000 GRAIN"
}

// Deal visibility (members only see assigned deals)
const canView = await canViewDeal(userId, orgId, dealId)

if (!canView) {
  return NextResponse.json(
    { error: 'This deal is not assigned to you' },
    { status: 403 }
  )
}
```

## Activity Feed Integration

```typescript
import { getOrganizationActivity } from '@/lib/teams/activity'

// In your dashboard
const { activities, total } = await getOrganizationActivity(orgId, {
  limit: 20,
  offset: 0
})

// Display in UI
{activities.map(activity => (
  <div key={activity.id}>
    <span>{activity.userId}</span>
    <span>{activity.actionType}</span>
    <span>{activity.entityType}</span>
    <time>{activity.createdAt}</time>
  </div>
))}
```

## What's Next?

### Immediate Next Steps

1. **Run database migration**
   ```bash
   psql $POSTGRES_URL < scripts/schema-teams.sql
   ```

2. **Add team context to chat**
   - Update `/app/api/chat/route.ts`
   - Import `getTeamContext`
   - Add to system prompt when user is in org

3. **Create organization**
   - Call API: `POST /api/organizations`
   - Or use service directly: `createOrganization()`

4. **Test invite flow**
   - Invite a user
   - Accept invite via magic link
   - Verify role permissions

### Optional UI Components

To build a complete team collaboration UI, create:

```
components/teams/
  - OrganizationSwitcher.tsx     (switch between orgs)
  - TeamSidebar.tsx              (show members, activity)
  - InviteModal.tsx              (invite dialog)
  - AssignmentDropdown.tsx       (assign to member)
  - ActivityFeed.tsx             (real-time feed)
  - CommentThread.tsx            (comments UI)
  - MentionInput.tsx             (@mention autocomplete)

app/team/
  - page.tsx                     (team dashboard)
  - members/page.tsx             (member management)
  - activity/page.tsx            (full activity log)
  - settings/page.tsx            (org settings)
```

## Testing the System

### 1. Create Organization
```bash
curl -X POST http://localhost:3000/api/organizations \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Corp",
    "industry": "Technology"
  }'
```

### 2. Invite Member
```bash
curl -X POST http://localhost:3000/api/organizations/[orgId]/members \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "role": "admin"
  }'
```

### 3. Create Assignment
```bash
curl -X POST http://localhost:3000/api/assignments \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "entityType": "deal",
    "entityId": "deal_123",
    "assigneeId": "user_456",
    "orgId": "[orgId]"
  }'
```

### 4. Get Activity Feed
```bash
curl -X GET "http://localhost:3000/api/activity?orgId=[orgId]&limit=10" \
  -H "Authorization: Bearer $CLERK_TOKEN"
```

## Key Benefits

1. **AI Team Awareness**: AI knows team structure and can make intelligent suggestions
2. **Role-Based Security**: Automatic permission checking based on roles
3. **Collaboration**: Comments, mentions, handoffs enable seamless teamwork
4. **Audit Trail**: Complete history of all actions for compliance
5. **Scalable**: Supports multiple organizations, teams, and complex hierarchies

## Support

- Full documentation: `TEAM_COLLABORATION_GUIDE.md`
- Database schema: `scripts/schema-teams.sql`
- Service layer: `lib/teams/`
- API routes: `app/api/`

---

Built with Claude Code for Wells AI
