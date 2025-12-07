# Wells AI Team Collaboration System

## Overview

The Wells AI Team Collaboration System enables businesses with human teams to work together effectively. The AI understands team structure, roles, and facilitates intelligent collaboration between team members.

## Core Features

### 1. Organization & Team Structure
- **Organizations**: Companies with multiple teams
- **Teams**: Sub-groups within organizations (sales, procurement, finance, etc.)
- **Roles**: owner, admin, member, viewer
- **Invite System**: Email invites with magic links

### 2. Permissions & Access Control
- **Role-Based Access Control (RBAC)**: Granular permissions by role
- **Financial Permissions**: Control who can approve payments and access treasury
- **Data Visibility**: Members see only assigned deals, admins/owners see all
- **Audit Trail**: Comprehensive logging of all actions

### 3. Collaboration Features
- **Assignments**: Assign deals/leads to specific team members
- **Comments**: Internal team discussions on entities
- **@Mentions**: Notify specific team members
- **Handoffs**: Transfer conversations between team members
- **Activity Feed**: Real-time team activity tracking

### 4. AI Team Awareness
- **Team Context**: AI knows team structure and can reference it
- **Intelligent Routing**: AI suggests appropriate team member for tasks
- **Handoff Suggestions**: AI can suggest "This looks like a finance question, want me to loop in Sarah?"
- **Cross-Team Context**: Maintains context across team conversations about same deal

## Database Schema

### Core Tables

#### organizations
- Company/organization details
- Settings and configuration
- Billing information

#### organization_members
- Links users to organizations
- Stores role (owner, admin, member, viewer)
- Invitation tracking

#### teams
- Sub-groups within organizations
- Focus areas (sales, procurement, finance, etc.)

#### team_members
- Links users to teams
- Team roles (lead, member)

#### invites
- Email invitations with magic link tokens
- Expiration tracking

### Collaboration Tables

#### activity_log
- Organization-wide activity tracking
- All actions logged with metadata
- IP and user agent for security audit

#### permissions
- Role-based permission matrix
- Resource-level access control
- Constraints for special cases

#### assignments
- Work item assignments
- Status tracking (active, completed, reassigned)

#### comments
- Team discussions on entities
- Threading support (parent_id)
- Internal vs external comments

#### mentions
- @mention notifications
- Read/unread tracking

#### handoffs
- Transfer work between team members
- Reason and message tracking
- Acceptance/decline status

## Permission Matrix

| Permission | Owner | Admin | Member | Viewer |
|------------|-------|-------|--------|--------|
| View deals | Yes | Yes | Assigned Only | No |
| Edit deals | Yes | Yes | Assigned Only | No |
| Approve payments | Yes | Yes (< $50k) | No | No |
| Access treasury | Yes | View Only | No | No |
| Invite members | Yes | Yes | No | No |
| Remove members | Yes | Yes (not admins) | No | No |
| View all activity | Yes | Yes | Team Only | No |
| Create teams | Yes | Yes | No | No |
| Manage settings | Yes | Yes | No | No |

## API Routes

### Organizations

```typescript
// Create organization
POST /api/organizations
{
  name: string
  slug?: string
  description?: string
  industry?: string
  companySize?: string
  country?: string
}

// List user's organizations
GET /api/organizations

// Get organization details
GET /api/organizations/[orgId]

// Update organization
PATCH /api/organizations/[orgId]
{
  name?: string
  description?: string
  logoUrl?: string
  website?: string
  industry?: string
  companySize?: string
  settings?: object
}
```

### Members

```typescript
// List members
GET /api/organizations/[orgId]/members

// Invite member
POST /api/organizations/[orgId]/members
{
  email: string
  role: 'admin' | 'member' | 'viewer'
  message?: string
}

// Remove member
DELETE /api/organizations/[orgId]/members?userId=...
```

### Activity

```typescript
// Get activity feed
GET /api/activity?orgId=...&limit=50&offset=0
```

### Assignments

```typescript
// Assign entity
POST /api/assignments
{
  entityType: 'deal' | 'lead' | 'task'
  entityId: string
  assigneeId: string
  orgId: string
}

// Get my assignments
GET /api/assignments?status=active&entityType=deal

// Update assignment
PATCH /api/assignments
{
  assignmentId: string
  action: 'complete' | 'reassign' | 'unassign'
  newAssigneeId?: string
  orgId: string
}
```

### Comments

