# Wells AI Organizations - Quick Reference

## File Structure

```
wells-ai-github-ready/
├── middleware.ts                              # ✅ Org-aware route protection
├── app/
│   ├── components/
│   │   ├── OrganizationSelector.tsx          # ✅ Org switcher dropdown
│   │   └── WellsAIContent.tsx                # ✅ Added org selector + passes orgId
│   ├── org/
│   │   └── [orgId]/
│   │       ├── dashboard/
│   │       │   └── page.tsx                  # ✅ Org dashboard with metrics
│   │       └── settings/
│   │           └── page.tsx                  # ✅ Member management + invites
│   ├── organizations/
│   │   └── create/
│   │       └── page.tsx                      # ✅ Clerk's CreateOrganization
│   └── api/
│       ├── chat/
│       │   └── route.ts                      # ✅ Accepts organizationId
│       ├── suppliers/
│       │   ├── match/
│       │   │   └── route.ts                  # ✅ Filters by orgId
│       │   └── notify/
│       │       └── route.ts                  # ✅ Saves orgId to Notion
│       └── rfqs/
│           └── route.ts                      # ✅ Requires auth, filters by orgId
└── lib/
    └── notion.ts                             # ✅ All functions accept orgId param
```

---

## Code Snippets

### **Get Organization Context (Client)**

```typescript
import { useOrganization } from '@clerk/nextjs'

const { organization, membership } = useOrganization()

// Check if admin
const isAdmin = membership?.role === 'org:admin'

// Get org ID
const orgId = organization?.id
```

### **Get Organization Context (Server)**

```typescript
import { auth } from '@clerk/nextjs/server'

export async function GET(request: NextRequest) {
  const { userId, orgId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use orgId
  const data = await getRFQs(50, orgId || undefined)
  return NextResponse.json(data)
}
```

### **Pass Organization ID to API**

```typescript
// In frontend component
const response = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({
    messages: [...],
    organizationId: organization?.id || null
  })
})
```

### **Query Notion with Organization Filter**

```typescript
// In lib/notion.ts
export async function getRFQs(limit: number = 50, organizationId?: string) {
  const filter = organizationId
    ? {
        property: 'Organization ID',
        rich_text: {
          equals: organizationId,
        },
      }
    : undefined

  const response = await notion.databases.query({
    database_id: REQUESTS_DB,
    filter,
    sorts: [{ property: 'Created', direction: 'descending' }],
  })

  return response.results.map(...)
}
```

### **Save to Notion with Organization ID**

```typescript
await notion.pages.create({
  parent: { database_id: REQUESTS_DB },
  properties: {
    'Request ID': { title: [{ text: { content: 'REQ-123' } }] },
    'Organization ID': {
      rich_text: [{ text: { content: organizationId } }]
    }, // ← This line
    'Buyer Name': { rich_text: [{ text: { content: 'Acme' } }] },
    // ... other properties
  }
})
```

---

## Routes

| Route                                  | Purpose                        | Protected | Org Required |
|----------------------------------------|--------------------------------|-----------|--------------|
| `/`                                    | Wells AI chat                  | Yes       | No           |
| `/organizations/create`                | Create organization            | Yes       | No           |
| `/org/[orgId]/dashboard`               | Organization dashboard         | Yes       | Yes          |
| `/org/[orgId]/settings`                | Organization settings          | Yes       | Yes          |
| `/api/chat`                            | Chat with AI (org-aware)       | Yes       | No           |
| `/api/rfqs?orgId=xxx`                  | Get RFQs for org               | Yes       | No           |
| `/api/suppliers/match`                 | Match suppliers (org-filtered) | Yes       | No           |
| `/api/suppliers/notify`                | Notify suppliers (saves orgId) | Yes       | No           |

---

## Notion Database Fields (Required)

Add this field to all databases:

```
Field Name:    Organization ID
Field Type:    Text (rich_text)
Description:   Clerk organization ID (e.g., org_abc123)
```

**Databases to update:**
- ✅ Suppliers Database
- ✅ Requests Database (RFQs)
- ✅ Transactions Database (Deals)

---

## Organization Roles

| Role         | Clerk Value  | Permissions                                                   |
|--------------|--------------|---------------------------------------------------------------|
| **Admin**    | `org:admin`  | Invite members, manage settings, approve purchases, all access |
| **Member**   | `org:member` | Request quotes, chat with AI, view org data                   |

---

## Key Clerk Components

### **OrganizationSwitcher**
Pre-built component by Clerk for switching orgs:

