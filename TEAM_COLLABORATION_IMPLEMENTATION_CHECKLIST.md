# Team Collaboration System - Implementation Checklist

## Phase 1: Database Setup ✅ COMPLETE

- [x] Create database schema (`scripts/schema-teams.sql`)
- [x] Define 14 tables for complete team collaboration
- [x] Seed default permissions for roles
- [ ] **ACTION REQUIRED**: Run database migration
  ```bash
  psql $POSTGRES_URL < scripts/schema-teams.sql
  ```

## Phase 2: Service Layer ✅ COMPLETE

- [x] Team Service (`lib/teams/team-service.ts`)
  - Organizations: create, get, update
  - Members: add, remove, invite, update roles
  - Teams: create, manage, add members
  - Invites: create, accept, revoke

- [x] Permissions Service (`lib/teams/permissions.ts`)
  - Role-based access control (RBAC)
  - Specialized permission checks
  - Permission matrix for all resources

- [x] Assignments Service (`lib/teams/assignments.ts`)
  - Assign work to team members
  - Track assignment status
  - Get team and individual assignments

- [x] Activity Service (`lib/teams/activity.ts`)
  - Log all team actions
  - Get activity feeds
  - Activity statistics

- [x] Comments Service (`lib/teams/comments.ts`)
  - Add/edit/delete comments
  - Thread support
  - @mentions and notifications

- [x] Handoffs Service (`lib/teams/handoffs.ts`)
  - Initiate handoffs
  - Accept/decline handoffs
  - Track handoff history

- [x] AI Team Context Service (`lib/teams/ai-team-context.ts`)
  - Generate team context for AI
  - Suggest handoffs using AI
  - Search team history
  - Check approval requirements

## Phase 3: API Routes ✅ COMPLETE

- [x] Organizations API
  - POST `/api/organizations` - Create org
  - GET `/api/organizations` - List user's orgs
  - GET `/api/organizations/[orgId]` - Get org details
  - PATCH `/api/organizations/[orgId]` - Update org

- [x] Members API
  - GET `/api/organizations/[orgId]/members` - List members
  - POST `/api/organizations/[orgId]/members` - Invite member
  - DELETE `/api/organizations/[orgId]/members` - Remove member

- [x] Activity API
  - GET `/api/activity` - Get activity feed

- [x] Assignments API
  - POST `/api/assignments` - Assign entity
  - GET `/api/assignments` - Get assignments
  - PATCH `/api/assignments` - Update assignment

- [x] Comments API
  - POST `/api/comments` - Add comment
  - GET `/api/comments` - Get comments
  - PATCH `/api/comments` - Edit comment
  - DELETE `/api/comments` - Delete comment

- [x] Handoffs API
  - POST `/api/handoffs` - Initiate handoff
  - GET `/api/handoffs` - Get pending handoffs
  - PATCH `/api/handoffs` - Accept/decline handoff

## Phase 4: AI Integration (NEXT STEP)

- [ ] **Update chat route for team awareness**
  ```typescript
  // In app/api/chat/route.ts
  import { getTeamContext } from '@/lib/teams/ai-team-context'
  import { getUserOrganizations } from '@/lib/teams/team-service'

  // Get user's org
  const orgs = await getUserOrganizations(userId)
  const orgId = orgs[0]?.id

  // Add team context to AI prompt
  let enhancedPrompt = systemPrompt
  if (orgId) {
    const teamContext = await getTeamContext(userId, orgId)
    enhancedPrompt = `${systemPrompt}${teamContext}`
  }
  ```

- [ ] **Add handoff suggestion tool to AI**
  ```typescript
  // Add to TOOLS array in chat route
  {
    name: 'suggest_handoff',
    description: 'Suggest which team member should handle this conversation',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string' }
      }
    }
  }
  ```

## Phase 5: UI Components (OPTIONAL)

### Core Components
- [ ] `components/teams/OrganizationSwitcher.tsx`
  - Dropdown to switch between organizations
  - Show current org and available orgs

- [ ] `components/teams/TeamSidebar.tsx`
  - Display team members
  - Show recent activity
  - Quick actions (invite, assign, etc.)

- [ ] `components/teams/InviteModal.tsx`
  - Form to invite new members
  - Email, role selection
  - Optional message

- [ ] `components/teams/AssignmentDropdown.tsx`
  - Dropdown to assign entity to team member
  - Shows team members with roles
  - Inline assignment UI

- [ ] `components/teams/ActivityFeed.tsx`
  - Real-time activity stream
  - Filter by type, user, entity
  - Pagination

- [ ] `components/teams/CommentThread.tsx`
  - Display comments on entities
  - Reply threading
  - Edit/delete actions

- [ ] `components/teams/MentionInput.tsx`
  - Rich text input with @mention autocomplete
  - Shows team members as you type
  - Formats mentions correctly

### Dashboard Pages
- [ ] `app/team/page.tsx`
  - Team overview dashboard
  - Key metrics (assignments, activity)
  - Quick actions

- [ ] `app/team/members/page.tsx`
  - Member management
  - Invite members
  - Update roles
  - Remove members

- [ ] `app/team/activity/page.tsx`
  - Full activity log
  - Advanced filtering
  - Export capabilities

- [ ] `app/team/settings/page.tsx`
  - Organization settings
  - Approval thresholds
  - Notification preferences

