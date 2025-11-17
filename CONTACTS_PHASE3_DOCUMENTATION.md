# Contacts Database - Phase 3: Advanced Features

## Overview

Phase 3 adds advanced campaign management, bulk operations, analytics, and interaction tracking to the Contacts Database system. All APIs are authenticated via Clerk and enforce strict user isolation.

## Database Schema

Run the following schema to set up Phase 3 tables:

```bash
psql $POSTGRES_URL -f scripts/schema-contacts-advanced.sql
```

### New Tables

- **contact_campaigns** - Campaign management
- **campaign_contacts** - Campaign-contact junction table
- **contact_interactions** - Track all interactions (calls, meetings, emails, etc.)
- **contact_tags** - Flexible tagging system
- **contact_tag_assignments** - Contact-tag junction
- **contact_custom_fields** - User-defined custom fields
- **contact_custom_field_values** - Custom field values
- **contact_notes** - Quick notes about contacts
- **contact_sources** - Track where contacts came from

### Enhanced Tables

- **contacts** - Added `source_id`, `status`, and `tags` fields

## API Endpoints

### 1. Campaign Management

#### List Campaigns
```
GET /api/contacts/campaigns
```

**Query Parameters:**
- `status` - Filter by status (draft, active, paused, completed, archived)
- `limit` - Number of results (default: 100)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "campaigns": [
    {
      "id": "uuid",
      "name": "Q4 Customer Reactivation",
      "description": "Re-engage dormant customers",
      "status": "active",
      "filters": {
        "relationship_type": "customer",
        "dormant_days": 90
      },
      "goal": "Reactivate 50 customers",
      "start_date": "2025-01-01T00:00:00Z",
      "end_date": "2025-03-31T23:59:59Z",
      "contact_count": 234,
      "messages_sent": 156,
      "responses_received": 42,
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 15,
    "limit": 100,
    "offset": 0,
    "hasMore": false
  }
}
```

#### Create Campaign
```
POST /api/contacts/campaigns
```

**Request Body:**
```json
{
  "name": "Q4 Customer Reactivation",
  "description": "Re-engage customers who haven't been contacted in 90+ days",
  "status": "draft",
  "filters": {
    "relationship_type": "customer",
    "dormant_days": 90,
    "importance_score": {
      "min": 70
    }
  },
  "goal": "Reactivate 50 customers",
  "start_date": "2025-01-01T00:00:00Z",
  "end_date": "2025-03-31T23:59:59Z",
  "auto_populate": true
}
```

**Supported Filters:**
- `relationship_type` - Filter by relationship type
- `importance_score.min` / `importance_score.max` - Filter by importance score range
- `company` - Filter by company (partial match)
- `role` - Filter by role/title (partial match)
- `preferred_channel` - Filter by preferred communication channel
- `tags` - Array of tags (contacts must have ALL tags)
- `last_contact_days` - Contacts contacted within X days
- `dormant_days` - Contacts NOT contacted within X days

**Response:**
```json
{
  "campaign": { /* campaign object */ },
  "contacts_added": 234
}
```

### 2. Campaign Details

#### Get Campaign with Contacts
```
GET /api/contacts/campaigns/{id}
```

**Query Parameters:**
- `include_contacts` - Include contacts list (default: true)
- `limit` - Contacts per page (default: 100)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "campaign": { /* campaign object */ },
  "contacts": [
    {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      /* ...other contact fields... */
      "campaign_messages_sent": 2,
      "campaign_last_contacted": "2025-01-10T14:30:00Z",
      "campaign_responded": true,
      "added_at": "2025-01-01T00:00:00Z",
      "added_by": "filter"
    }
  ],
  "pagination": {
    "total": 234,
    "limit": 100,
    "offset": 0,
    "hasMore": true
  }
}
```

#### Update Campaign
```
PATCH /api/contacts/campaigns/{id}
```

**Request Body:**
```json
{
  "name": "Updated Campaign Name",
  "status": "active",
  "filters": { /* updated filters */ }
}
```

#### Delete Campaign
```
DELETE /api/contacts/campaigns/{id}
```

**Response:**
```json
{
  "success": true,
  "message": "Campaign deleted successfully"
}
```

### 3. Campaign Contact Management

#### Add Contacts to Campaign
```
POST /api/contacts/campaigns/{id}/contacts
```