```typescript
// Add comment
POST /api/comments
{
  entityType: 'deal' | 'lead'
  entityId: string
  content: string
  parentId?: string
  isInternal?: boolean
  orgId: string
}

// Get comments
GET /api/comments?entityType=deal&entityId=...

// Edit comment
PATCH /api/comments
{
  commentId: string
  content: string
}

// Delete comment
DELETE /api/comments?commentId=...
```

### Handoffs

```typescript
// Initiate handoff
POST /api/handoffs
{
  orgId: string
  entityType: 'conversation' | 'deal' | 'lead'
  entityId: string
  toUserId: string
  reason?: string
  message?: string
}

// Get pending handoffs
GET /api/handoffs

// Accept/decline handoff
PATCH /api/handoffs
{
  handoffId: string
  action: 'accept' | 'decline'
  reason?: string
  orgId: string
}
```

## Service Layer

### Team Service (`lib/teams/team-service.ts`)

```typescript
// Organizations
createOrganization(name, ownerId, options)
getOrganization(orgId)
getUserOrganizations(userId)
updateOrganization(orgId, updates)

// Members
addOrganizationMember(orgId, userId, role, invitedBy)
getOrganizationMembers(orgId)
getOrganizationMember(orgId, userId)
updateMemberRole(orgId, userId, newRole)
removeFromOrganization(orgId, userId)

// Invites
inviteToOrganization(orgId, email, role, invitedBy, message)
acceptInvite(token, userId)
getPendingInvites(orgId)
revokeInvite(inviteId)

// Teams
createTeam(orgId, name, createdBy, options)
getTeams(orgId)
getTeam(teamId)
addTeamMember(teamId, userId, role)
getTeamMembers(teamId)
removeTeamMember(teamId, userId)
getUserTeams(orgId, userId)
```

### Permissions Service (`lib/teams/permissions.ts`)

```typescript
// Permission checking
hasPermission(userId, orgId, resource, action)
getPermissionForRole(role, resource)
getRolePermissions(role)

// Specialized checks
canViewDeal(userId, orgId, dealId)
canApproveTreasury(userId, orgId, amount)
canApprovePayment(userId, orgId, amount)
getAccessibleDeals(userId, orgId)
canManageSettings(userId, orgId)
canInviteMembers(userId, orgId)
canRemoveMembers(userId, orgId, targetUserId)
isOrganizationOwner(userId, orgId)
getUserRole(userId, orgId)
```

### Assignments Service (`lib/teams/assignments.ts`)

```typescript
assignToUser(entityType, entityId, assigneeId, assignerId)
getMyAssignments(userId, options)
getTeamAssignments(teamId, options)
getEntityAssignment(entityType, entityId)
reassign(assignmentId, newAssigneeId, reassignedBy)
completeAssignment(assignmentId)
unassign(entityType, entityId)
isAssignedTo(userId, entityType, entityId)
getAssignmentStats(userId)
```

### Activity Service (`lib/teams/activity.ts`)

```typescript
logActivity(orgId, userId, actionType, entityType, entityId, metadata, options)
getOrganizationActivity(orgId, options)
getEntityActivity(entityType, entityId, options)
getUserActivity(userId, orgId, options)
getRecentActivity(orgId, limit)
getActivityStats(orgId, period)
```

### Comments Service (`lib/teams/comments.ts`)

```typescript
addComment(entityType, entityId, userId, content, options)
getComments(entityType, entityId, options)
getComment(commentId)
editComment(commentId, userId, newContent)
deleteComment(commentId, userId)
getCommentReplies(parentId)
getCommentCount(entityType, entityId)

// Mentions
parseMentions(content)
notifyMentionedUsers(commentId, userIds)
getUserMentions(userId, options)
markMentionAsRead(mentionId)
getUnreadMentionCount(userId)
```

### Handoffs Service (`lib/teams/handoffs.ts`)

```typescript
initiateHandoff(orgId, entityType, entityId, fromUserId, toUserId, reason, message)
acceptHandoff(handoffId, userId)
declineHandoff(handoffId, userId, reason)
getHandoff(handoffId)
getHandoffHistory(entityType, entityId)
getPendingHandoffs(userId)
getInitiatedHandoffs(userId, options)
getActiveHandoff(entityType, entityId)
cancelHandoff(handoffId, userId)
getHandoffStats(userId)
```

### AI Team Context Service (`lib/teams/ai-team-context.ts`)

```typescript
// Get team context for AI prompts
getTeamContext(userId, orgId)

// AI-powered suggestions
suggestHandoff(conversationContent, teamMembers)

// Team history search
getRelevantTeamHistory(query, orgId, options)

// Team summaries
generateTeamSummary(orgId)

// Approval requirements
requiresTeamApproval(orgId, actionType, metadata)
```

## AI Integration