```typescript
import { OrganizationSwitcher } from '@clerk/nextjs'

<OrganizationSwitcher afterSelectOrganizationUrl="/org/:id/dashboard" />
```

### **CreateOrganization**
Pre-built component for creating orgs:

```typescript
import { CreateOrganization } from '@clerk/nextjs'

<CreateOrganization afterCreateOrganizationUrl="/org/:id/dashboard" />
```

### **OrganizationProfile**
Pre-built component for org settings:

```typescript
import { OrganizationProfile } from '@clerk/nextjs'

<OrganizationProfile />
```

---

## Testing Commands

```bash
# 1. Start dev server
npm run dev

# 2. Visit http://localhost:3000

# 3. Sign in as user

# 4. Click "Create Organization" in header

# 5. Create org, invite team member

# 6. Open incognito window, sign in as invited user

# 7. Accept invitation

# 8. Switch between orgs in dropdown

# 9. Request quote in org context

# 10. Check Notion - verify Organization ID saved
```

---

## Common Issues

### **Issue: User can't access org dashboard**
- **Check:** Is user a member of the organization?
- **Fix:** Invite user via settings page

### **Issue: Data not scoped to organization**
- **Check:** Is `Organization ID` field in Notion?
- **Fix:** Add `Organization ID` (text) field to database

### **Issue: Organization ID not being saved**
- **Check:** Is `organizationId` being passed to API?
- **Fix:** Verify `organization?.id` is not null in component

### **Issue: Middleware redirecting to create page**
- **Check:** Does route match `/org/*` pattern?
- **Fix:** Ensure user has active organization context

---

## Environment Setup

```bash
# .env.local
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Enable Organizations in Clerk Dashboard:
# 1. Go to https://dashboard.clerk.com
# 2. Select your application
# 3. Settings → Organizations → Enable
# 4. Configure settings (name, roles, etc.)
```

---

## API Request Flow

```
Frontend:
  useOrganization() → organization.id

     ↓

API Call:
  fetch('/api/chat', {
    body: { organizationId: org.id }
  })

     ↓

API Route:
  const { organizationId } = req.body

     ↓

Notion Helper:
  getRFQs(50, organizationId)

     ↓

Notion Query:
  filter: {
    property: 'Organization ID',
    rich_text: { equals: organizationId }
  }

     ↓

Response:
  Org-scoped data only
```

---

## Data Scoping Examples

### **Personal Account (No Org)**
```typescript
organizationId: null

// Sees:
// - Personal RFQs only
// - No org-scoped data
// - Individual supplier relationships
```

### **Organization Member**
```typescript
organizationId: 'org_abc123'

// Sees:
// - All org RFQs
// - Team member activity
// - Shared suppliers
// - Org analytics
```

### **Multiple Organizations**
```typescript
// Switch to Org A
organizationId: 'org_abc123'
// → Sees Org A data

// Switch to Org B
organizationId: 'org_xyz789'
// → Sees Org B data
```

---

## Organization Switching

```typescript
import { useOrganizationList } from '@clerk/nextjs'

const { setActive } = useOrganizationList()

// Switch to organization
await setActive({ organization: 'org_abc123' })

// Switch to personal account
await setActive({ organization: null })
```

---

## Member Management

```typescript
const { organization } = useOrganization()

// Invite member
await organization.inviteMember({
  emailAddress: 'colleague@company.com',
  role: 'org:member' // or 'org:admin'
})

// Update role
await organization.updateMember({
  userId: 'user_123',
  role: 'org:admin'
})

// Remove member
await organization.removeMember('user_123')

// Revoke invitation
await organization.invitations?.revoke({ invitationId: 'inv_123' })
```

---

## Dashboard Stats

```typescript
// Get org-scoped stats
const stats = await getDashboardStats(organizationId)

// Returns:
{
  totalRFQs: 42,
  activeRFQs: 12,
  totalDeals: 8,
  totalTransactionValue: 1200000,
  averageDealSize: 150000,
  conversionRate: 19.05
}
```

---

## Quick Deploy Checklist

- [ ] Enable Organizations in Clerk Dashboard
- [ ] Add `Organization ID` field to Notion databases
- [ ] Test organization creation
- [ ] Test member invitations
- [ ] Test organization switching
- [ ] Verify data scoping (org A vs org B)
- [ ] Test role-based permissions
- [ ] Deploy to production

---

**That's it!** You now have a complete multi-tenant organization system. 🚀