**Request Body:**
```json
{
  "contact_ids": ["uuid1", "uuid2", "uuid3"],
  "added_by": "manual"
}
```

**Response:**
```json
{
  "success": true,
  "added": 3,
  "ignored": 0,
  "message": "3 contact(s) added to campaign"
}
```

#### Remove Contacts from Campaign
```
DELETE /api/contacts/campaigns/{id}/contacts
```

**Request Body:**
```json
{
  "contact_ids": ["uuid1", "uuid2"]
}
```

**Response:**
```json
{
  "success": true,
  "removed": 2,
  "message": "2 contact(s) removed from campaign"
}
```

### 4. Bulk Operations

#### Perform Bulk Operations
```
POST /api/contacts/bulk
```

**Supported Operations:**
- `update` - Update multiple contacts
- `delete` - Delete multiple contacts
- `export` - Export contacts to CSV/JSON
- `add_to_campaign` - Add to campaign
- `add_tags` - Add tags to contacts
- `remove_tags` - Remove tags from contacts
- `change_status` - Change status (active/inactive/archived)

#### Bulk Update
```json
{
  "operation": "update",
  "contact_ids": ["uuid1", "uuid2"],
  "data": {
    "importance_score": 85,
    "relationship_type": "customer"
  }
}
```

#### Bulk Delete
```json
{
  "operation": "delete",
  "contact_ids": ["uuid1", "uuid2"]
}
```

#### Bulk Export (CSV)
```json
{
  "operation": "export",
  "contact_ids": ["uuid1", "uuid2"],
  "data": {
    "format": "csv"
  }
}
```

**Response:**
```json
{
  "success": true,
  "operation": "export",
  "format": "csv",
  "csv": "id,name,email,...\nuuid1,John Doe,john@example.com,...",
  "count": 2
}
```

#### Bulk Export (JSON)
```json
{
  "operation": "export",
  "contact_ids": ["uuid1", "uuid2"],
  "data": {
    "format": "json"
  }
}
```

#### Add to Campaign
```json
{
  "operation": "add_to_campaign",
  "contact_ids": ["uuid1", "uuid2"],
  "data": {
    "campaign_id": "campaign-uuid"
  }
}
```

#### Add Tags
```json
{
  "operation": "add_tags",
  "contact_ids": ["uuid1", "uuid2"],
  "data": {
    "tags": ["vip", "high-priority"]
  }
}
```

#### Remove Tags
```json
{
  "operation": "remove_tags",
  "contact_ids": ["uuid1", "uuid2"],
  "data": {
    "tags": ["old-tag"]
  }
}
```

#### Change Status
```json
{
  "operation": "change_status",
  "contact_ids": ["uuid1", "uuid2"],
  "data": {
    "status": "archived"
  }
}
```

### 5. Contact Analytics

#### Get Analytics
```
GET /api/contacts/analytics
```

**Query Parameters:**
- `metric` - Specific metric or 'all' (default: all)
  - `overview` - Overview statistics
  - `by_source` - Breakdown by source
  - `by_relationship` - Breakdown by relationship type
  - `by_company` - Top companies
  - `by_role` - Top roles/titles
  - `engagement` - Engagement metrics
  - `growth` - Growth over time
  - `conversion` - Conversion funnel
- `start_date` - Start date for growth metrics (ISO 8601)
- `end_date` - End date for growth metrics (ISO 8601)