### Team Context in AI Prompts

The AI automatically receives team context when a user is part of an organization:

```typescript
import { getTeamContext } from '@/lib/teams/ai-team-context'

// In your chat route
const teamContext = await getTeamContext(userId, orgId)
const enhancedSystemPrompt = `${baseSystemPrompt}${teamContext}`
```

### Example AI Response with Team Awareness

```
User: "I need help with this deal"

AI: "I can see this deal is currently assigned to Sarah (Finance Admin).
     Since this involves payment approval over $50k, you'll need owner-level
     approval. Would you like me to notify the owner, or should I hand this
     off to Sarah to prepare the approval request?"
```

### Handoff Suggestions

```typescript
import { suggestHandoff } from '@/lib/teams/ai-team-context'

const { suggestedMember, reason, confidence } = await suggestHandoff(
  conversationContent,
  teamMembers
)

if (confidence > 0.7) {
  // AI suggests handoff
  console.log(`This should be handled by ${suggestedMember}: ${reason}`)
}
```

## Usage Examples

### 1. Create Organization

```typescript
import { createOrganization } from '@/lib/teams/team-service'

const org = await createOrganization('Acme Corp', userId, {
  industry: 'Technology',
  companySize: 'startup',
  country: 'US'
})
```

### 2. Invite Team Member

```typescript
import { inviteToOrganization } from '@/lib/teams/team-service'

const invite = await inviteToOrganization(
  orgId,
  'sarah@example.com',
  'admin',
  userId,
  'Welcome to the team!'
)

// Send email with invite link
const inviteUrl = `${baseUrl}/invites/${invite.token}`
```

### 3. Assign Deal to Team Member

```typescript
import { assignToUser } from '@/lib/teams/assignments'
import { logActivity } from '@/lib/teams/activity'

const assignment = await assignToUser('deal', dealId, assigneeId, userId)

await logActivity(
  orgId,
  userId,
  'deal.assigned',
  'deal',
  dealId,
  { assignedTo: assigneeId }
)
```

### 4. Add Comment with Mentions

```typescript
import { addComment } from '@/lib/teams/comments'

const comment = await addComment(
  'deal',
  dealId,
  userId,
  'Hey @[Sarah](user_123), can you review this pricing?',
  { isInternal: true }
)
// Mentions are auto-parsed and users are notified
```

### 5. Initiate Handoff

```typescript
import { initiateHandoff } from '@/lib/teams/handoffs'

const handoff = await initiateHandoff(
  orgId,
  'deal',
  dealId,
  currentUserId,
  financeUserId,
  'Needs financial approval',
  'This deal requires treasury approval for $75k'
)
```

### 6. Check Permissions

```typescript
import { canApprovePayment, canViewDeal } from '@/lib/teams/permissions'

// Check if user can approve payment
const canApprove = await canApprovePayment(userId, orgId, 50000)

// Check if user can view specific deal
const canView = await canViewDeal(userId, orgId, dealId)
```

## Database Setup

Run the schema file to set up the team collaboration tables:

```bash
psql $POSTGRES_URL < scripts/schema-teams.sql
```

## Environment Variables

No additional environment variables needed. Uses existing:
- `POSTGRES_URL` - Database connection
- `ANTHROPIC_API_KEY` - For AI-powered handoff suggestions
- `NEXT_PUBLIC_URL` - For invite links

## Security Considerations

1. **Role-Based Access**: All API routes check user permissions
2. **Audit Trail**: All actions logged with IP and user agent
3. **Invite Expiration**: Invites expire after 7 days
4. **Owner Protection**: Owners cannot be removed by other owners
5. **Assignment Validation**: Users can only view/edit assigned entities (members)
6. **Financial Guardrails**: Payment approvals require admin/owner role

## Next Steps

### UI Components (Not Yet Implemented)

The backend is complete. To add UI, create these components:

```
components/teams/
  - OrganizationSwitcher.tsx
  - TeamSidebar.tsx
  - InviteModal.tsx
  - AssignmentDropdown.tsx
  - ActivityFeed.tsx
  - CommentThread.tsx
  - MentionInput.tsx

app/team/
  - page.tsx (dashboard)
  - members/page.tsx
  - activity/page.tsx
  - settings/page.tsx
```

### Integration with Existing Features

1. **Update chat route** to use `getTeamContext()` when user is in an organization
2. **Add org selector** to main layout for users in multiple organizations
3. **Update deal/lead pages** to show assignments and comments
4. **Add activity feed** to dashboard

## Support

For questions or issues, contact the Wells AI team.

---

Built with Claude Code by Wells Onyx