## Phase 6: Testing & Validation

### Database Testing
- [ ] Verify all tables created successfully
- [ ] Check permissions seeded correctly
- [ ] Test foreign key constraints

### Service Testing
- [ ] Create organization → Success
- [ ] Invite member → Email sent with magic link
- [ ] Accept invite → User added to org
- [ ] Assign deal → Assignment created
- [ ] Add comment → Mentions parsed correctly
- [ ] Initiate handoff → Notification sent

### Permission Testing
- [ ] Owner can do everything
- [ ] Admin has limited treasury access
- [ ] Member can only view assigned deals
- [ ] Viewer has read-only access to team

### API Testing
- [ ] All routes require authentication
- [ ] Permission checks work correctly
- [ ] Activity logging is comprehensive
- [ ] Error handling is robust

### AI Integration Testing
- [ ] Team context appears in AI responses
- [ ] AI references team members correctly
- [ ] Handoff suggestions are relevant
- [ ] AI respects role permissions

## Phase 7: Documentation ✅ COMPLETE

- [x] Main guide (`TEAM_COLLABORATION_GUIDE.md`)
- [x] Quick start (`TEAM_COLLABORATION_QUICK_START.md`)
- [x] Implementation checklist (this file)

## Critical Next Steps

### 1. Run Database Migration (15 minutes)
```bash
# Connect to your database
psql $POSTGRES_URL

# Run the migration
\i scripts/schema-teams.sql

# Verify tables created
\dt

# Check permissions seeded
SELECT * FROM permissions;
```

### 2. Integrate AI Team Context (30 minutes)
```typescript
// In app/api/chat/route.ts

// Add imports
import { getTeamContext } from '@/lib/teams/ai-team-context'
import { getUserOrganizations } from '@/lib/teams/team-service'

// Before calling Claude
const orgs = await getUserOrganizations(userId)
const orgId = orgs[0]?.id

let enhancedSystemPrompt = systemPrompt
if (orgId) {
  const teamContext = await getTeamContext(userId, orgId)
  enhancedSystemPrompt = `${systemPrompt}${teamContext}`
}

// Use enhancedSystemPrompt in Claude API call
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  system: enhancedSystemPrompt, // ← Changed
  messages: messages,
})
```

### 3. Test Basic Flow (45 minutes)

#### Create Organization
```bash
# Via API
curl -X POST http://localhost:3000/api/organizations \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Corp", "industry": "Technology"}'

# Or via service
import { createOrganization } from '@/lib/teams/team-service'
const org = await createOrganization('Test Corp', userId)
```

#### Invite Team Member
```bash
curl -X POST http://localhost:3000/api/organizations/[orgId]/members \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teammate@example.com",
    "role": "admin",
    "message": "Welcome to the team!"
  }'
```

#### Test AI Team Awareness
```
User: "Who's on my team?"

AI (with team context): "Your team has 3 members:
  - You (Owner)
  - Sarah Chen (Admin) - CFO
  - John Smith (Member) - Sales Lead"
```

## Success Criteria

- [ ] Database migration runs without errors
- [ ] Can create organization via API
- [ ] Can invite and accept member invitations
- [ ] AI shows team context in responses
- [ ] Permissions enforce correctly (members can't see unassigned deals)
- [ ] Activity log captures all actions
- [ ] Comments with @mentions work
- [ ] Handoffs can be initiated and accepted

## Common Issues & Solutions

### Issue: Database migration fails
**Solution**: Check PostgreSQL version (need 12+), verify `gen_random_uuid()` available

### Issue: AI doesn't show team context
**Solution**: Verify `getTeamContext()` is called and result is added to system prompt

### Issue: Permissions always deny
**Solution**: Check `organization_members` table has user with correct role

### Issue: Mentions don't work
**Solution**: Verify `parseMentions()` regex matches your mention format: `@[Name](userId)`

## Performance Considerations

- [ ] Add indexes on frequently queried columns (already in schema)
- [ ] Consider caching team context for repeated AI calls
- [ ] Paginate activity feeds and comments
- [ ] Use connection pooling for database

## Security Checklist

- [ ] All API routes check authentication
- [ ] Permission checks before all operations
- [ ] Invite tokens expire after 7 days
- [ ] Audit trail logs all sensitive actions
- [ ] IP addresses logged for security audit
- [ ] Owners can't be removed by other owners

## Deployment Checklist

- [ ] Run database migration in production
- [ ] Set up monitoring for activity log
- [ ] Configure email service for invites
- [ ] Test permission matrix in production
- [ ] Set up alerts for failed handoffs
- [ ] Document organization creation process

## Future Enhancements

- [ ] Slack integration for notifications
- [ ] Email notifications for mentions
- [ ] Advanced analytics dashboard
- [ ] Custom roles beyond owner/admin/member/viewer
- [ ] Team templates for common structures
- [ ] Bulk member import from CSV
- [ ] SSO/SAML integration
- [ ] Advanced approval workflows
- [ ] Time-based access controls

---

## Summary

**What's Complete**: ✅
- Full database schema (14 tables)
- 7 service modules (3000+ lines)
- 6 API route sets
- Complete documentation

**What's Next**: 🚀
1. Run database migration (15 min)
2. Add AI team context (30 min)
3. Test basic flow (45 min)

**Total Time to Production**: ~90 minutes

---

Built with Claude Code for Wells AI