**Response:**
```json
{
  "analytics": {
    "overview": {
      "total_contacts": 5420,
      "active_contacts": 4892,
      "inactive_contacts": 328,
      "archived_contacts": 200,
      "avg_importance_score": 67.50,
      "contacted_last_30d": 1250,
      "contacted_last_90d": 3100,
      "dormant": 2320,
      "new_this_week": 45,
      "new_this_month": 187
    },
    "by_source": [
      {
        "source": "LinkedIn Import",
        "total": 2150,
        "active": 1980,
        "avg_importance": 72.30,
        "first_contact_date": "2024-01-15",
        "most_recent_date": "2025-01-17"
      }
    ],
    "by_relationship": [
      {
        "relationship_type": "customer",
        "total": 2340,
        "active": 2100,
        "avg_importance": 75.20,
        "avg_messages_received": 12.50,
        "avg_messages_sent": 8.30,
        "active_last_30d": 890
      }
    ],
    "by_company": [
      {
        "company": "Acme Corp",
        "contact_count": 15,
        "avg_importance": 82.00,
        "relationship_types": ["customer", "partner"],
        "most_recent_contact": "2025-01-15"
      }
    ],
    "by_role": [
      {
        "role": "CEO",
        "contact_count": 234,
        "avg_importance": 85.40,
        "relationship_types": ["customer", "investor", "partner"]
      }
    ],
    "engagement": {
      "total_contacts": 4892,
      "total_messages_received": 45230,
      "total_messages_sent": 32100,
      "avg_messages_per_contact": 9.25,
      "avg_response_time_minutes": 245.30,
      "prefer_email": 3200,
      "prefer_slack": 890,
      "prefer_sms": 450,
      "no_engagement": 1200,
      "low_engagement": 2100,
      "medium_engagement": 1200,
      "high_engagement": 392,
      "active_last_7d": 450,
      "active_last_30d": 1250,
      "active_last_90d": 3100
    },
    "growth": {
      "daily": [
        {
          "date": "2025-01-15",
          "new_contacts": 15,
          "cumulative_total": 5405
        }
      ],
      "weekly": [
        {
          "week": "2025-01-13",
          "new_contacts": 87,
          "relationship_types": ["customer", "partner", "supplier"]
        }
      ]
    },
    "conversion": {
      "by_relationship": [
        {
          "relationship_type": "customer",
          "total": 2340,
          "high_value": 890,
          "engaged": 1850,
          "highly_engaged": 450
        }
      ],
      "summary": {
        "total_contacts": 4892,
        "high_value": 1450,
        "engaged": 3200,
        "highly_engaged": 892
      }
    }
  }
}
```

#### Refresh Analytics
```
POST /api/contacts/analytics
```

Triggers a refresh of materialized views for faster analytics queries.

**Response:**
```json
{
  "success": true,
  "message": "Analytics refreshed successfully"
}
```

### 6. Interaction Tracking

#### Get Interaction History
```
GET /api/contacts/{id}/interactions
```

**Query Parameters:**
- `type` - Filter by interaction type
- `limit` - Results per page (default: 100)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "interactions": [
    {
      "id": "uuid",
      "type": "call",
      "subject": "Q4 Review Discussion",
      "description": "Discussed Q4 performance and 2025 goals",
      "outcome": "success",
      "interaction_date": "2025-01-15T14:30:00Z",
      "duration_minutes": 45,
      "deal_id": null,
      "message_id": null,
      "metadata": {
        "recording_url": "https://...",
        "attendees": ["John Doe", "Jane Smith"]
      },
      "created_at": "2025-01-15T15:00:00Z",
      "updated_at": "2025-01-15T15:00:00Z"
    }
  ],
  "pagination": {
    "total": 87,
    "limit": 100,
    "offset": 0,
    "hasMore": false
  },
  "statistics": {
    "total_interactions": 87,
    "interaction_types": 6,
    "total_duration_minutes": 2340,
    "most_recent_interaction": "2025-01-15T14:30:00Z",
    "first_interaction": "2024-03-10T10:00:00Z",
    "email_count": 45,
    "call_count": 23,
    "meeting_count": 12,
    "demo_count": 4,
    "deal_count": 2,
    "note_count": 1,
    "successful_interactions": 78
  }
}
```

#### Log Interaction
```
POST /api/contacts/{id}/interactions
```

**Request Body:**
```json
{
  "type": "call",
  "subject": "Q4 Review Discussion",
  "description": "Discussed Q4 performance and 2025 goals. Customer is interested in expanding contract.",
  "outcome": "success",
  "interaction_date": "2025-01-15T14:30:00Z",
  "duration_minutes": 45,
  "metadata": {
    "recording_url": "https://...",
    "next_steps": ["Send proposal", "Schedule follow-up"]
  }
}
```

**Supported Interaction Types:**
- `email` - Email communication
- `call` - Phone call
- `meeting` - In-person or video meeting
- `demo` - Product demo
- `deal` - Deal/transaction
- `note` - General note
- `linkedin` - LinkedIn interaction
- `twitter` - Twitter interaction
- `other` - Other interaction type

**Response:**
```json
{
  "interaction": { /* interaction object */ },
  "message": "Interaction logged successfully"
}
```

#### Update Interaction
```
PATCH /api/contacts/{id}/interactions?interaction_id={interaction_id}
```

**Request Body:**
```json
{
  "description": "Updated description with new details",
  "outcome": "success",
  "metadata": { /* updated metadata */ }
}
```

#### Delete Interaction
```
DELETE /api/contacts/{id}/interactions?interaction_id={interaction_id}
```

**Response:**
```json
{
  "success": true,
  "message": "Interaction deleted successfully"
}
```

## Performance Optimizations

### For 300k+ Contacts

1. **Indexes** - All queries use appropriate indexes on:
   - `user_id` - Fast user isolation
   - `status` - Filter active/inactive contacts
   - `tags` - GIN index for tag arrays
   - `created_at`, `last_contact_date` - Time-based queries
   - `relationship_type`, `company`, `role` - Filtering

2. **Materialized Views** - Pre-computed analytics:
   - `contact_source_stats` - Source breakdown
   - `contact_engagement_stats` - Engagement metrics
   - Refresh via `POST /api/contacts/analytics`

3. **Pagination** - All list endpoints support `limit` and `offset`

4. **Bulk Operations** - Single query for multiple records

5. **Aggregations** - Use Postgres native aggregation functions

## Security

- All endpoints require Clerk authentication
- Strict user isolation (all queries filter by `user_id`)
- Contacts verified to belong to user before operations
- SQL injection protection via parameterized queries
- No data leakage between users

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad request (validation error)
- `401` - Unauthorized (not authenticated)
- `404` - Resource not found
- `500` - Internal server error

## Example Workflows

### Workflow 1: Create Campaign and Track Results

```javascript
// 1. Create campaign with auto-populate
const campaign = await fetch('/api/contacts/campaigns', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Q1 Customer Reactivation',
    filters: {
      relationship_type: 'customer',
      dormant_days: 90,
      importance_score: { min: 70 }
    },
    auto_populate: true
  })
});

// 2. Get campaign details with contacts
const details = await fetch(`/api/contacts/campaigns/${campaign.id}?include_contacts=true`);

// 3. Log interactions as you contact people
for (const contact of details.contacts) {
  await fetch(`/api/contacts/${contact.id}/interactions`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'email',
      subject: 'Checking in - Special Q1 Offer',
      interaction_date: new Date().toISOString()
    })
  });
}

// 4. View analytics to track progress
const analytics = await fetch('/api/contacts/analytics?metric=engagement');
```

### Workflow 2: Bulk Export and Update

```javascript
// 1. Export high-value contacts to CSV
const exported = await fetch('/api/contacts/bulk', {
  method: 'POST',
  body: JSON.stringify({
    operation: 'export',
    contact_ids: highValueContactIds,
    data: { format: 'csv' }
  })
});

// Download CSV
const blob = new Blob([exported.csv], { type: 'text/csv' });
const url = URL.createObjectURL(blob);

// 2. Bulk update after review
await fetch('/api/contacts/bulk', {
  method: 'POST',
  body: JSON.stringify({
    operation: 'update',
    contact_ids: reviewedContactIds,
    data: {
      importance_score: 90,
      tags: ['reviewed-2025']
    }
  })
});
```

### Workflow 3: Analytics Dashboard

```javascript
// Get comprehensive analytics
const analytics = await fetch('/api/contacts/analytics?metric=all');

// Display:
// - Total contacts by source
// - Engagement levels
// - Growth trends
// - Top companies and roles
// - Conversion metrics

// Refresh analytics (run nightly via cron)
await fetch('/api/contacts/analytics', { method: 'POST' });
```

## Migration from Phase 1

Phase 3 is fully compatible with Phase 1 (basic CRUD). No changes to existing contacts table structure required, only additions:

```sql
-- Run schema-contacts-advanced.sql to add new tables
-- Existing contacts work as-is
-- New features are opt-in
```

## Next Steps

Phase 3 is now complete! Suggested enhancements:

1. **Email Integration** - Connect to email providers (Gmail, Outlook) to auto-log interactions
2. **Calendar Sync** - Sync meetings from Google Calendar / Outlook
3. **AI-Powered Insights** - Use Claude to analyze communication patterns
4. **Smart Campaigns** - AI-suggested campaign strategies
5. **Webhooks** - Real-time notifications for campaign events
6. **Mobile App** - React Native app for on-the-go contact management

## Support

For issues or questions, refer to the main Wells AI documentation.
